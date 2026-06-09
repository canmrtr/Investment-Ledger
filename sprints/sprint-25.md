# Sprint 25 — 2026-06-05 → 2026-06-18

**Goal**: Can bir hisseye bakarken "bu şirket sağlam mı, pahalı mı?" sorusuna 21 metriği tek tek okumadan, plain-language özet cümleyle yanıt alır; portföyünün toplam F/K'sını S&P 500 ile kıyaslayan tek satırlık sinyal görür.

**Capacity**: 2 hafta × ~6h/hafta efektif (~12h) — akşam + hafta sonu.

## Scope

1. **Fundamental Checklist → özet + detay modeli** — ROADMAP "Brand Fit & Jargon" `[M]` `[P2]` (headline)
   - Neden bu sprint: Value-investing core fit + günlük-driver delta. Sprint 19/23'te kurulan "önce sonuç cümlesi" verdict pattern'inin (Portföy Sağlık / Konsantrasyon / Kur Riski / Dayanıklılık) doğal devamı — şimdi TickerDetailTab'ın 21-metrik checklist'ine taşınıyor. **Yeni provider yok**: `fund_cache` zaten 21 metrik + grades tutuyor; sadece render katmanı eklenir.
   - DoD:
     - TickerDetailTab'da fundamental checklist'in ÜSTÜNDE plain-language özet satırı: "Kârlılık güçlü · Borç makul · Değerleme pahalı" formatında, mevcut `FUND_GROUPS` grades'inden türetilir (yeni eşik tanımlama yok — grade rollup).
     - Özet satırı sinyal renkli (🟢/🟡/🔴 mantığı, mevcut grade renkleriyle); her segment ilgili metrik grubunu temsil eder.
     - Mevcut 21-metrik grupları özetin altında **detay** olarak aynen kalır (kaldırma yok, sadece üstüne özet eklenir).
     - US_STOCK + BIST için çalışır; `fund_cache` boşsa özet satırı gizli (mevcut checklist davranışıyla tutarlı).
   - Risk: Grade rollup mantığı (hangi grup hangi özet segmentine maps) belirsizse özet yanıltıcı olur. Mitigation: `FUND_GROUPS` 7 başlığını 3-4 özet segmentine (Kârlılık / Değerleme / Borç / Büyüme) deterministik map'le; eşik üretme, sadece mevcut grade'leri topla.

2. **Ağırlıklı portföy F/K KPI + S&P 500 karşılaştırma cümlesi** — ROADMAP "Karşılaştırma" `[S]` `[P2]`
   - Neden bu sprint: #1 ile aynı `fund_cache` altyapısını yeniden kullanır (DRY value-add) ve AnalysisTab Portföy Sağlık kartının zaten var olan "Portföy F/K KPI" satırını anlamlandırır. **Yeni fetch yok.**
   - DoD:
     - AnalysisTab Portföy Sağlık'ta MV-ağırlıklı portföy F/K KPI'nın yanında karşılaştırma cümlesi: "Portföyünün F/K'sı 18.4 — S&P 500 ortalamasının (~22) altında."
     - S&P 500 referansı hardcoded sabit (~22, kod içinde yorum satırıyla kaynağı + tarih notu).
     - F/K hesaplanamayan pozisyonların (banka/BIST eligibility dışı, fund_cache boş) atlanma sayısı küçük not olarak gösterilir.
     - Cümle sinyal renkli: altında 🟢, civarında 🟡, belirgin üstünde 🔴.
   - Risk: Atlanan pozisyon oranı yüksekse ağırlıklı F/K yanıltıcı olur. Mitigation: kapsanan MV oranı %60'ın altındaysa "kısmi veri" uyarısı ekle.

3. **Polish filler — Design audit Phase-2 kalanı** — ROADMAP "Brand & Design" `[S×2]` `[P2]`
   - Neden bu sprint: Headline işlerden artan yarım gün için düşük-risk doldurma. Sprint 21 carry-over'ından kalan son iki madde.
   - DoD:
     - #9 Tooltip tutarlılığı: `data-tip` kullanımları tek pattern'e hizalanır; touch'ta çalışmayan tooltip'ler için (Sağlık Tablosu 🟢🟡🔴) inline metin fallback'i eklenir.
     - #7 Kart/panel padding konsolidasyonu: `.card` / AnalysisTab / Dashboard arasındaki `12/14/16/18px` padding karmaşası tek `--card-pad` token'a indirilir (ROADMAP "Kart padding standart dışı" item'ıyla aynı iş).
   - Risk: Padding token değişimi tüm kartları etkiler — görsel regresyon riski. Mitigation: token'ı mevcut en yaygın değere (`12px 14px`) sabitleyip Playwright/manuel hard-reload ile birkaç ekran doğrula.

## Out of Scope (bilinçli ertelenenler)

- **Sektör-aware F/K eşikleri** `[M]` `[P1]` — Aday havuzu #1'in üçüncü parçasıydı, Sprint 26'ya bırakıldı. `sic_description`/FMP `sector` ile profil seçimi + TR enflasyonu CAGR eşik etkisi ayrı bir headline'lık iş; özet+detay modeli oturmadan eşik kişiselleştirmesi erken. #1'in özet segmentleri bu iş gelince zenginleşir.
- **Layer-2 davranışsal nudge** (aday #2) ve **TEFAS historical NAV + sparkline** (aday #3) — Sprint 26+ adayı olarak havuzda kalır; #3 önce Can'ın gerçek TEFAS kullanım feedback'ini bekler.

## Demo / Validation

- Canlı kullanım: held bir US hissesine (ör. AAPL) ve bir BIST hissesine TickerDetailTab'dan bak → checklist üstünde özet cümlesi görünüyor mu, detay gruplar yerinde mi?
- Edge case: `fund_cache` boş bir ticker (yeni eklenen) → özet gizli, hata yok. BIST bankası (GARAN) → eligibility dışı, özet gizli (mevcut `isFundEligible` davranışı korunur).
- AnalysisTab → Detaylı Analiz aç → Portföy Sağlık'ta F/K KPI yanında karşılaştırma cümlesi + atlanan pozisyon notu doğru sayıyor mu?
- Başarı sinyali: Can bir hisseye bakıp 21 metriği tek tek okumadan "sağlam mı / pahalı mı" kararını 5 saniyede verebiliyor.

---

## Delivered (2026-06-09)

Üç kapsam işi de kodlandı, `npm run check:babel` (14 OK) + saf-fonksiyon Node testi + dashboard görsel kontrolü ile doğrulandı. Sandbox dış ağa çıkamadığı için **canlı fund/F/K render'ı GitHub Pages deploy sonrası hard-reload ile doğrulanacak**.

**#1 Fundamental Checklist özet satırı** — `TickerDetailTab.js`
- `FUND_SUMMARY_MAP` (7 grup → 4 segment: profit/growth/debt/value) + `FUND_SUMMARY_SEGMENTS` (etiket + iyi/orta/zayıf kelimeleri) + `buildFundSummary(metrics)`.
- Rollup: her segmentin metrik skorları (good=1, neutral=.5, bad=0) ortalanır → iyi≥.66 / orta≥.4 / zayıf. Skorlanabilir metriği olmayan segment atlanır (özet boşsa hiç render edilmez).
- Render: legend ile `FUND_GROUPS.map` arası, `var(--bg3)` pill; sinyal noktası + `Label` (text2) + **word** (segment renginde). `data-tip` ile açıklama.
- Node testi: strong→hepsi yeşil; expensive→Kârlılık güçlü/Büyüme·Borç·Değerleme kırmızı; empty→`[]`; only-value→tek segment. ✓

**#2 Ağırlıklı portföy F/K + S&P 500** — `AnalysisTab.js`
- Önceki binary `below?ok:warn` → 3-durumlu: `ratio = portfolioPE/SP500_PE`; <0.9 🟢 "altında" / ≤1.1 🟡 "civarında" / >1.1 🔴 "belirgin üstünde".
- `SP500_PE=22` kaynak+tarih yorumlu sabit. Plain-language cümle + `included pozisyon dahil · kapsanan değer %X` notu.
- `coverage = weightTotal / mvAll`; <%60 ise sarı "kısmi veri" uyarısı (ağırlıklı F/K yanıltıcı olabilir).

**#3 Polish** — `index.html` + `TickerDetailTab/AnalysisTab/App.js`
- `--card-pad:14px 16px` token (`:root`). Baskın `padding:"14px 16px"` (18 inline override) → `var(--card-pad)`; değer aynı → görsel no-op (dashboard screenshot doğrulandı).
- #9: `src/components`'te native `title=` yok; touch tooltip `App.js` global `touchstart` handler'ı ile zaten çalışıyor → ek iş gerekmedi. Sağlık badge'leri zaten inline sayı gösteriyor.
- Bilinçli ertelenen: `.card` base (`12px 14px`) + `16px 18px` Dashboard KPI paddingleri token'a çekilmedi (görsel değişiklik → ayrı onay).

## Kalan
- Canlı (GitHub Pages) render doğrulaması: AAPL/BIST TickerDetail özet satırı + AnalysisTab F/K cümlesi gerçek `fund_cache` verisiyle.
