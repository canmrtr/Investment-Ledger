# Sprint 17 — 2026-05-13 → 2026-05-26

**Goal**: Can, elindeki temettü hisselerinde "Sonraki Temettü" tarihini tek bakışta görür; AI parse ile ilk kez DIV işlemi girebilir; UI jargonu Türkçeleşir — yatırım deneyimini doğrudan etkileyen üç somut iyileştirme tamamlanır.

**Capacity**: 2 hafta × ~6h/hafta efektif ≈ ~12h toplam (hafta sonu + akşam)

---

## Hotfix — 2026-05-11 (Sprint Öncesi)

**BES Form Yeniden Tasarımı** ✅ — API verisi gelene kadar geçici kullanım için BES formu basitleştirildi:
- Pay adedi + NAV alanları kaldırıldı; "Yatırılan Toplam Tutar" + "Güncel Değer" alanları eklendi.
- `shares=1, avg_cost=yatırılan_tutar`; güncel değer `fetch-prices mode:"set-manual-price"` → `price_cache`.
- Devlet katkısı: ayrı hesap kodu ile ayrı BES pozisyonu (örn. AH_DK).
- Pozisyon listesinde "₺N yatırılan" label'ı.
- Commit: `6317454`

**Nakit & Vadeli Mevduat (CASH/DEPOSIT)** ✅ — Banka hesabı bakiyeleri ve vadeli mevduat first-class asset type olarak eklendi:
- `CASH`: TRY/USD/EUR banka hesabı; fiyat = 1.0 sabit; P&L = 0.
- `DEPOSIT`: faiz oranı + vade tarihi + basit faiz hesabı (`1 + oran × gün/360`, vadeye cap); P&L = tahakkuk eden faiz.
- DB: `positions.interest_rate` + `positions.maturity_date` + `positions.reserve_ratio`; `rebuild_positions_atomic` RPC güncellendi (migration 016–017).
- Dashboard: `mixed:true` bloklar (çok para birimli toplam); vade tarihi badge (kırmızı/sarı/yeşil).
- AddTab: Manuel-only mod (text/image/CSV gizli).
- HHI konsantrasyon riskinden hariç.
- 11 commit: `5fba9fc` → `e074ca7`

---

## Bağlam: Sprint 16 Retro Özeti

Sprint 16 Item 1–4 planlandığı gibi tek gün (2026-05-11) teslim edildi; 4 commit, tüm DoD kriterleri geçti. Item 5 (Temettü Takvimi Faz 1) devam ediyor — edge fn + UI subagent iş yüküyle bu sprint'e devredildi. Sprint 17, Item 5'i önce kapatıp ardından üç yüksek-değerli P1 fix'i tamamlar.

---

## Scope

### 1. Temettü Takvimi Faz 1 — Sprint 16'dan Devir `[M][P2]`

**Roadmap satırı**: `Temettü Takvimi → (a) mode:"dividend-calendar" dalı + (b) TickerDetailTab "Sonraki Temettü" satırı`

**Neden bu sprint**: Sprint 16'da edge fn + UI kapasitesi aşıldığı için bilinçli ertelendi. Altyapı hazır (ticker validation Sprint 15'te eklendi, FMP endpoint biliniyor); sprint 17 kapasitesinin ilk yarısı bunu kapatmaya yeter.

**Alt-task'lar**:
- **1a `mode:"dividend-calendar"` edge fn dalı** `[S]`: `fetch-fundamentals`'ta `dividend-calendar` mode skeleton'ına FMP `/stable/stock/dividends?ticker=X` call ekle; `dividends` array'inden en yakın gelecek ex-date + amount döndür. Response: `{ticker, exDate, amount, frequency}`. `edge-reviewer` sign-off zorunlu.
- **1b TickerDetailTab "Sonraki Temettü" satırı** `[S]`: Held ticker'da meta bilgi satırına "Sonraki Temettü: 15 Haz · $0.24/hisse" ekle. Temettü yoksa/FMP dönmezse satır render edilmez. `ui-builder` sign-off zorunlu.

**DoD**:
- AAPL veya JNJ için `fetch-fundamentals?mode=dividend-calendar&ticker=AAPL` → `{exDate, amount}` dolu geliyor.
- TickerDetailTab held ticker için "Sonraki Temettü" satırı görünüyor; temettü ödemeyen ticker'da satır yok.
- FMP 404 / rate limit durumunda uygulama crash etmiyor; satır sessizce gizleniyor.
- `edge-reviewer` 1a'yı onaylıyor; `ui-builder` 1b'yi onaylıyor.
- `npm run check:babel` + `npm run check:edge` + drift check geçiyor.

**Risk**: FMP free tier dividends rate limit günde 250 çağrı; her TickerDetailTab açılışında çağrı yapılırsa hızla dolabilir. Mitigation: `fund_cache`'e dividend verisi TTL ile yazılmalı (1 gün); `edge-reviewer` caching stratejisini belirlesin. Yoksa short-term kabul edilebilir.

---

### 2. AI Parse DIV Way Desteği `[S][P1]`

**Roadmap satırı**: `Asset Type Genişletme → "AI parse temettü desteği (DIV way)" [P1]`

**Neden bu sprint**: `parse-transaction` sistem promptu yalnızca `BUY|SELL` biliyor; temettü bildirimi yapıştırınca yanlış parse ediyor ya da hata veriyor. Can aktif temettü alan hisse tutuyor; bu gap günlük kullanımda sürtünme yaratıyor. `[S]` boyutu — sadece prompt + istemci doğrulaması değişikliği.

**Alt-task'lar**:
- **3a `parse-transaction` sistem promptu** `[S]`: `way` field'ını `BUY|SELL|DIV` olarak güncelle; Türkçe temettü ifadesi örnekleri ekle ("temettü ödemesi", "kâr payı", "dividend"). `edge-reviewer` sign-off zorunlu.
- **3b `saveTx` istemci `way` doğrulaması** `[S]`: `AddTab.js saveTx`'e `way` allowlist kontrolü ekle (`BUY|SELL|DIV`); geçersiz `way` gelirse kullanıcıya Türkçe hata. `ui-builder` sign-off zorunlu.

**DoD**:
- "AAPL temettü ödemesi 15 Mayıs $0.25/hisse 100 adet" metni parse edince `{way:"DIV", ticker:"AAPL", amount:25, date:"2026-05-15"}` dönüyor.
- `saveTx` içinde `way` "DIV" ise doğrulama geçiyor; "DIVIDEND" veya benzeri geçersizler reddediliyor.
- Mevcut BUY/SELL parse'ı etkilenmiyor.
- `edge-reviewer` 3a'yı onaylıyor; `ui-builder` 3b'yi onaylıyor.
- `npm run check:edge` + drift check geçiyor.

**Risk**: Claude Haiku parse kalitesi bağlamdan bağlama değişebilir; DIV tutarı hisse başı mı toplam mı olduğu belirsizleşebilir. Mitigation: sistem promptunda `amount: toplam tutar (hisse başı × adet)` kuralını net yaz; doğrulama katmanı yanlış format gelince kullanıcıya onay sor.

---

### 3. Brand Fit Batch — B1 Finans Jargonu + B2 Formül Gizleme `[S×2][P1]`

**Roadmap satırı**: `UI & A11y Backlog → Brand Fit & Jargon Temizliği → "Finans jargonunu Türkçe kullanıcı diline çevir" + "Formülleri ekrandan kaldır" [P1]`

**Neden bu sprint**: Her iki item de `[P1]` işaretli ve `[S]` — yalnızca metin/render değişikliği, yeni veri veya API yok. Temettü + kripto fix'leri kapasiteyi tüketirse bu item ertelenebilir (açıkça Out of Scope'a taşı).

**Alt-task'lar**:
- **B1 Jargon çevirisi**: `Total Return → Toplam Getiri`, `Benchmark → Karşılaştırma`, `Trade → İşlem`, `XIRR → Yıllık Getiri` (detay tooltip'te XIRR kalır), `P/E → F/K`, `P/S → F/S`. Etkilenen dosyalar: `App.js`, `AnalysisTab.js`, `TickerDetailTab.js` — `ui-builder` tara.
- **B2 Formül gizleme**: `AnalysisTab.js:1290,1943,1126` satırlarındaki `HHI= Σ(ağırlık²) × 10000`, skor formülleri ve `FUND_THRESHOLDS` string metinlerini kaldır; sonuç değerleri + tooltip kalır. `ui-builder` sign-off zorunlu.

**DoD**:
- Dashboard + AnalysisTab'da `Total Return`, `XIRR`, `Benchmark` gibi İngilizce terimler görünmüyor.
- `HHI= Σ(...)` formülleri UI'dan kalktı; değerler + açıklayıcı tooltip kaldı.
- `npm run check:babel` geçiyor; görsel regresyon yok.

**Risk**: Yaygın metin değişikliği — referans sayısı çok olabilir. `replace_all` yerine bağlam-duyarlı değiştirme şart; `ui-builder` her dosyayı ayrı okuyup değiştirmeli. XIRR kısaltması yalnızca tooltip/detayda kalacak şekilde dikkatli handle edilmeli.

---

## Out of Scope (bilinçli ertelenenler)

- **Temettü Takvimi Faz 2 (c) — Dashboard/HistoryTab "Bu ay beklenen temettüler"**: Faz 1 doğrulanmadan başlamamalı; Sprint 18'e.
- **Piyasa Dayanıklılık Skoru** `[M][P2]`: Ayrı sprint hedefi hak ediyor; kapsamlı frontend hesabı + AnalysisTab kartı. Sprint 18 veya 19 adayı.
- **Social Portfolios Faz 2** `[P2]`: Multi-user önkoşulları (custom domain, hesap yönetimi) tamamlanmadan başlamamalı.
- **LS key user-scope prefix** (uzun vade): `il_recent_search` signOut temizliği Sprint 16'da yapıldı; prefix refactor ayrı sprint.
- **Stale Fiyat Uyarısı** `[S][P2]`: Değerli ama P2; Sprint 17 P1'lere odaklanıyor.
- **"Tam Detay" portföy paylaşımı UI ≠ veri katmanı** `[P1]`: Social Faz 2 ile birlikte ele alınacak; bağımsız fix UI borcunu artırır.

---

## Definition of Done

- [x] Item 1 (1a+1b): dividend-calendar mode + Sonraki Temettü satırı — önceki sprint'te implement edilmişti; doğrulandı.
- [x] Item 2 (2a+2b): DIV parse (`BUY|SELL|DIV`, shares=toplam tutar) + saveTx way allowlist + `npm run check:edge` geçti.
- [x] Item 3 (B1+B2): Türkçe jargon geçişi (9 yer) + FUND_THRESHOLDS gizlendi + `npm run check:babel` geçti.
- [ ] `ROADMAP.md` Sprint 17 item'ları `[x]` işaretlendi; Sprint 18 bakış listesi güncellendi.

---

## Demo / Validation

1. **Temettü satırı**: AAPL held pozisyonu → TickerDetailTab → "Sonraki Temettü: [tarih] · $[amount]/hisse" görünüyor. NVDA (temettü yok) → satır yok.
2. **DIV parse**: AddTab → "AAPL temettü ödemesi 15 Mayıs $0.25/hisse 100 adet" yapıştır → ConfirmBox `way:DIV` gösteriyor.
3. **Jargon**: Dashboard + AnalysisTab üzerinde `Ctrl+F` → "Total Return", "Benchmark", "XIRR" (label olarak) bulunamıyor.
4. **Formül temizliği**: AnalysisTab HHI bölümünde `Σ` veya `= ` içeren formül metni yok.

---

## Retro Alanı

*(Sprint bitiminde doldurulacak)*
