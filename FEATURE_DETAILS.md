# Investment Ledger — Özellik Detayları

Bu dosya CLAUDE.md'nin referans verdiği implementasyon detaylarını içerir.
Sekme/provider üzerinde çalışırken okuyun.

---

## Returns Hesabı

Dashboard'daki 4 özet kart (hepsi **display currency**'de — toggle ile $ veya ₺):

| Kart | Değer | Period bağımlı |
|------|-------|---------------|
| Maliyet | Σ convert(shares × avg_cost, p.currency, displayCur) | Hayır |
| Piyasa Değeri | Σ convert(shares × current_price, p.currency, displayCur) | Hayır |
| Total Return | (MV + period_sells) − (start_MV + period_buys) | Evet |
| Yıllık (XIRR) | Cash-flow tabanlı IRR (yıllık) — sadece ≥1Y | Evet |

- **Total Return**: Realize + unrealize, komisyonlar dahil. Period seçilince start_MV `mvAtDate(period_start)` ile yaklaşık hesaplanır.
- **XIRR**: `<` 1 yıl periyotlarda kart "—" gösterir + "≥1Y için gösterilir" hint. Yanıltıcı extrapolation önlenir.
- Tüm kartlar `data-tip` attribute ile özel CSS tooltip'li.
- **FX kuru yok** durumunda `convert()` null döner; pozisyon toplama 0 olarak girer ama warn-card görünür.

---

## FX (Currency Conversion)

- **Provider**: Frankfurter API (`https://api.frankfurter.dev/v1/latest?from=USD&to=TRY,EUR`) — ECB resmi rates, auth-free, CORS-friendly.
- **State**: `fxRates = {USDTRY: 32.5, EURUSD: 1.08}`. Frankfurter `USD→EUR` döner; `1 / d.rates.EUR` ile invert.
- **Cache**: `LS.il_fx` 24h TTL (`fxCacheGet/Set`). Mount'ta + ↻ Güncelle ile tetiklenir.
- **Display Currency Toggle**: Topbar `.cur-seg` segmented buton (`$ ₺`); state `displayCur ∈ {"USD","TRY"}` LS persist (`il_disp_cur`).
- **Konvansiyon**: Ham pozisyon değerleri orijinal currency'sinde storage; sadece display sırasında convert. TickerDetailTab + HistoryTab orijinal currency'de kalır; Dashboard KPI + Sparkline + Pie + AnalysisTab convert eder.

---

## Currency Handling

- BIST → TRY (₺), US/global → USD ($), bazı pozisyonlar EUR (€).
- TickerDetailTab: `effectiveType = p?.type ?? assetTypeHint ?? "US_STOCK"`; `displayCurrency = p?.currency ?? (effectiveType==="BIST" ? "TRY" : "USD")`.
- Manuel form: type=BIST seçilince currency otomatik TRY.
- Storage: `transactions.price` ve `positions.avg_cost` ham değer; `currency` field ayrıca tutuluyor.
- MV hesaplarken (`mvDisp`, `allDisp`) `priceCur = p.type==="BIST"?"TRY":"USD"` kullan (price_cache: BIST→TRY Yahoo, diğer→USD Massive). Cost hesaplarken `p.currency` doğru.
- `rebuildPositions` normCur: `BIST→TRY`, `EUR→EUR`, diğer→`USD`.

---

## Price Provider Routing

`fetch-prices` edge function multi-provider. Frontend `asset_type` parametresini geçirir:

| asset_type | Provider | Notlar |
|------------|----------|--------|
| `US_STOCK` / `FUND` / default | Massive (Polygon clone) | `api.massive.com/v1/open-close`, `/v2/aggs`, `/v3/reference/tickers` |
| `CRYPTO` | Massive | ticker `X:BTCUSD` formatı |
| `FX` / `GOLD` | Massive | `C:USDTRY`, `C:XAUUSD` |
| `BIST` (price/hist) | Yahoo Finance unofficial | `query1.finance.yahoo.com/v8/finance/chart/THYAO.IS` — UA header gerek |
| `BIST` (meta) | Twelve Data + borsa-mcp paralel | `/stocks?exchange=XIST` + `borsamcp.fastmcp.app/mcp` `get_profile` |

### Massive.com Ticker Formatları

| Asset | Format | Örnek |
|-------|--------|-------|
| US hisse / ETF | direkt ticker | `AAPL`, `SPY` |
| Forex | `C:XXXYYY` | `C:USDTRY`, `C:EURUSD` |
| Crypto | `X:BTCUSD` | `X:BTCUSD`, `X:ETHUSD` |
| Spot altın | `C:XAUUSD` | (1 ons USD) |

### BIST Provider Mimarisi

- **Yahoo Finance** — auth-free, ~5 yıl stabil. `THYAO` → `THYAO.IS`. Edge function `User-Agent: Mozilla/...` gönderir.
- **Twelve Data /stocks reference** — free tier'da 636 BIST ticker (XIST). Sadece name/currency/type.
- **borsa-mcp** (saidsurucu/borsa-mcp, MIT, public hosted) — JSON-RPC over HTTP+SSE. 3-step handshake. Module-level session cache (auto re-init on 401/404). `get_profile` → sektör, industry, market cap, F/K, temettü yield, 52W high/low. Risk: tek dev instance; B planı self-host (Docker, Python 3.11).
- **İş Yatırım MaliTablo** — BIST fundamentals. `XI_29` itemCode mapping. 4 yıl/call → 5Y CAGR için 2 paralel call. Bankalar UFRS → `ISY_KNOWN_BANKS` ile early-exit.

### Search Tab Ticker DB

`fetch-fundamentals` mode:`"ticker-list"` → SEC EDGAR (~10.348 US) + Twelve Data /stocks XIST (~636 BIST) merged. Frontend artık Supabase `ticker_db` tablosundan SELECT eder (haftalık cron sync). LS cache `sec_ticker_db_v2` 24h TTL.

---

## Fundamental Veri (FMP + EDGAR + İş Yatırım)

- **US**: Primary FMP `/stable/` API; fallback SEC EDGAR (FMP 402 gelirse). `?symbol=AAPL` query param. Response: `key-metrics-ttm`, `ratios-ttm`, `income-statement` (5Y), `balance-sheet-statement` (1Y), `cash-flow-statement` (1Y).
- **BIST**: İş Yatırım MaliTablo — `XI_29` itemCode mapping (3C=revenue, 3D=grossProfit, 3DF=operatingIncome, 3L=netIncome, 1BL=totalAssets, 2N=equity, 2OCE=retained, 4B=D&A, 4C=OCF, 4CAI=capex, 4CB=FCF…).
- **21 metrik**: gelir/kâr 5Y CAGR, 4 marj (gross/op/net/FCF), ROE/ROA/ROIC, SG&A/D&A/faiz rasyoları, bilanço (yük/özk, birikmiş kâr/özk), faiz karşılama, net borç/FCF, CapEx 3 oran, P/E, P/S.
- **EDGAR mode kısıtı**: P/E ve P/S null. FY anchoring: `NetIncomeLoss`'un en yeni fy'si anchor.
- **İş Yatırım kısıtı**: P/E null (frontend `meta.pe_ratio` inject eder); bankalar blocklu. Anchor: `thisYear-1 → thisYear-2` probe; `3C` value1 dolu olan ilk yıl.
- **Source badge**: `source: "fmp"|"edgar"|"isyatirim"` — TickerDetailTab başlığında rozet.
- **Renk**: `FUND_THRESHOLDS` → `fundScore(key,val)` → `good`/`neutral`/`bad` pill.
- **Cache**: LS `fund_${ticker}` 7 gün TTL; BIST'te edge function instance Map 6h TTL.
- **Kapsam**: `US_STOCK` (held + discovery) + `BIST` (held + discovery, banka hariç). FUND/CRYPTO/GOLD'da hidden.

---

## Analiz Tab Kartları

Sticky pos.3 nav (Dashboard | İşlemler | **Analiz** | Ara | Ayarlar).

1. **Varlık Dağılımı** — Stacked horizontal bar + collapsible legend. Legend satırları: renk swatch · tür adı · % (tutar yok). Tür satırına tıklanınca ▸/▾ ile ticker drill-down açılır (>1 ticker varsa); sub-row: ticker · ad · within-type %. `expandedAssetType` state ile kontrol edilir. Filter chip kaldırıldı.

2. **Bölge Dağılımı** — `REGION_OF` map heuristik: `us` (US_STOCK+FUND), `tr` (BIST), `crypto`, `emtia` (GOLD), `fx`. Stacked bar + legend (sadece %). Kısıt: ETF underlying yok.

3. **Toplam Komisyon** — `byCurrency` KPI (₺/$/€ ayrı) + broker × currency bar + yıl bar. Collapsible detay. Multi-currency: `"$5.62 + ₺0.10"` join.

4. **Kazanan/Kaybeden Trade** — BUY+SELL bağımsız, split-adjusted. `adj = tx.price / factorAt(ticker, date)`. BUY win: `currentPrice > adj_buy`. SELL win: `currentPrice < adj_sell`. Stacked bar, noPrice tx atlanır.

5. **Portföy Sağlık Tablosu** — 8 metrik renk pill (P/E, ROE, Net/Op Marj, Gelir/Kâr 5Y, Borç/Özk, NetBorç/FCF) + ağırlıklı F/K KPI. Default kapalı + 🟢/🟡/🔴 rozet + Detay ▾. "Eksikleri Çek" CTA.

6. **Konsantrasyon Riski** — Top 3 ağırlık + renk pill (>60% kırmızı / 40-60% sarı). HHI basit (Σwi²×10000). Frontend hesabı.

7. **Sektör Dağılımı** — `metaCacheGet(ticker)?.sic_description || .industry`. Stacked bar + legend (sadece %). "Meta Çek" CTA. `sectorMetaTick` state ile reaktif re-render.

8. **Başa Baş Analizi** — komisyon dahil break-even fiyat + distPct%.

9. **Potansiyel Kayıp Simülasyonu** — %10/20/30 senaryo bar.

10. **Dönem Bazlı Getiri** — MV-ağırlıklı 1G/1H/1A/3A/6A/1Y portföy + SPY/XU100 benchmark.

11. **FX Risk** — USD/EUR/TRY dağılım bar + USDTRY +10% simülasyon.

12. **6 Aylık Performans** — p_m6 bazlı en iyi/en kötü 3 + ağırlıklı portföy getirisi.

13. **Temettü Özeti** — toplam DIV gelir KPI + portföy verimi + top-5 ödeyici bar (sadece DIV tx varken).

14. ~~**CAGR Tablosu**~~ — Kaldırıldı (2026-04-29). "İşlem tarihi yok" hatası; transactions BUY kaydından firstBuyDate okunamıyordu.

15. **Dayanıklılık Skoru** — liabToEquity + fcfMargin + operatingMargin → 1-10 puan, renk pill.

---

## Search Tab

- **Veri**: Supabase `ticker_db` tablosu (10.980 satır; haftalık `sync-ticker-db-weekly` pg_cron). LS cache `sec_ticker_db_v2` 24h TTL.
- **Match**: ticker prefix (büyük harf) + şirket adı substring (case-insensitive).
- **Render**: 2 bölüm — "Portföyünden" (held + geçmiş tx ticker'ları, "açık" badge) + "Tüm hisseler" (max 50 sonuç). Click → `openDetail(ticker)`.
- **Discovery mode**: TickerDetailTab `!p` durumunda pozisyon kartları gizli; `YOK` badge + warn-card + meta + fundamental + "+ Ekle" CTA. Live price auto-fetch edilir.
