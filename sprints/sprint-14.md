# Sprint 14 — 2026-05-10 → 2026-05-23

**Goal**: Can, uygulamayı açtığında kırık logo yerine doğru markayı görür; Watchlist crash'i ve Search autofocus sorunu giderilmiş olur; 4. denetim turu güvenlik net'ini tazeler; portföyünün ağırlıklı P/E'sini anlık görür; AnalysisTab'daki jargon sonuç cümlelerine dönüşür.

**Capacity**: 2 hafta × ~6h/hafta efektif ≈ ~12h toplam (hafta sonu + akşam)

---

## Bağlam: Sprint 13 Retro

Sprint 13 tüm scope'u teslim etti. Akıllı Nudge (c) — health_score ve xirr_low kuralları + AnalysisTab Portföy Sağlık kartına scroll aksiyonu — en küçük ama en çok UX değer katan item oldu; scroll delay ve topbar offset düzeltmeleri dahil 5 commit'te kapandı. Aylık Özet (MonthlySnapshotCard) sıfır backend ile teslim edildi; PNG kart indirme ve iOS Safari textarea fallback dahil. ETF Bölge Dağılımı sprint'in ağır işiydi: brainstorm → design spec → implementation plan → 6 task × subagent-driven-development akışıyla yürütüldü; edge-reviewer ve ui-builder agent sign-off alındı; regex guard bugı review döngüsünde yakalanıp düzeltildi. İş Yatırım timeout sprint başında zaten mevcut bulundu. Sprint kapasitesi verimli kullanıldı; hiç erteleme olmadı.

---

## Scope

### 1. Login Logo Swap → Linear Varyant `[XS][P1]`

**Roadmap satırı**: Sprint 14 yeni item — Can'ın eklediği.

**Neden bu sprint**: `src/components/Login.js` şu an var olmayan `logo-full-dark.png` dosyasına referans veriyor; ekran kırık. `Logo/Linear Dark.png` + `Logo/Linear Light.png` dosyaları zaten mevcut. Dakika cinsinden fix; en yüksek görünürlük → önce biter.

**Acceptance Criteria**:
- Login ekranı dark temada `Logo/Linear Dark.png` gösterir; light temada `Logo/Linear Light.png` gösterir.
- `src/components/Login.js` içindeki `logo-full-dark.png` referansı kaldırılmış, doğru dosya yolları ile değiştirilmiştir.
- CSS `.theme-logo-dark` / `.theme-logo-light` selector'ları (veya inline `[data-theme]` kontrolü) ile otomatik geçiş çalışır — JS gerekmez.
- `CLAUDE.md` "Logo dosyaları" notu güncellenir: "login'de 240px Linear varyant (`Logo/Linear Dark.png` / `Logo/Linear Light.png`)" bilgisi eklenir.
- Mobil + masaüstü, dark + light dört kombinasyonda görsel test geçer.

**Touched files**: `src/components/Login.js`, `CLAUDE.md`

**Risk**: Dosya yolu case-sensitivity; GitHub Pages Linux sunucusunda `Logo/Linear Dark.png` path'inin boşluk içermesi → URL encode (`Logo/Linear%20Dark.png`) veya dosya adı rename gerekebilir. Mitigation: `npx serve .` ile yerel test et, deploy öncesi kontrol et.

---

### 2. UX Audit Quick Fixes (Grup H) `[S][P1]`

**Roadmap satırı**: `Bug & UX Backlog → "UX/UI Gaps" → Grup H`

**Neden bu sprint**: Üç sorun birbirinden bağımsız, her biri <30 dk. Watchlist crash kullanıcıyı engelliyor (P1 bug); diğerleri polish. Item 1'den sonra yapılır çünkü Login zaten açık.

**Alt-task'lar**:

- **H-1 Watchlist `confirm_` crash**: Watchlist "Çıkar" butonunda `window.confirm` yerine async `confirm_()` çağrısı; `await` eksikse çöküyor. `src/components/WatchlistTab.js` ilgili handler'ı `async` yapılır ve `await confirm_(...)` eklenir.
- **H-2 Login logo touch target**: Login logosu tıklanabilir alan küçük; minimum 44×44px touch hedefi (WCAG 2.5.5). CSS `min-height: 44px; min-width: 44px` veya wrapper `<button>` (eğer logo tıklanabilir değilse, gereksiz `cursor:pointer` kaldırılır).
- **H-3 Search mobil autofocus**: `SearchTab` mount'ta `input.focus()` çağrısı mobilde klavyeyi anında açıyor → istenmeyen UX. `if (!('ontouchstart' in window)) input.focus()` koşuluyla sadece desktop'ta autofocus yapılır.

**Acceptance Criteria**:
- Watchlist "Çıkar" işlemi confirm dialog açıyor, onaylanınca siliniyor; crash yok; `await` eksikliği ESLint/Babel parse'da yakalanıyor.
- Login ekranında logo touch alanı ≥ 44px (devtools ile ölçülebilir veya gözlemsel).
- SearchTab mobil Chrome'da açıldığında klavye otomatik çıkmıyor; masaüstü Chrome'da focus kalıyor.
- `ui-builder` agent değişiklikleri onaylıyor (görsel regresyon yok).

**Touched files**: `src/components/WatchlistTab.js`, `src/components/Login.js` (touch target), `src/components/SearchTab.js`

**Risk**: H-3 için `ontouchstart` feature detect her platformda mükemmel değil (iPad); kabul edilebilir — tablet üzerinde klavye açılması zararlı değil.

---

### 3. Periyodik Agent Denetim Turu — 4. Tur `[S][P1]`

**Roadmap satırı**: Sprint 11'de planlanan rota; "Sprint 14'te zamanlaması uygun" notu sprint-13.md'de.

**Neden bu sprint**: Sprint 11'den bu yana 3 sprint geçti. Bu sürede eklenenler: ETF Bölge Dağılımı (`mode:"etf-country"` dalı), `rebuild_positions_atomic` RPC, `get_allocation_only_positions` SECURITY DEFINER RPC, `fund_cache` pg_cron haftalık cron, Brand Kit token migrasyonu. Tümünün güvenlik gözünden geçirilmesi gerekiyor.

**Kapsam**:

- `rls-auditor` — `fund_cache` (anon read), `follows`, `portfolio_activities`, `portfolios` policy'leri (Sprint 11 kalıntısı + yeni eklemeler). Özellikle `fund_cache` anon grant'inin kapsamını kontrol et.
- `client-security-auditor` — ETF Bölge Dağılımı LS cache okuma/yazma; `fund_cache` frontend query; Brand Kit token migrasyonu sonrası olası XSS noktaları.
- `edge-reviewer` — `fetch-fundamentals` `mode:"etf-country"` dalı; `mode:"refresh-fund-cache"` cron dalı; `parse-transaction` image path.
- `test-runner` (opsiyonel, kapasite varsa) — "DO NOT modify any source files. Report only." talimatıyla çalıştır; kritik regresyon raporu.

**Acceptance Criteria**:
- `rls-auditor` `fund_cache` anon read policy'yi onaylıyor veya düzeltme önerisi var.
- `client-security-auditor` ETF Bölge Dağılımı LS cache'indeki ticker key injection riskini değerlendirdi.
- `edge-reviewer` `fetch-fundamentals` yeni dallarında timeout, error handling ve rate limit koruması doğruladı.
- Bulunan tüm yüksek/kritik bulgular `ROADMAP.md → Bug & UX Backlog` altına eklendi ve P-tag verildi.
- Düşük öncelikli bulgular Sprint 15 backlog'una not düştü.

**Touched files**: Yalnızca `ROADMAP.md` (bulgular); kaynak dosyalar denetim turu kapsamında değiştirilmez — düzeltmeler ayrı item olarak önceliklendirilir.

**Risk**: Denetim turu bulgu sayısına göre kapsamı Sprint 14 içinde tüketebilir. Mitigation: kritik bulgular bu sprint'te düzeltilir; medium/low Sprint 15'e ertelenir.

---

### 4. Ağırlıklı Ortalama Portföy P/E `[S][P2]`

**Roadmap satırı**: Sprint 13 "Sonraki Adım" listesi — "Ağırlıklı Ortalama Portföy P/E — fundamentals cache aggregation, freebie."

**Neden bu sprint**: `fund_cache` tablosu US hisseler için `metrics.pe` verisini zaten içeriyor; sıfır yeni API çağrısı, sıfır yeni edge function. Saf frontend aggregation. Sprint 14 kapasitesinin nefes aldığı yer.

**Nasıl**:
- `positions` × `fund_cache` join → `pe` değeri olan pozisyonlar için piyasa değeri ağırlıklı P/E hesabı: `Σ(marketValue_i × pe_i) / Σ(marketValue_i)`.
- BIST + Crypto + GOLD + FX pozisyonları P/E hesabından dışlanır (fund_cache'de pe yoksa skip).
- Sonuç: Dashboard KPI alanına küçük "Portföy P/E: 22.4x" badge'i veya AnalysisTab Portföy Sağlık kartına ek metrik satırı.
- Veri yetersizse (P/E olan pozisyonlar toplam portföyün %30'undan azını temsil ediyorsa) "Yetersiz veri" göster.

**Acceptance Criteria**:
- Dashboard veya AnalysisTab'da "Portföy P/E: XX.Xx" görünüyor; hesaplama piyasa değeri ağırlıklı.
- Yalnızca US hisseler dahil; BIST/Crypto/GOLD/FX dışlanıyor; dışlananlar için tooltip açıklama var.
- Veri < %30 eşiği altındaysa "Yetersiz veri" gösteriliyor, crash yok.
- P/E verisi `null` olan ticker'lar sessizce atlanıyor (ağırlıklı ortalamaya dahil edilmiyor).
- `ui-builder` agent widget yerleşimini onaylıyor.

**Touched files**: `src/components/Dashboard.js` veya `src/components/AnalysisTab.js` (yerleşime göre)

**Risk**: `fund_cache` query'si zaten AnalysisTab'da yapılıyor; Dashboard'da ayrı fetch gerekebilir. Mitigation: Dashboard state'ine zaten `fundData` yoksa bu widget'ı AnalysisTab'a koy — lazy fetch zaten orada.

---

### 5. Brand-fit Analiz Sadeleştirme (Grup A+B) `[M][P1]`

**Roadmap satırı**: `Bug & UX Backlog → Grup A — Brand Fit, Jargon Temizliği` + `Grup B — AnalysisTab Bilgi Mimarisi`

**Neden bu sprint**: Sprint 14 adaylar listesinde #1 öneri; brand promise'e etkisi yüksek; Social/ek metrik özelliklerden önce gelmeli. Sprint 14'ün en ağır item'ı; kapasiteyi en çok bu tüketir.

**Alt-task'lar**:

- **A-1 Portföy Sağlık kartı**: 8 metriği ham sayı yerine "Bu hisse borç yükü düşük" / "Büyüme yavaşlıyor" formatında sonuç cümlesiyle göster. Kırmızı/sarı/yeşil sinyal korunur; formül tooltip'e taşınır.
- **A-2 BreakEven Analizi kartı**: "Break-even fiyat: $142.30" satırına "Bu fiyatın %12 üzerinde satış yapman gerekiyor" bağlam cümlesi eklenir. Kar/zarar yüzdesi öne çıkar, formül arka plana iner.
- **A-3 FX Risk kartı**: "USD %62" rakamı yerine "Portföyünün %62'si dolar kuru riskine açık" cümlesi. "Önerilen çeşitlendirme" satırı kaldırılır veya actionable hale getirilir.
- **B-1 AnalysisTab bölüm başlıkları**: Her kart grubu için ince ayırıcı başlık satırı ("Getiri Analizi", "Risk Değerlendirmesi", "Piyasa Pozisyonu"). Şu an 15 kart düz liste — taranabilirliği artırır.
- **B-2 Sayısal metrikler için birim/bağlam ekleme**: Komisyon kartında "₺1,240 / yıl" yanına "bu getirinin %0.8'i"; Konsantrasyon Riski'nde HHI skoru yerine "Yüksek konsantrasyon — en büyük 3 pozisyon portföyün %67'sini oluşturuyor."

**Acceptance Criteria**:
- Portföy Sağlık kartındaki 8 metrik için her satırda sinyal + sonuç cümlesi mevcut; formül tooltip'te.
- BreakEven kartında bağlam cümlesi var; yüzde farkı bold/öne çıkıyor.
- FX Risk kartında kuru ifade eden cümle var; sayısal oran ikincil.
- AnalysisTab'da en az 3 bölüm başlığı görünüyor; kart sıralaması değişmiyor.
- Konsantrasyon Riski ve Komisyon kartlarında bağlam cümlesi var.
- `ui-builder` agent tüm kart değişikliklerini onaylıyor; regresyon testi AnalysisTab yüklemede crash yok.

**Touched files**: `src/components/AnalysisTab.js` (ağırlıklı olarak)

**Risk**: AnalysisTab ~2000 satır; birden fazla kart eş zamanlı değiştirilirse merge çakışması riski yüksek. Mitigation: kart başına ayrı commit; `babel-check.sh` her commit'te çalıştırılır.

---

## Out of Scope (bilinçli ertelenenler)

- **Kullanıcı tanımlı fundamental eşikler** `[M][P2]` — plan dosyası hazır ama Brand-fit Sadeleştirme ile aynı sprint'e sığmaz. Sprint 15 ilk adayı.
- **Social Portfolios Faz 2** `[M][P2]` — `UserProfileModal` + `is_public` toggle; denetim turu sonuçları bekleniyor. Sprint 15.
- **Piyasa Dayanıklılık Skoru** `[M][P2]` — fundamentals cache aggregation üzerine inşa; Sprint 15 freebie adayı (P/E ile aynı altyapı).
- **Grup C: Watchlist niyet + hedef fiyat notu** `[M][P2]` — Sprint 14 Grup H ile Watchlist dokunuldu ama Grup C ayrı epik; Sprint 15.
- **Temettü Takvimi** `[M][P2]` — FMP endpoint hazır; Sprint 15 kapasitesine ertelenmiş.

---

## Definition of Done

- [ ] Her item'ın Acceptance Criteria listesi %100 karşılanmış.
- [ ] `npm run check:babel` tüm `src/*.js` dosyalarında hatasız geçiyor.
- [ ] `ui-builder` agent görsel değişiklik içeren item'ları (Item 1, 2, 4, 5) onaylamış.
- [ ] `edge-reviewer` agent Sprint 14'te edge function değişikliği yoksa sadece denetim turu (Item 3) kapsamında çalışmış.
- [ ] Denetim turu (Item 3) bulguları `ROADMAP.md`'ye kaydedilmiş, P-tag verilmiş.
- [ ] `CLAUDE.md` Logo dosyaları notu güncellenmiş (Item 1 kapsamında).
- [ ] Yerel `npx serve .` ile dark + light tema, mobil + masaüstü kombinasyonları gözlemsel test edilmiş.

---

## Demo / Validation

Sprint sonu başarı sinyalleri:

1. **Login logo**: Login ekranı dark ve light temada `Logo/Linear` varyantını gösteriyor; eski `logo-full-dark.png` referansı yok; GitHub Pages'te canlı görünüm doğrulanmış.

2. **UX Fixes**: Watchlist "Çıkar" confirm dialog çalışıyor, crash yok. SearchTab mobil Chrome'da açıldığında klavye otomatik çıkmıyor. Login logo touch target ölçülebilir.

3. **Denetim turu**: `rls-auditor` + `client-security-auditor` + `edge-reviewer` çıktıları Sprint 14 retro alanında özetlenmiş; yüksek/kritik bulgu yoksa "temiz" kaydı; varsa ROADMAP'te P0/P1 item açılmış.
   - **Tur 4 bulguları kaydedildi (2026-05-10)**: P0 temiz (`positions_allocation_read` policy yok — migration 012 başarılı). 5 P1 + 9 P2 bulgu `ROADMAP.md → Bug & UX Backlog → Denetim Turu 4 Bulguları` altında P-tag + dosya/satır referanslı olarak kayıt altına alındı. En kritik P1: hamburger signOut LS sızıntısı, `fetch-fundamentals` auth eksikliği, hardcoded SEC email, `fetch-prices` auth try/catch dışı, BIST venue routing hatası. Kararı Can verecek: P1'lerin hangisi Sprint 14'te, hangisi Sprint 15'te ele alınacak.

4. **Portföy P/E**: US hisselerden oluşan portföyde "Portföy P/E: XX.Xx" görünüyor; yalnızca fund_cache verisi olan pozisyonlar dahil; boş portföyde veya veri < %30'da "Yetersiz veri" uyarısı.

5. **Brand-fit Sadeleştirme**: Portföy Sağlık, BreakEven, FX Risk kartları sonuç cümlesiyle gösteriliyor; AnalysisTab bölüm başlıkları mevcut; eski ham rakam formatı kalmamış.

---

## Retro Alanı

_(Sprint 14 tamamlandığında doldurulacak.)_
