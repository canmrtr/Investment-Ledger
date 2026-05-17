# Voice-Add — Design Spec

**Date:** 2026-05-17
**Sprint:** 21 (candidate)
**Status:** Draft — pending user review

## Context

Portfoi currently lets users add transactions via four AddTab modes — text, image, CSV, manuel — all of which require opening the PWA, picking an asset type, and typing/uploading. The "mobile, on the go" scenario (right after a real trade at the bank or in IBKR) is friction-heavy. This spec adds a fifth path: voice. The user speaks a natural-language transaction in Turkish ("10 Apple aldım 180 dolardan IBKR'dan"), the audio is transcribed by Whisper, parsed by the existing `parse-transaction` edge fn, previewed in the existing ConfirmBox UI, and saved with the existing `saveTx` path.

Two channels are delivered together because they share ~70% backend infrastructure:

1. **PWA** — new "Ses" mode inside AddTab, hold-to-record button, in-app preview.
2. **Telegram bot** — voice message → bot → inline-keyboard preview → save. Optimised for "phone is already in Telegram, hold record, done."

## Goals

- Voice → transaction in <10 seconds on mobile (record + Whisper + parse + tap Onayla).
- Reuse `parse-transaction` and `saveTx` unchanged — voice is a thin adapter on top.
- Preview-before-save mandatory in both channels (transcription can mishear; never auto-INSERT).
- Turkish primary, English code-switch tolerated.

## Non-Goals (explicit YAGNI)

- Voice for CASH / DEPOSIT / BES (specialised fields don't survive NL parsing).
- Streaming / live transcription.
- Telegram queries beyond add-transaction (`/portfolio`, `/pnl`, etc.).
- Telegram group chat support — DM only.
- Multiple Telegram accounts per user — 1:1.
- Voice-driven SELL of fractional positions with manual ticker disambiguation UI.

## Architecture

```
┌─────────────────┐   ┌──────────────────┐
│ PWA AddTab      │   │ Telegram bot     │
│ "Ses" mode      │   │ (voice message)  │
└────────┬────────┘   └─────────┬────────┘
         │                      │
         │  audioBase64         │ file_id → getFile → download
         ▼                      ▼
   ┌──────────────────────────────────────┐
   │ transcribe-audio  (new edge fn)      │
   │  • verify JWT → user_id              │
   │  • voicePipeline() helper:           │
   │      chargeParseQuota                │
   │      → whisperTranscribe             │
   │      → parsePrompt                   │
   │  • returns {transcript, transactions}│
   └────────┬─────────────────────────────┘
            │
   ┌────────┴────────────────────┐
   ▼                             ▼
PWA ConfirmBox              Telegram inline-keyboard
(existing saveTx)           callback → INSERT + rebuild
```

Both edge fns funnel through one shared `voicePipeline(user_id, audioBytes, ...)` helper. The frontend POSTs audio, gets back `{transcript, transactions}`. **One rate-limit increment per voice attempt** — the existing 20/day `parse_calls_today` counter, no separate budget. Telegram inherits the same budget via the same helper.

Existing `parse-transaction` edge fn is refactored to import the same `parsePrompt` helper (extraction only, no behaviour change) — voice and text/image paths share one Claude prompt definition.

## Backend

### Secrets (Supabase Dashboard → Edge Functions → Secrets)

| Key | Purpose |
|-----|---------|
| `OPENAI_API_KEY` | Whisper (`audio/transcriptions`, model `whisper-1`) |
| `TELEGRAM_BOT_TOKEN` | Bot identity (from @BotFather) |
| `TELEGRAM_WEBHOOK_SECRET` | 32-byte random; verified via `X-Telegram-Bot-Api-Secret-Token` header on every webhook POST |

### New edge fn: `transcribe-audio`

**Deploy:** `--no-verify-jwt` (matches `parse-transaction`), but verifies JWT internally.

**Input:**
```ts
{
  audioBase64: string,   // base64 of recorded blob
  mimeType: string,      // "audio/webm" | "audio/mp4" | "audio/mpeg" | "audio/wav" | "audio/ogg"
  assetTypeHint?: string // e.g. "US_STOCK" — passed through to parse-transaction
}
```

**Pipeline:**
1. JWT → `user_id` (reject 401 if missing/invalid).
2. Validate `mimeType` ∈ allowed list. Validate `audioBase64.length < 10_000_000` (~7.5 MB raw, ~60s opus).
3. Decode base64 → call `voicePipeline(supaAdmin, user_id, audioBytes, mimeType, assetTypeHint)`. Helper handles charge → Whisper → parse internally.
4. Map result to HTTP:
   - `{ok:true, transcript, transactions}` → 200 `{transcript, transactions}`.
   - `code:"QUOTA"` → 429 "Günlük AI parse limitine ulaşıldı (20/gün)".
   - `code:"WHISPER"` → 502 "Ses tanıma servisi geçici olarak yanıt vermiyor". Quota **NOT** refunded.
   - `code:"EMPTY"` → 422 "Ses çok kısa veya boş, tekrar dener misin?".
   - `code:"PARSE"` → 200 `{transcript, transactions:[]}` (let frontend show the transcript and a "İşlem bulunamadı" message; counter already spent).

`assetTypeHint` is optional. When omitted (Telegram has no picker), `parsePrompt` falls back to letting Claude infer asset_type from the ticker (existing prompt behaviour).

**CORS:** `Access-Control-Allow-Origin: https://canmrtr.github.io` (matches other edge fns).

### New edge fn: `telegram-webhook`

**Deploy:** `--no-verify-jwt`.

**Webhook registration** (one-time manual step, documented in spec):
```
curl -X POST "https://api.telegram.org/bot$TG_TOKEN/setWebhook" \
  -d "url=https://<project>.supabase.co/functions/v1/telegram-webhook" \
  -d "secret_token=$TELEGRAM_WEBHOOK_SECRET"
```

**Pipeline (per `Update`):**
1. Verify `X-Telegram-Bot-Api-Secret-Token` header → 401 silently if mismatch.
2. Parse `Update` JSON. Route on type:
   - **`message.text` starts with `/start`** → reply onboarding text.
   - **`message.text` matches `/link\s+(\d{6})`** → look up `telegram_link_codes` by `code`. If found, unexpired, and not yet linked → upsert `telegram_links(user_id, chat_id)`, delete the code row, reply "Bağlandı ✓ Artık sesli işlem ekleyebilirsin." Else "Kod geçersiz veya süresi dolmuş."
   - **`message.text` == `/help`** → reply usage.
   - **`message.text` == `/cancel`** → delete the most recent `telegram_pending` row for that chat, reply "Önizleme iptal edildi."
   - **`message.voice` or `message.audio`** → look up `telegram_links` by `chat_id`. If unlinked → reply "Bu chat bağlı değil. Portfoi → Ayarlar'dan kod al, /link <kod> yaz." If voice `duration > 60` → reply "Çok uzun, max 60 saniye." Else:
     1. `getFile(file_id)` → download URL → fetch audio blob → `Uint8Array`.
     2. Call `voicePipeline(supaAdmin, user_id, audioBytes, mimeType /* from voice.mime_type */, undefined /* no hint */)`.
     3. On `code:"QUOTA"` → reply quota text. On `code:"WHISPER"` → reply Whisper-down text. On `code:"EMPTY"` → reply "Ses tanınamadı, tekrar dener misin?". On `code:"PARSE"` or empty transactions → reply "Anlayamadım: '<transcript>'. Tekrar dener misin?"
     4. On success: format Turkish preview as `BUY 10× AAPL @180 USD = 1800 USD` lines + "Portföy: <name>" + "Duydum: <transcript>".
     5. Insert row into `telegram_pending` with the picked `portfolio_id` (primary portfolio rule below).
     6. Reply with preview + `InlineKeyboardMarkup` `[[{text:"✓ Onayla", callback_data:`ok:${pending_id}`}, {text:"✗ İptal", callback_data:`no:${pending_id}`}]]`. Store the returned `message_id` on the pending row so the callback can edit it.
   - **`callback_query`** → parse `callback_data` (`ok:<id>` or `no:<id>`). Verify the `pending` row belongs to the chat that fired the callback. On `ok`: INSERT transactions for `user_id`, call `rebuildPositions` via shared helper, delete pending, edit the message to "✓ Kaydedildi." On `no`: delete pending, edit message to "✗ İptal edildi." Always `answerCallbackQuery` to dismiss the loading spinner.

### Shared helper module

Extract three helpers into `supabase/functions/_shared/voice-pipeline.ts`. Both `transcribe-audio` and `telegram-webhook` import them. `parse-transaction` is refactored to import `parsePrompt` too (no behaviour change).

```ts
// Centralised: every channel hits this. Single source of truth for the 20/day budget.
// Returns true if increment succeeded; false if user is over quota.
export async function chargeParseQuota(
  supaAdmin: SupabaseClient, user_id: string
): Promise<boolean>;

// Whisper call. `mimeType` is informational for the multipart name.
export async function whisperTranscribe(
  audioBytes: Uint8Array, mimeType: string
): Promise<{ transcript: string }>;

// LLM parse. `assetTypeHint` is optional — when missing, prompt instructs
// Claude to infer asset_type from the ticker.
export async function parsePrompt(
  text: string, assetTypeHint?: string
): Promise<{ transactions: Transaction[] }>;

// End-to-end voice pipeline used by both edge fns.
//   - charges quota (returns 429 marker if denied)
//   - transcribes
//   - parses
// Auth-agnostic: caller passes user_id (PWA: from verified JWT; Telegram: from telegram_links lookup).
export async function voicePipeline(
  supaAdmin: SupabaseClient,
  user_id: string,
  audioBytes: Uint8Array,
  mimeType: string,
  assetTypeHint?: string
): Promise<
  | { ok: true, transcript: string, transactions: Transaction[] }
  | { ok: false, code: "QUOTA" | "WHISPER" | "EMPTY" | "PARSE", message: string }
>;
```

**Rate-limit invariant:** `chargeParseQuota` is the **only** code path that calls `increment_parse_calls`. `transcribe-audio` deletes its current inline RPC call; both channels rely on `voicePipeline` (which calls `chargeParseQuota` once per attempt). Existing `parse-transaction` edge fn keeps its own `increment_parse_calls` call for the text/image flows — voice and text are mutually exclusive entry points, never both for the same user action.

### New DB tables

```sql
-- One-time linking code from Settings
create table telegram_link_codes (
  code text primary key,                        -- 6-digit zero-padded
  user_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,              -- 10 min TTL
  created_at timestamptz default now()
);
alter table telegram_link_codes enable row level security;
create policy "own codes" on telegram_link_codes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Persistent chat ↔ user link
create table telegram_links (
  user_id uuid primary key references auth.users(id) on delete cascade,
  chat_id bigint not null unique,
  linked_at timestamptz default now()
);
alter table telegram_links enable row level security;
create policy "own link read" on telegram_links
  for select using (auth.uid() = user_id);
create policy "own link delete" on telegram_links
  for delete using (auth.uid() = user_id);
-- INSERT / UPDATE only via service role (webhook).

-- Pending preview between voice-message and Onayla tap
create table telegram_pending (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  chat_id bigint not null,
  message_id bigint not null,                   -- the preview message we sent
  portfolio_id uuid not null references portfolios(id) on delete cascade,
  transactions jsonb not null,
  created_at timestamptz default now()
);
alter table telegram_pending enable row level security;
-- No user policies — service role only.

-- RPC: user-callable, generates a 6-digit code for their own account
create or replace function create_telegram_link_code()
returns text
language plpgsql security invoker
as $$
declare new_code text;
begin
  new_code := lpad((floor(random()*1000000))::int::text, 6, '0');
  delete from telegram_link_codes where user_id = auth.uid();  -- replace any existing
  insert into telegram_link_codes(code, user_id, expires_at)
    values (new_code, auth.uid(), now() + interval '10 minutes');
  return new_code;
end;
$$;
grant execute on function create_telegram_link_code() to authenticated;

-- pg_cron: clean stale rows
select cron.schedule('telegram-pending-cleanup', '0 * * * *',
  $$delete from telegram_pending where created_at < now() - interval '1 hour';
    delete from telegram_link_codes where expires_at < now();$$);
```

**RLS audit:** `rls-auditor` agent runs once after migration is drafted.

### Telegram portfolio selection

A user can have multiple portfolios. The voice message has no portfolio context. **Rule:** `telegram_pending.portfolio_id` = user's primary portfolio (the one named "Ana Portföy" or, if missing, the oldest by `created_at`). The bot reply mentions it: "Portföy: Ana Portföy · Onayla?" so the user sees where it's going. Multi-portfolio Telegram routing is out of scope for v1.

## Frontend

### New component: `src/components/VoiceInput.js`

**Props:** `{ assetType, assetTypeHint, onParsed(transactions), flash_, disabled }`.

**State machine:**
```
idle → recording → preview → uploading → (parent renders ConfirmBox)
                     ↓
                  re-record → recording
```

**Markup (idle):**
```jsx
<div className="voice-input">
  <button className="voice-btn" onMouseDown={start} onMouseUp={stop}
          onTouchStart={start} onTouchEnd={stop}>
    🎙️
  </button>
  <div className="voice-hint">Basılı tut, konuş</div>
  <div className="voice-example">Örn: "10 Apple aldım 180 dolardan, IBKR"</div>
</div>
```

**Recording state:** red pulsing button, large monospace timer (`mm:ss`), 5-bar VU meter driven by `AnalyserNode.getByteFrequencyData`. Hard cap 60s → auto-stop.

**Preview state:** native `<audio controls src={blobUrl}>` so the user hears it back, then `[🔄 Yeniden] [✓ Gönder]`.

**Upload phase:** spinner with two labels — "Aktarılıyor…" (during base64 + POST) then "İşleniyor…" (server-side). Single `transcribe-audio` POST. On response, pass `transactions[]` up via `onParsed`; AddTab sets the existing `parsed` state and the existing ConfirmBox renders. **Transcript shown above ConfirmBox** as `<div className="voice-transcript">Duydum: "<i>{transcript}</i>"</div>` — gives user a visual sanity check before they tap Onayla.

**MediaRecorder details:**
- `navigator.mediaDevices.getUserMedia({audio:true})` with feature detect.
- Prefer `audio/webm;codecs=opus`; iOS Safari falls back to `audio/mp4`.
- Permission denied → `flash_("Mikrofon izni gerekli", "err")`.
- Recording <1s → `flash_("Çok kısa, biraz daha uzun konuş", "err")` and stay in idle.

**No autofocus**, no virtual-keyboard intrusion on mobile.

### AddTab integration

`src/components/AddTab.js`:
- Extend mode chips array to include `voice` after `image`, before `csv`.
- Add `MANUEL_ONLY_TYPES` check to hide `voice` for CASH/DEPOSIT (matches existing image/csv hiding). Also exclude BES.
- On `<VoiceInput onParsed={...}/>` callback, set `parsed` and (if returned by the edge fn) `transcript`. ConfirmBox renders unchanged.

### Settings: Telegram linking

`src/components/AccountSection.js` — new section "Telegram Bağla":

**Unlinked state:**
```jsx
<button onClick={genCode}>Bağlantı Kodu Oluştur</button>
{code && (
  <div className="tg-code-card">
    <div className="tg-code">{code}</div>
    <div className="tg-help">Bot: <code>@PortfoiBot</code> · <code>/link {code}</code> yaz · 10 dk geçerli</div>
    <button onClick={copyCode}>📋 Kopyala</button>
  </div>
)}
```

`genCode` calls `sb.rpc("create_telegram_link_code")`. Polls `telegram_links` row every 3s while code is visible (max 10 attempts) — when row appears, switches to linked state without page reload.

**Linked state:**
```jsx
<div className="tg-linked">
  ✓ Bağlı (Telegram: ····{lastFour(chat_id)})
  <button onClick={unlink} className="btn-danger-out">Bağlantıyı Kaldır</button>
</div>
```

`unlink` → `sb.from("telegram_links").delete().eq("user_id", user.id)` → confirm via `confirm_({danger:true})` first.

### CSS

Add to `src/styles/tokens.css` or `index.html` style block:

```css
.voice-btn { width:96px; height:96px; border-radius:50%; background:var(--info);
             color:#000; font-size:36px; border:none; cursor:pointer;
             touch-action:none; user-select:none; }
.voice-btn.recording { background:var(--err); animation:pulse 1.2s infinite; }
.voice-hint { font:500 11px/1 var(--font-body); color:var(--text2);
              text-transform:uppercase; margin-top:12px; }
.voice-example { font:300 13px var(--font-body); color:var(--text3); margin-top:4px; }
.voice-timer { font:var(--font-display); font-size:24px; color:var(--text); margin-top:8px; }
.voice-vu { display:flex; gap:3px; height:24px; align-items:center; margin-top:8px; }
.voice-vu span { width:4px; background:var(--info); transition:height .08s; }
.voice-transcript { font:300 13px/1.4 var(--font-body); color:var(--text2);
                    background:var(--bg3); padding:10px 12px; border-radius:6px;
                    margin-bottom:12px; border:1px solid var(--border); }
.voice-transcript i { color:var(--text); font-style:italic; }
@keyframes pulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.08)} }
```

## Error Handling Matrix

| Failure | PWA UX | Telegram UX | Rate-limit charged? |
|---------|--------|-------------|--------------------|
| Mic permission denied | flash_ "Mikrofon izni gerekli" | n/a | No (never hit server) |
| Recording <1s | flash_ "Çok kısa…" | n/a | No |
| Audio >60s | client guard, can't even send | Bot: "Çok uzun, max 60 saniye." | No |
| Audio >10 MB base64 | 413 client guard | n/a | No |
| Whisper 5xx / timeout | flash_ "Ses tanıma servisi yanıt vermiyor" | Bot: "Ses tanıma servisi yanıt vermiyor, tekrar dener misin?" | **Yes** (documented) |
| Whisper empty transcript | flash_ "Ses tanınamadı" | Bot: same | **Yes** |
| parse-transaction returns 0 tx | flash_ "İşlem bulunamadı" + show transcript | Bot: "Anlayamadım: '<transcript>'. Tekrar dener misin?" | **Yes** |
| Rate limit hit (>20/day) | flash_ "Günlük AI parse limitine ulaşıldı (20/gün)" | Bot: same | n/a |
| Telegram chat unlinked | n/a | Bot: "Bu chat bağlı değil. /link <kod>" | No |
| Telegram pending TTL expired (>1h) | n/a | Callback: "Önizleme süresi doldu, tekrar gönder." | No (just blocks save) |
| Telegram webhook secret mismatch | n/a | 401 silently, no reply | No |

## Testing

- `npm run check:babel` — parses new `VoiceInput.js`.
- `npm run check:edge` + `npm run check:edge-drift` — new `transcribe-audio.js` and `telegram-webhook.js` root mirrors must match `supabase/functions/<fn>/index.ts`.
- **`rls-auditor` agent** — run on the three new tables before SQL apply.
- **`edge-reviewer` agent** — run on both new edge fns before deploy.
- **Manual smoke (PWA):**
  - Pick US Hisse → Ses → hold "10 Apple aldım 180 dolardan" → release → see transcript + parsed preview → Onayla → Dashboard updates.
  - Multi-tx: "10 Apple aldım 180'den ve 5 Tesla sattım 250'den" → 2 transactions previewed.
  - BIST: "Aselsan'dan 100 lot aldım 80 liradan" → ticker resolves to ASELS, currency TRY.
  - Mic denied → graceful flash_.
  - 60s cap → auto-stop + send.
- **Manual smoke (Telegram):**
  - `/start` on fresh chat → onboarding reply.
  - Generate code in Settings → `/link <code>` → linked state appears in Settings within polling window.
  - Send voice → preview + inline keyboard → Onayla → bot edits message to "Kaydedildi" → Portfoi PWA reflects new tx after refresh.
  - İptal path.
  - Unlinked chat sends voice → rejection reply.

## Migration & Deploy Order

1. SQL migration (3 tables + RPC + cron) — apply, then run `rls-auditor`.
2. Set 3 new secrets in Supabase.
3. Create bot via @BotFather, capture token + username.
4. Deploy `transcribe-audio` edge fn (`--no-verify-jwt`).
5. Deploy `telegram-webhook` edge fn (`--no-verify-jwt`).
6. Register webhook URL with `secret_token` (one-time curl).
7. Frontend: `VoiceInput.js`, AddTab mode chip, AccountSection Telegram section, CSS.
8. Update docs: `CLAUDE.md` (edge fn list, new tables, new secrets), `FEATURE_DETAILS.md` (Voice section), `GOTCHAS.md` (Whisper rate-limit refund policy, Telegram pending TTL).
9. Smoke test both channels with `canmerter@me.com` test account.

## Open Questions (none blocking)

- Bot username `@PortfoiBot` — user creates this via @BotFather as a manual prerequisite; if taken, fall back to `@PortfoiAppBot` etc.
- Whisper cost: ~$0.006/min × 20 calls/day max = $0.12/day worst case. Negligible.
- If you ever want voice for CASH/DEPOSIT later, add a `voiceAllowed` flag to ADD_TYPES — not in v1.
