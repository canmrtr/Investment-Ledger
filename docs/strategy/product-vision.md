# PORTFOI — Product Vision
> Last updated: May 2026

---

## The One-Line Vision

**Portfoi, portföyünü takip eden değil — seni yatırımcı olarak geliştiren uygulamadır.**

---

## The Problem

Çoğu yatırımcı bilgi eksikliğinden değil, davranış eksikliğinden başarısız olur.

- Piyasa düşünce panik satışı yapar.
- Herkes alırken alır, herkes satarken satar.
- Portföyünü takip eder ama neden o kararı aldığını unutur.
- Uzun vadeli düşünmek ister ama kısa vadeli hareket eder.

Mevcut araçlar bunu görmezden gelir. Rakamları gösterir, davranışı değiştirmez.

---

## The User

**Kim değil:** Finans profesyoneli, trader, Bloomberg terminali kullanan biri.

**Kim:** Yatırım yapan ama mesleği yatırım olmayan kişi.
- 25–45 yaş arası
- Düzenli geliri var, birikiyor
- Hisse, fon, altın, kripto — bir veya birkaçında pozisyonu var
- "Ne kadar kazandım?" sorusuna cevap biliyor
- "Doğru mu yapıyorum?" sorusuna cevabı yok

**Hedef dönüşüm:** FOMO'dan sıyrılmış, uzun vadeli düşünen, davranışlarının farkında olan yatırımcı.

---

## The Philosophy (Investment Guide'dan)

Portfoi'nin tüm ürün kararları şu felsefi temele dayanır:

> *"Investing has a price — not in dollars, but in volatility, fear, doubt, uncertainty and regret."*

**Temel prensipler:**

1. **Piyasa beklentilerle yönetilir.** Fiyat değil, iş başarısı ölçülür.
2. **Bileşik faiz motordur.** En büyük kazanım uzun tutma süresinin sonunda gelir.
3. **FOMO tehlikeli bir giriş noktasıdır.** Popüler hisse zaten fiyatlanmıştır.
4. **Kalite paradoksu:** Güçlü şirketler prim yapar — iyi fiyat için sabır gerekir.
5. **Davranışsal disiplin getiridir.** Panik satışından kaçınmak, en iyi analizden daha değerlidir.
6. **Çeşitlendirme ile seyreltme arasındaki fark:** 10–30 iyi araştırılmış pozisyon, 50 yarım araştırılmış pozisyondan iyidir.
7. **Finansal özgürlük bir sayıdır.** Önce sayını belirle, sonra oraya doğru inşa et.

---

## The Product — 4 Katman

### Katman 1 — Tracker *(Mevcut)*
Portföyü görünür kılar.

- Portföy değeri, dağılım, getiri
- Varlık sınıfı bazında analiz (ETF/Fon, Altın, Hisse, Kripto, Döviz, Emtia)
- Benchmark karşılaştırması (SPY, XU100)
- Başa baş analizi, konsantrasyon riski, sağlık skoru

**Başarı kriteri:** Kullanıcı portföyünün tam resmini 30 saniyede görebilir.

---

### Katman 2 — Davranışsal Nudge'lar *(MVP sonrası — ~1 ay)*
Kullanıcıyı doğru anda doğru soruyla karşılar.

**Tetikleyici → Mesaj modeli:**

| Tetikleyici | Nudge |
|---|---|
| Piyasa -%5+ düştü | "Portföyün bugün -%X düştü. Tezin hâlâ geçerli mi? Panik satışı yapmadan önce dur." |
| Konsantrasyon >%60 | "İlk 3 pozisyonun portföyünün %X'ini oluşturuyor. Bu senin konfor alanında mı?" |
| Yeni pozisyon ekleniyor | "Bu pozisyon için checklist'i çalıştırdın mı?" |
| Popüler hisse aranıyor | "Bu hisse son 30 günde çok konuşuluyor. FOMO mu, tez mi?" |
| 90+ gün işlem yok | "Son 3 aydır pozisyon değiştirmedin. Bu bir strateji — devam et." |
| Büyük kazanç | "Bu pozisyon %X büyüdü. Orijinal tezin hâlâ geçerli mi?" |

**Başarı kriteri:** Kullanıcı en az 1 impulsive karardan vazgeçtiğini raporlar.

---

### Katman 3 — Koç Sekmesi *(Orta vade — ~3 ay)*
Kullanıcının kendi felsefesini tanımlamasına ve buna sadık kalmasına yardım eder.

**Kullanıcı girer:**
- Risk profili (düşük / orta / yüksek)
- Zaman ufku (1–3 yıl / 3–10 yıl / 10+ yıl)
- Hedef yıllık getiri
- Kırmızı çizgiler (örn. "tek pozisyon %20'yi geçmesin", "kripto %10 max")
- Yatırım felsefesi tercihleri (değer / büyüme / pasif / karma)

**Uygulama üretir:**
- Haftalık "Felsefen ile uyum skoru" (örn. %78)
- Prensip ihlali uyarıları
- Aylık davranış raporu: "Bu ay 2 kez FOMO tuzağından kaçındın"

**Başarı kriteri:** Kullanıcı "uygulama beni tanıyor" der.

---

### Katman 4 — AI Asistan *(Uzun vade — ~6 ay)*
Kullanıcının yatırım kararlarında düşünce ortağı olur.

**Teknik mimari:**
- Claude API (claude-sonnet)
- System prompt = Portfoi Investment Philosophy (bu doküman + Investment Guide)
- Kullanıcı bağlamı = portföy verisi + risk profili + geçmiş kararlar
- Canlı veri = piyasa fiyatları, temel veriler

**Örnek konuşmalar:**

*"NVDA almalı mıyım?"*
→ 20-kriter checklist çalışır, skor verir, tez sorar, mevcut değerlemeyi değerlendirir.

*"Portföyüm nasıl görünüyor?"*
→ Konsantrasyon, çeşitlendirme, felsefe uyumu açısından değerlendirir.

*"Piyasa düşüyor, ne yapayım?"*
→ Davranışsal rehberlik verir. Panik satışının tarihteki maliyetini gösterir.

*"Finansal özgürlüğe ne kadar uzağım?"*
→ Kullanıcının hedef sayısını, mevcut portföyü ve bileşik faiz projeksiyonunu birleştirir.

**Başarı kriteri:** Kullanıcı AI'a "broker gibi" değil "koç gibi" davranıyor der.

---

## Roadmap

```
Şu an        Katman 1 tamamla
             → Brand kit entegrasyonu (tokens.css, renkler, fontlar)
             → UI tutarlılığı (category colors, typography)

+1 ay        Katman 2 başlat
             → 5 temel nudge kuralı
             → Piyasa düşüş bildirimi
             → Yeni pozisyon ekleme akışına checklist sorusu

+3 ay        Katman 3 başlat
             → Kullanıcı profil onboarding'i
             → Felsefe uyum skoru
             → Aylık davranış raporu

+6 ay        Katman 4 başlat
             → Claude API entegrasyonu
             → Investment Guide → system prompt dönüşümü
             → Portföy bağlamı entegrasyonu
```

---

## What Portfoi Is NOT

- Bir trading platformu değil
- Anlık alım-satım tavsiyesi vermez
- Finans danışmanı değil — davranış koçu
- Bloomberg veya profesyonel araç klonu değil
- Karmaşıklık gösterisi değil — sadelik bir özelliktir

---

## The Brand Promise

> **"Uzman olman gerekmiyor. Meraklı ve sabırlı olman yeterli."**

Portfoi, finansal özgürlüğe giden yolda sana rakamları gösterir, davranışlarını aydınlatır ve felsefen hatırlatır.

---

## Related Files

- `portfoi-brand-kit.md` — Renk, tipografi, logo token'ları
- `Investment-Guide.md` — Yatırım felsefesi ve 20-kriter checklist
- `ROADMAP.md` — Teknik geliştirme planı
- `CLAUDE.md` — Claude Code bağlamı
