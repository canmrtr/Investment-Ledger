# Gotchas

## Supabase / Edge Functions

- `SUPABASE_` prefix yasak — `SUPABASE_URL/ANON_KEY/SERVICE_ROLE_KEY` runtime'da otomatik gelir, `Deno.env.get` ile tekrar tanımlama.
- `cron.job_run_details`'da `jobname` kolonu yok — `jobid` ile `cron.job`'a join gerekir.
- `transactions.way` CHECK: `ANY(ARRAY['BUY','SELL','DIV'])` — `DIV` geçerli.
- Anon key frontend'de hardcoded OK; **service_role key kesinlikle gizli** — sadece edge fn.
- Tüm edge fn CORS: `"Access-Control-Allow-Origin": "https://canmrtr.github.io"` — yeni fn'de de aynı lock. Supabase Dashboard değil, response header'dan.
- Supabase CLI bağlantı: `npx supabase link --project-ref jfetubcilmuthpddkodg`
- Edge fn deploy yapısı: `supabase/functions/<fn-name>/index.ts` gerekli (`.js` + rename).
- `fetch-fundamentals` ticker regex: `^[A-Z0-9.\-]{1,12}$/i` — nokta ve tire dahil.

## Frontend / React

- **AI parse response shape**: edge fn her zaman `{transactions:[...]}` döner. Guard: `Array.isArray(d.transactions) ? ... : (d.ticker ? [d] : [])`.
- **`rebuildPositions` unit snapshot**: önce `SELECT ticker, unit FROM positions` ile `unitMap` al; rebuild sonrası `unit: unitMap[p.ticker] ?? null` restore et — aksi halde altın pozisyonları unit kaybeder.
- **`p.currency` vs price_cache**: `prc[ticker]` BIST→TRY, diğer→USD döner. MV hesabında `p.type==="BIST"?"TRY":"USD"` kullan; cost için `p.currency` doğru.
- **`periodChange` sanity check**: `cur/base < 0.05` → null (USD/TRY mix yakalanır).
- **TRY avgCost mismatch**: `currency="USD"` ama avg_cost TRY cinsindeyse wrapPos/periodChange yanlış hesaplar — kullanıcı USD fiyatıyla düzeltmeli.
- **JSX ternary IIFE**: orphaned `)` metin nodu bırakmamaya dikkat — babel check koş.
- **localStorage scope**: `il_hide/il_prc/il_hist` user-agnostic; signOut'ta temizlenir. `fund_*/meta_*/sec_ticker_db` public data, user-bound değil.
- CSV round-trip: virgül/tırnaklı alanlar için `csvEsc()` — "Apple, Inc" aksi halde parçalanır.
- Edge fn useEffect auto-fetch: `busy.h/p` guard korunmalı.
- XIRR `<1Y` yanıltıcı — UI bilinçli gizliyor.

## CSS / Layout

- **`.pie-row` kolon hizalama**: `flex:"0 0 70px"` ($) + `flex:"0 0 56px"` (%) sabit basis. `minWidth` yetmez — content > minWidth'te kayar. Label: `flex:1, minWidth:0`; truncate/ellipsis ekleme → "Hi…/ET…" regression.
- **`.fbar` filter chip bar**: wrapper'da `flexWrap:"wrap"` kullanma. `.fbar`: `overflow-x:auto; scrollbar-width:none`. `.fbar .mtab`: `flex:0 0 auto; white-space:nowrap`.
- **iOS Safari auto-zoom**: `font-size < 16px` input focus'ta zoom yapar. `max-width:640px` altında `input/textarea/select { font-size: 16px }`.
- `data-tip` kullan — native `title` tooltip Chrome/Safari'de 1-2 sn gecikmeli.
- **BIST `fmtD`**: hardcoded `$` döner — BIST için `fmtSign(n, sym)` kullan.
- **Yahoo Finance**: BIST ticker `THYAO.IS` formatı edge fn'de yapılır; frontend ham ticker geçer.
- **borsa-mcp**: ilk handshake ~500ms; 401/404'te oturum yeniler.

## Agent

- **test-runner write yetkisi**: `Write` toollu — "DO NOT modify any source files. Report only." talimatını explicit ver.
