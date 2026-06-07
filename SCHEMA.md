# Portfoi — Supabase Şeması

DB'nin **ne olduğu**: tablolar, RLS niyeti, RPC imzaları, pg_cron. (DB'nin seni **nasıl ısırdığı** — pitfall'lar — `GOTCHAS.md`'de.) Schema değişikliği sonrası `rls-auditor` agent'ını çağır; SQL için `sql-writer` skill'i.

## Tablolar

| Tablo | Scope | İçerik |
|-------|-------|--------|
| `positions` | user (RLS) | ticker, name, type, shares, avg_cost, currency, broker, unit (altın birimi: oz/g/quarter/half/full/republic), **portfolio_id FK**; `interest_rate numeric` (DEPOSIT yıllık oran, ör. 0.45), `maturity_date date` (DEPOSIT vade), `reserve_ratio numeric default 0` |
| `transactions` | user (RLS) | BUY/SELL/DIV kayıtları; `way` CHECK `ANY(ARRAY['BUY','SELL','DIV'])`; **portfolio_id FK** |
| `splits` | user (RLS) | ticker, split_date, ratio; **portfolio_id FK** |
| `profiles` | user (RLS, public read) | user_id PK, username, display_name, parse_calls_today/date (20/gün limit, `increment_parse_calls` RPC ile) |
| `price_cache` | paylaşımlı (service_role write only) | ticker PK, price + d1/w1/m1/y1 + p_d1…p_y1 + h_52w/l_52w (Sprint 22, closes-only) + updated_at |
| `portfolios` | user (RLS) | id PK, user_id FK, name, privacy_level (`full` \| `allocation_only`; `private` değer geçersiz); "Ana Portföy" backfill migration uygulandı |
| `watchlist` | user (RLS) | id PK, user_id FK, ticker, asset_type, added_at |
| `follows` | user (RLS) | follower_id + followee_id FK; Social Faz 1 altyapısı |
| `portfolio_activities` | user (RLS) | portfolio_id FK, activity_type, payload; Social Faz 1 altyapısı |
| `fund_cache` | paylaşımlı (service_role write only) | ticker PK, asset_type, metrics/annual/grades jsonb, source, updated_at |
| `adr_bist_map` | paylaşımlı (public read, service_role write) | adr_ticker PK, bist_ticker, name; OTC ADR→BIST eşlemesi; `fetch-fundamentals` 1h TTL ile cache'ler; yeni satır Supabase Dashboard'dan eklenir, deploy gerekmez |
| `tefas_funds` | paylaşımlı (public read, service_role write) | code PK, name, category, updated_at; TEFAS yatırım fonu kataloğu (~3500 fon); `fetch-fundamentals mode:"tefas-catalog"` ile doldurulur; SearchTab `tefas_funds` araması bundan beslenir |

`price_cache`: frontend read-only; tüm write `fetch-prices` service_role üstünden.
`fund_cache`: frontend read-only (anon+authenticated); tüm write `fetch-fundamentals` service_role üstünden.
`adr_bist_map`: frontend read-only; dashboard veya edge fn service_role ile yazılır.
`tefas_funds`: frontend read-only (anon+authenticated); tüm write `fetch-fundamentals` service_role üstünden.

> Önbellek TTL'leri + LS key'leri → `CACHE.md` (price_cache/fund_cache/adr_bist_map/tefas_funds satırları orada).

## pg_cron

- `refresh-price-cache-6h` — `0 */6 * * *`
- `refresh-fund-cache-weekly` — `30 3 * * 0` (Pazar 03:30 UTC)
- Her ikisi de `CRON_SECRET` Bearer header. Yeni job yazarken token'ı `vault.decrypted_secrets`'tan dinamik oku, string literal değil (bkz. Lessons 2026-05-19).

## DB RPC'leri (`sb.rpc(...)`)

- `rebuild_positions_atomic(p_user_id, p_portfolio_id, p_positions jsonb)` — `SECURITY INVOKER`; pozisyon DELETE+INSERT atomik tek transaction'da; `src/utils.js:rebuildPositions` tarafından çağrılır; `null` döner → hata.
- `get_allocation_only_positions(p_portfolio_id uuid)` — `SECURITY DEFINER`; `is_public+allocation_only` portföyler için `{ticker,name,type,pct}` döner; `avg_cost`/`shares`/`broker` hiçbir zaman döndürülmez; `authenticated` + `anon` grant'li.
- `bes_update_atomic(p_ticker text, p_total numeric, p_dk_current numeric)` — `SECURITY DEFINER`; `positions.dk_current` + `price_cache.price` aynı transaction'da güncellenir; ownership doğrulamasını `auth.uid()` ile yapar (BES tipi + caller'a ait pozisyon zorunlu). `BesUpdateModal` aylık güncellemede kullanır; `authenticated` grant'li.
- `increment_parse_calls(user_id)` — parse rate limit (20/gün), `SECURITY DEFINER`.

> Migration'ın DB'ye gerçekten uygulanıp uygulanmadığını `information_schema.columns` ile doğrula — dosya varlığı garanti değil (bkz. GOTCHAS).
