# Product

## Register

product

## Users

**Kim:** Yatırım yapan ama mesleği yatırım olmayan kişi. 25–45 yaş, düzenli geliri olan ve birikim yapan; hisse, fon, altın, kripto veya dövizde bir ya da birkaç pozisyonu var. "Ne kadar kazandım?" sorusunu cevaplayabiliyor ama "Doğru mu yapıyorum?" sorusunda kaybolmuş durumda.

**Kim değil:** Finans profesyoneli, trader, Bloomberg terminali kullanıcısı.

**Bağlam:** Çoğunlukla mobilde (PWA), günde birkaç dakika. Piyasa dalgalandığında portföyünü kontrol eder; yeni pozisyon eklerken veya bir kararın eşiğindeyken uygulamaya döner. Ana iş: portföyün tam resmini hızlıca görmek, tek bir varlığı incelemek, ya da bir işlemi kaydetmek.

## Product Purpose

Portfoi, portföyünü takip eden değil — kullanıcıyı yatırımcı olarak geliştiren bir uygulamadır. Çoğu yatırımcı bilgi eksikliğinden değil, davranış eksikliğinden başarısız olur: piyasa düşünce panikler, herkes alırken alır, neden o kararı verdiğini unutur. Mevcut araçlar rakamları gösterir ama davranışı değiştirmez.

Ürün dört katman halinde büyür:
1. **Tracker** (mevcut) — portföyü görünür kılar: değer, dağılım, getiri, benchmark, risk metrikleri.
2. **Davranışsal nudge'lar** — doğru anda doğru soruyu sorar (panik satışı, konsantrasyon, FOMO).
3. **Koç sekmesi** — kullanıcının kendi felsefesini tanımlamasına ve ona sadık kalmasına yardım eder.
4. **AI asistan** — yatırım kararlarında "broker gibi" değil "koç gibi" düşünce ortağı.

**Başarı:** Kullanıcı portföyünün tam resmini 30 saniyede görür; en az bir impulsif karardan vazgeçtiğini hisseder; "bu uygulama beni tanıyor" der.

## Brand Personality

**Üç kelime:** Clear, Grounded, Empowering (Net, Sağlam, Güçlendirici).

**Ses:** Sade dil, doğrudan cümleler, jargon yok. Wall Street terminolojisi ("synergy", "leverage", "alpha") kullanılmaz. Örnek kopya: *"Portföyünü gör. Anla. Büyüt."* — *"Maximize your alpha"* değil.

**Marka vaadi:** "Uzman olman gerekmiyor. Meraklı ve sabırlı olman yeterli."

**Duygusal hedef:** Güven ve sakinlik. Uygulama, piyasa gürültüsünün panostası değil, kullanıcıyı yatıştıran ve uzun vadeli düşünmeye çağıran bir ses olmalı. Sadelik bir özelliktir, eksiklik değil.

## Anti-references

- **Bloomberg / profesyonel terminal klonu değil.** Yoğun veri ızgaraları, blink eden tickerlar, on panelli ekranlar — Portfoi'nin tam tersi.
- **Trading platformu değil.** "Al/Sat" CTA'larını öne çıkaran, işlem hacmini teşvik eden, kırmızı-yeşil yanıp sönen heyecan motoru değil. Aksiyona değil, düşünmeye davet eder.
- **Finans danışmanı / robo-advisor değil.** Anlık alım-satım tavsiyesi vermez; davranış koçudur.
- **Karmaşıklık gösterisi değil.** Her metriği aynı anda göstermek "güçlü" değil, gürültülüdür. Detay, isteyen kullanıcının açtığı katmanda durur (bkz. AnalysisTab Özet/Detay modeli).
- **Generic kripto/fintech estetiği değil.** Neon gradient, glassmorphism duvarı, mor-mavi SaaS şablonu yok. Kimlik gold (#C9A84C) + zengin koyu zemin + serif display + mono sayılar üzerinden taşınır.

## Design Principles

1. **30 saniye netliği.** Her ekran tek bir birincil işe hizmet eder. Kullanıcı portföyünün durumunu bir bakışta görmeli; ikincil detay açıkça ikincil kalmalı (collapsible, Detay toggle, `<details>`).
2. **Sadelik bir özelliktir.** Bir öğe eklemeden önce "bu kullanıcıyı daha iyi karar vermeye yaklaştırıyor mu?" diye sor. Hayırsa, eklenmez. Yoğunluk değil, hiyerarşi.
3. **Rakamı göster, davranışı aydınlat.** Veri her zaman bir yargıya / sonuç cümlesine bağlanır ("güçlü / orta / kırılgan"), çıplak sayıya değil. Ürün kullanıcıyı yatıştırır, kışkırtmaz.
4. **Sakin güven.** Renk ve hareket bilgi taşır, dikkat çalmaz. Gold vurgu nadir ve anlamlı; kırmızı/yeşil yalnızca gerçek kazanç/kayıp için ayrılmıştır, kategori rengi olarak asla.
5. **Türkçe-önce, insan dili.** Tüm UI, flash ve hata metinleri Türkçe ve jargonsuz. Etiket bir işi tarif eder ("Tüm İşlemleri Gör"), genel bir komut değil.

## Accessibility & Inclusion

**Hedef: WCAG 2.1 AA.**
- Gövde metni kontrastı ≥4.5:1, büyük metin ≥3:1. Koyu zeminde `--text3 #888` gibi düşük-kontrast gri gövde metni olarak kullanılmaz.
- İnteraktif öğeler gerçek `<button>` / `<a>` olmalı (tıklanabilir `<div>` değil); icon-only butonlar `aria-label` + `data-tip` taşır.
- Klavye erişimi ve görünür focus durumu.
- `prefers-reduced-motion` her animasyon için bir alternatif sunar (crossfade veya anlık geçiş).
- Renk tek başına anlam taşımaz; kazanç/kayıp işaret + metinle de ayrışır.
- Dark (default) + light tema; iki temada da gold ikon/border kimliği korunur, saf siyah/beyaz kullanılmaz.
