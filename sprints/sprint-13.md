# Sprint 13 — 2026-05-11 → 2026-05-24

**Goal**: Can, Portföy Sağlık sinyallerini Dashboard'da proaktif ve bütüncül olarak görür; aylık performansını tek tuşla kopyalayabilir; ETF pozisyonlarının gerçek bölgesel dağılımını anlık izler.

**Capacity**: 2 hafta × ~6h/hafta efektif ≈ ~12h toplam (hafta sonu + akşam)

---

## Bağlam: Sprint 12 Retro

Sprint 12, Audit Fixes bundle'ı tamamen teslim etti:

- **High #1** — `positions_allocation_read` RLS policy kaldırıldı; `get_allocation_only_positions` SECURITY DEFINER RPC ile avg_cost/shares/broker sızıntısı kapatıldı.
- **High #2** — `rebuild_positions_atomic` PL/pgSQL RPC; DELETE+INSERT artık tek transaction, kısmi ledger durumu imkansız.
- **Medium #1** — ManuelPosForm `rebuildPositions` yolundan geçiyor; `delPos` tüm tx'leri siliyor.
- **Medium #2** — `fetch-prices` JWT zorunlu + `edgePriceCall` wrapper tüm çağrı noktalarında.
- **Medium #3** — public portföy allocation RPC üstünden geçiyor, raw shares pct açığı kapatıldı.

Migrations 011+012 apply edildi, `fetch-prices` deploy edildi. Sprint 12 kısa tutuldu (tek milestone) çünkü güvenlik düzeltmelerinin yanlış gitmesi durumunda rollback alanı bırakılmak istendi — doğru karar, tüm öğeler teslim edildi.

---

## Scope

### 1. Akıllı Nudge (c) — Sağlık + XIRR kuralları + AnalysisTab scroll aksiyonu `[S][P2]`

**Roadmap satırı**: `Akıllı Öneriler & Nudge Sistemi → "Akıllı Nudge Kartları" → (c) alt-task`

**Neden bu sprint**: Sprint 11'de (a)+(b) teslim edildi — `computeNudges()` fonksiyonu ve Dashboard render/dismiss mekanizması çalışıyor. (c) sadece 2 kural ve 1 UX bağlantısı ekliyor; bağımsız, düşük risk. Sprint 12'de Audit Fixes öncelik aldığından ertelendi. Artık devreden devreye alınmalı.

**Alt-task'lar**:

- `[P2-Nudge]` Sağlık skoru kuralı: PortföySağlık lazy-fetch'ten gelen `healthData` state'inde 3+ kırmızı metrik varsa nudge tetiklenir ("X hissenin sağlık göstergelerinde dikkat gerektiren metrikler var — Analiz sekmesine git"). Sağlık verisi yoksa (henüz fetch edilmemişse) bu nudge atlanır — safe fallback.
- `[P2-Nudge]` XIRR kuralı: `xirr < 0.40` (TRY bazlı kullanıcı için enflasyon proxy eşiği) → "Portföy getirisi enflasyonun altında kalıyor olabilir". USD kullanan kullanıcıda `xirr < 0.05` eşiği; `displayCur` ile tespit.
- Nudge kartına aksiyon linki: `actionTab:"analysis"` + `actionCard:"health"` — tıklayınca AnalysisTab'a geçip Portföy Sağlık kartına scroll.
- `computeNudges` signature güncellenmesi: `(positions, transactions, healthData, xirr, displayCur)` — mevcut (a)+(b) callback'leri kırmadan eklenir.

**DoD**:
- `computeNudges` 5 nudge kuralını da içeriyor; birim test edilebilir saf fonksiyon.
- Dashboard'da "Analiz'e Git" linki tıklanınca AnalysisTab açılıyor ve Portföy Sağlık kartı görünüyor.
- XIRR yoksa veya sağlık verisi yoksa ilgili nudge'lar atlanıyor.
- `ui-builder` agent nudge card scroll UX'ini onaylıyor.

**Risk**: PortföySağlık lazy-fetch (kullanıcı Analiz sekmesini hiç açmamışsa `healthData` null). Çözüm: null kontrolü — nudge atlanır, crash yok. XIRR eşiği sabit (%40 TRY, %5 USD); kullanıcıya açıkça "tahmini" notu.

---

### 2. Aylık Özet Kopyala / Paylaş `[S][P2]`

**Roadmap satırı**: `Otomasyon & Raporlama → "Aylık Performans Özetini Kopyala / Paylaş"`

**Neden bu sprint**: Sıfır backend, sıfır yeni tablo, sıfır edge function. `navigator.clipboard.writeText()` ve mevcut `price_cache` + `transactions` verisinden üretilecek metin. Sprint 10'dan beri "freebie" olarak bekliyor; Sprint 11 ve 12'de kapasiteye sığmadı. Sprint 13'te Item 1 ve 3 arasında nefes alanı olarak burada.

**Nasıl**:
- AnalysisTab veya Dashboard'da "Aylık Özet" butonu (veya `⎘` kopyala ikonu).
- Üretilen metin formatı: `"Mayıs 2026: Portföy +%X.X · SPY +%Y.Y · XU100 +%Z.Z\nEn iyi: AAPL +%12.3 · En kötü: GARAN -%4.1"`.
- Hesaplama: mevcut `filteredPos` + `prc` + benchmark period getiri verisinden. Tüm veriler Dashboard state'inde zaten mevcut.
- Clipboard başarısızsa (tarayıcı izni) → flash_("Kopyalanamadı", "err") + metin modal'a düşer.

**DoD**:
- AnalysisTab üstünde veya Dashboard'da "Özeti Kopyala" butonu mevcut.
- Tıklanınca `navigator.clipboard.writeText()` çağrılır; başarıda flash_("Kopyalandı", "ok").
- Kopyalanan metin sosyal medyaya yapıştırıldığında okunabilir, Türkçe.
- Fiyat verisi yoksa (tüm prc boş) buton disabled + data-tip "Fiyat verisi bekleniyor".
- Gizli mod (hide=true) aktifken tutar rakamları çıkmaz; sadece yüzdeler gösterilir.

**Risk**: `navigator.clipboard` HTTPS gerektirir; GitHub Pages + Supabase ortamında sorunsuz. iOS Safari bazı sürümlerde kısıtlı — fallback olarak metin `<textarea>` modal'da seçili gösterilir.

---

### 3. ETF Bölge Dağılımı (underlying country weights) `[M][P2]`

**Roadmap satırı**: `Görselleştirme → "ETF Bölge Dağılımı (underlying country weights)"`

**Neden bu sprint**: VT, VWO, EEM gibi ETF'ler şu an Bölge Dağılımı'nda "us" bucket'ına düşüyor. Can'ın US portföyünde ETF ağırlığı varsa bölge analizi yanıltıcı. FMP `/stable/etf/country-weightings` endpoint'i; yeni API key gerekmez. Plan dosyası mevcut: `/Users/canmerter/.claude/plans/kullan-c-n-n-kendi-e-iklerini-girece-i-compressed-coral.md`. Item 1 ve 2 birlikte ~5-6h — Item 3 kalan kapasiteyi (5-6h) kullanır.

**Nasıl**:
- `fetch-fundamentals` edge fn'a `mode:"etf-country"` dalı: `tickers[]` array → FMP country-weightings → `{VT: {us:55, eu:24, "asia-pac":12, em:7, other:2}}` normalize.
- 90 gün LS cache: `il_etf_cw_<ticker>`.
- AnalysisTab Bölge Dağılımı hesabında: FUND tipi pozisyon varsa önce LS cache'e bak; yoksa lazy-fetch + "Yükleniyor..." skeleton; gelince Bölge pie güncellenir.
- `COUNTRY_REGION` haritası (~60 ülke → 5 bucket) `src/constants.js`'e eklenir.
- Eşleşme yoksa (FMP'de o ETF yoksa veya BIST fonuysa) "us" fallback korunur.

**DoD**:
- VT, VWO, EEM için Bölge Dağılımı pie'ı FMP country-weightings'ten doğru dağılımı gösteriyor.
- Yeni fetch 90 gün LS cache'de; aynı seans içinde ikinci kez açılmaz.
- FUND tipi olmayan portföyde bu fetch tetiklenmez.
- BIST_FUND (tefas) tipi için "us" fallback çalışıyor, warn-card çıkmıyor.
- `edge-reviewer` ve `ui-builder` agent sign-off zorunlu.

**Risk**: FMP free tier country-weightings endpoint limiti (günlük 250 req). Mitigasyon: 90 gün cache ile her kullanıcı ticker başına yılda 4 kez fetch — düşük risk. FMP boş dönerse fallback "us" — kullanıcı fark etmez, silent fail kabul edilebilir.

---

### 4. İş Yatırım fetch timeout `[S][P2]` — Güvenlik Hızlı Kazanım

**Roadmap satırı**: `Bug & UX Backlog → "İş Yatırım fetch timeout"`

**Neden bu sprint**: Tek satır değişiklik — `AbortSignal.timeout(8000)` eklenmesi. `fetch-fundamentals` edge fn'da isyatirim call'larında timeout yok; ağ askısında edge fn 25 sn süre sonu bekliyor. Sprint 11 denetim turunda tespit edilmişti, Sprint 12'de Audit Fixes öncelik aldığından kalmıştı. Küçük güvenlik düzeltmesi — sprint sonuna eklenecek.

**DoD**:
- `fetch-fundamentals`'daki tüm isyatirim fetch call'larında `AbortSignal.timeout(8000)` mevcut.
- `edge-reviewer` agent sign-off zorunlu (deploy öncesi).
- Timeout'ta `{error:"isyatirim_timeout"}` flag döner; frontend mevcut null-safe handling'i alır.

**Risk**: isyatirim endpoint 8 saniye altında cevap vermiyorsa kullanıcı zaten boş veri alıyordu — behavior değişmiyor, sadece artık log'a timeout yazılıyor.

---

## Out of Scope (bilinçli ertelenenler)

- **Kullanıcı tanımlı fundamental eşikler (Settings formu)** `[M][P2]`: Plan dosyası mevcut ama bu sprint ETF Bölge Dağılımı ile kapasiteyi dolduruyor. Sprint 14 adayı.
- **Social Portfolios Faz 2** `[M][P2]`: Faz 1 altyapısı hazır; Nudge + ETF item'ları önce çünkü daha yüksek daily-driver değeri var. Sprint 14 adayı.
- **Ağırlıklı Ortalama Portföy P/E** `[S][P2]`: Fundamentals cache üzerinden saf aggregation; ertelenmiş. Sprint 14 freebie adayı.
- **Piyasa Dayanıklılık Skoru** `[M][P2]`: Fundamentals cache'e bağımlı; ETF Bölge Dağılımı ile aynı sprint'e sığmıyor.
- **Kazanç Takvimi (Earnings Calendar)** `[S][P3]`: P3 öncelik; FMP endpoint hazır ama bu sprint P2 item'larla dolu.

---

## Demo / Validation

Sprint sonu başarı sinyalleri:

1. **Nudge (c)**: PortföySağlık kartında 3+ kırmızı metrik olan test portföyünde Dashboard'da "Analiz'e Git" linkli sağlık nudge'ı çıkıyor; link tıklanınca AnalysisTab Portföy Sağlık kartına scroll yapıyor. Sağlık verisi yoksa nudge çıkmıyor (crash yok).

2. **Aylık Özet**: Dashboard'da veya AnalysisTab üstünde "Özeti Kopyala" butonu var; tıklayınca clipboard'a metin gidiyor; flash_("Kopyalandı", "ok") görünüyor; kopyalanan metin sosyal medyaya yapıştırılabilir Türkçe format.

3. **ETF Bölge Dağılımı**: VT için Bölge Dağılımı kartı "%55 ABD, %24 Avrupa, %12 Asya-Pasifik" gibi gerçek ağırlıkları gösteriyor (şu an %100 ABD görünüyordu). SPY (saf US) için sonuç değişmiyor. BIST_FUND tipi için "us" fallback çalışıyor.

4. **isyatirim timeout**: BIST fundamental çekme işlemi artık 8 saniyeden uzun sürmüyor; edge fn asılı kalmıyor. (Geliştirici doğrulaması: Supabase Edge Function log'larında timeout flag görünüyor.)

---

## Sprint 14 için Notlar

- **Kullanıcı tanımlı fundamental eşikler** — plan dosyası hazır, Settings form UI gerekiyor `[M][P2]`
- **Social Portfolios Faz 2** — `UserProfileModal` + `is_public` toggle + RLS read policy `[M][P2]`
- **Ağırlıklı Ortalama Portföy P/E** — fundamentals cache aggregation, freebie `[S][P2]`
- **Piyasa Dayanıklılık Skoru** — `resilienceScore()` + AnalysisTab kart `[M][P2]`
- **Periyodik agent denetim turu — 4. tur** — Sprint 11'den bu yana 3 sprint geçecek; Sprint 14'te zamanlaması uygun `[S][P1]`

---

## Retro Alanı

Sprint 13 tüm scope'u teslim etti. Akıllı Nudge (c) — health_score ve xirr_low kuralları + AnalysisTab Portföy Sağlık kartına scroll aksiyonu — en küçük ama en çok UX değer katan item oldu; scroll delay ve topbar offset düzeltmeleri dahil 5 commit'te kapandı. Aylık Özet (MonthlySnapshotCard) sıfır backend ile teslim edildi; PNG kart indirme ve iOS Safari textarea fallback dahil. ETF Bölge Dağılımı sprint'in ağır işiydi: brainstorm → design spec → implementation plan → 6 task × subagent-driven-development akışıyla yürütüldü; edge-reviewer ve ui-builder agent sign-off alındı; regex guard bugı review döngüsünde yakalanıp düzeltildi. İş Yatırım timeout sprint başında zaten mevcut bulundu. Sprint kapasitesi verimli kullanıldı; hiç erteleme olmadı.
