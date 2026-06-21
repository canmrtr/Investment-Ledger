# Portfoi — Cache & localStorage Manifesti

Tüm önbellek katmanlarının **tek otoritesi**. Yeni bir cache (LS key veya server cache) eklerken önce buraya satır ekle; isimlendirme + TTL + scope politikasını buradan doğrula. CLAUDE.md, FEATURE_DETAILS.md ve GOTCHAS.md bu dosyaya işaret eder — key literal'lerini oralarda çoğaltma.

İlgili kod: `src/utils.js` (`LS`, `USER_SCOPED_LS_BASES`, `migrateUserLSKeys`, `clearUserLocalKeys`, `*CacheGet/Set` helper'ları).

---

## 1. User-scoped LS key'leri — `il_<base>_<userId>`

Kullanıcıya özel veri. Pattern: `il_<base>_<userId>` (SearchTab `il_recent_${userId}` ile aynı). Liste **`USER_SCOPED_LS_BASES`** (`src/utils.js`):

| Base key | TTL | Yazan / Okuyan | Notlar |
|----------|-----|----------------|--------|
| `il_prc` | session | App `loadData` | fiyat snapshot cache |
| `il_hist` | session | App | historical seri cache |
| `il_hide` | kalıcı | topbar 👁 toggle | gizli mod tercihi |
| `il_last_fetch` | — | App | son fiyat fetch zaman damgası |
| `il_nudge_dismissed` | kalıcı | Dashboard nudge kartları (`computeNudges`) | portföy-seviyesi nudge dismiss state `{id: expiryEpoch}` |
| `il_nudge_gain` | kalıcı | TickerDetailTab kazanç nudge'ı (Sprint 27) | per-ticker dismiss `{ticker: expiryEpoch}`; 30-gün sustur |
| `il_active_portfolio` | kalıcı | portföy seçici | aktif portföy id |
| `il_recent_${userId}` | kalıcı | SearchTab | son aranan ticker'lar (zaten suffix'li) |

- **Migration**: App mount'ta `migrateUserLSKeys(user.id)` legacy non-scoped key'leri user-scoped'a hoist eder (idempotent — sonraki render'larda no-op).
- **Temizlik**: **her** signOut handler'ı (Settings + hamburger) `clearUserLocalKeys` ile bunları siler — biri eksikse cross-user cache leak (bkz. GOTCHAS).

## 2. Device-pref global key'leri (user-agnostic, signOut'ta SİLİNMEZ)

| Key | TTL | Notlar |
|-----|-----|--------|
| `il_theme` | kalıcı | dark/light tema |
| `il_fx` | 24h | Frankfurter FX rates (`fxCacheGet/Set`) |
| `il_disp_cur` | kalıcı | display currency $/₺ |

Bunlar `clearUserLocalKeys` whitelist'inde — cihaz tercihi, kullanıcıdan bağımsız.

## 3. Paylaşımlı ticker-keyed cache'ler (prefix gerektirmez)

Kullanıcıdan bağımsız ticker datası — user-suffix yok, signOut'ta silinmez.

| Key pattern | TTL | Yazan / Okuyan | Notlar |
|-------------|-----|----------------|--------|
| `fund_${ticker}` | 7 gün | TickerDetailTab / AnalysisTab | fundamentals (`fundCacheGet/Set`) |
| `meta_${ticker}` | — | TickerDetailTab | sektör/industry meta (`metaCacheGet/Set`) |
| `il_divcal_${ticker}` | 24h | TickerDetailTab (Faz 1) + Dashboard (Faz 2) | temettü takvimi (`divCalCacheGet/Set`) — tek merkezi helper, çoğaltma |
| `il_etf_cw_${ticker}` | — | AnalysisTab (planlı) | ETF country-weighting |
| `sec_ticker_db_v3` | 24h | SearchTab | ~11k US+BIST ticker DB |
| `tefas_fund_db_v1` | 24h | SearchTab | ~3510 TEFAS fonu (5×1000 sayfalı fetch) |

## 4. Server / edge cache'leri

| Cache | TTL / Cron | Yazan | Notlar |
|-------|-----------|-------|--------|
| `price_cache` (Supabase) | pg_cron 6h (`refresh-price-cache-6h`) | `fetch-prices` (service_role) | frontend read-only; stale badge 24h eşikli (`isPriceStale`) |
| `fund_cache` (Supabase) | pg_cron haftalık (`refresh-fund-cache-weekly`) | `fetch-fundamentals` (service_role) | frontend read-only |
| `adr_bist_map` | 1h in-memory | `fetch-fundamentals` | OTC ADR→BIST eşlemesi; yeni satır Dashboard'dan, deploy gerekmez |
| BIST meta Map | 6h in-memory (edge instance) | `fetch-fundamentals` | İş Yatırım fundamentals instance cache |
| `tefas_funds` (Supabase) | `mode:"tefas-catalog"` (manuel/JWT) | `fetch-fundamentals` | ~3510 fon katalog; PostgREST 1000-satır limiti → okurken 5×1000 `range()` sayfala |

---

> **Yeni cache eklerken kontrol listesi:** (1) kullanıcıya özel mi → `USER_SCOPED_LS_BASES`'e ekle + signOut temizliğine dahil et; (2) cihaz tercihi mi → device-pref whitelist; (3) ticker datası mı → prefix'siz paylaşımlı; (4) sunucu tarafı mı → `price_cache`/`fund_cache` pattern'i (service_role write, frontend read-only). Her durumda bu manifeste bir satır ekle.
