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
