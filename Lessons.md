# Lessons

Bu dosya, Can'ın benimle aynı fikirde olmadığı veya bana "tekrar kontrol et" dediği durumları kayıt altına alır. Amaç: aynı hatayı tekrar yapmamak.

## Nasıl kullanılır

**Claude için (her yeni session başında):**
1. Bu dosyayı oku.
2. Geçerli görev bir lesson ile örtüşüyorsa, lesson'a uy.
3. Yeni bir lesson çıkarsa (kullanıcı düzeltme/itiraz yaptıysa) → buraya ekle.

**Format (her entry):**
```
### YYYY-MM-DD — Kısa başlık
**Bağlam:** Ne yapıyordum.
**Hatam:** Ne yaptım / ne önerdim.
**Doğrusu:** Can ne dedi / gerçek ne.
**Kural:** Bundan sonra ne yapacağım (genelleştirilmiş).
```

**Eklerken:**
- En yeni en üstte (ters kronolojik).
- "Kural" tek cümle, eyleme dönük.
- Tekrar eden mesele varsa eski entry'yi güncelle, yenisini yazma.

---

## Lessons

<!-- Yeni entry'ler buraya, en üste. -->

### 2026-06-04 — `deno check` syntax parse değil, network'lü module-graph resolve
**Bağlam:** `check-edge.sh`'a eklenen `deno check` gate'ini güçlendirmek için repo-root `deno.json` + import map ekledim (npm:@supabase/supabase-js@2, npm:@anthropic-ai/sdk pin'li).
**Hatam:** Script comment'inde `deno check`'i "Deno-strict ESM parse" diye tanımlamıştım — sanki saf bir syntax gate'iymiş gibi. Aslında `deno check` tüm module-graph'ı resolve eder: edge fn'lerin inline `npm:` import'larını **ilk çalıştırmada network'ten indirir** ve typed dep'leri type-check eder. Offline/CI'da veya fresh cache'de bu, node'un geçtiği yeşil gate'i kırmızıya çevirebilir.
**Doğrusu:** `.js` body'leri default type-check edilmez (checkJs:false) ama graph yine de resolve edilir. Tam offline güvence için commit'li `deno.lock` gerekir — o da ancak deno kurulduktan sonra (`deno cache`/ilk `deno check`) üretilebilir. deno.json import map'i versiyonları tek yerde pin'ler ama inline `npm:` specifier'lar zaten kendi kendine resolve olduğundan map şu an advisory.
**Kural:** Bir local gate eklerken "ne yapıyor" ile "ne yaptığını sandığım" arasını doğrula — `deno check` = resolve+typecheck, parse-only değil. deno kurulunca ilk iş `deno.lock` commit et (offline-safe gate); edge fn import'larını bare-specifier'a çevirirsen `supabase/functions/*/index.ts` mirror'ını da güncelle yoksa `check:edge-drift` patlar.

### 2026-05-19 — `node --check` arrow fn içindeki `const` redeclaration'ı atlıyor
**Bağlam:** Sprint 22 #4'te `refresh-price-cache` edge fn'inin `yfHistoricalUS` arrow fn'ine 52W block ekledim. Aynı fn body'sinde `const closes = res.indicators?.quote?.[0]?.close || [];` (Yahoo response array) zaten vardı; ben 52W için ikinci `const closes = bars.map(b => b.c)...` ekledim. `npm run check:edge` (= her edge fn dosyasına `node --check`) ✅ yeşil geçti.
**Hatam:** Babel + `node --check` yerel syntax gate'lerini "deploy edebilirim" sinyali olarak kabul ettim. Deploy edip cron tetiklediğimde HTTP 503 `BOOT_ERROR` aldım — Deno+ESZIP runtime'da `SyntaxError: Identifier 'closes' has already been declared`.
**Doğrusu:** `node --check` arrow function body'sinde aynı scope'ta `const` redeclaration'ını sessizce kabul ediyor (test: `node --check broken.js` exit 0). Babel benzeri davranır. Yalnız production runtime (Deno strict ESM parse) yakalar. Tek güvenilir yerel gate yok — deploy sonrası en az 1 invoke smoke şart.
**Kural:** Edge fn değişikliğinde `npm run check:edge` yeterli değil. Deploy ettikten **sonra** mutlaka 1 invoke ile boot doğrula (cron'a bırakma — 6h sonra fark edersin). Yeni dosya literal/değişken adı eklerken aynı block içindeki diğer `const`'ları gözle tara — özellikle bars.map(b => b.c) gibi mevcut Yahoo response handling kalıplarına eklerken. Long vadede: `scripts/check-edge.sh`'a `deno check` adımı eklemek `node --check`'in body kapsamındaki bu kör noktasını kapatır.

### 2026-05-19 — pg_cron job command'ı içinde hardcoded `Bearer <secret>` kullanılıyor
**Bağlam:** Sprint 22 #4 deploy sonrası `refresh-price-cache`'i manuel batch için tetiklemek istedim. Supabase Management API `GET /v1/projects/{ref}/secrets` ile `CRON_SECRET` (64-char hex) çektim → 401 unauthorized. `cron.job` tablosunu sorguladığımda `refresh-price-cache-6h` job command'ında hardcoded **farklı** bir `Bearer wOp6/...` (base64-stil 44 char) buldum; onunla 200 OK.
**Hatam:** Edge fn `Deno.env.get("CRON_SECRET")` dediği için Management API'deki Edge Functions secret store'unun aynısını okuduğunu varsaydım. pg_cron komutunun da o değeri vault üzerinden okuduğunu varsaydım.
**Doğrusu:** İki ayrı store var: (1) Edge Functions secrets (Dashboard → Project Settings → Edge Functions → Secrets — `Deno.env.get` buradan okur) ve (2) pg_cron job tanımındaki **literal string** (DB içine yazılı, vault'tan değil). `refresh-price-cache-6h` migration'ı (010 dolayında) `Bearer wOp6/...` 'ı hardcoded yazmış; secret rotation yaparsan **hem** Edge Functions secret store'u **hem** `cron.job.command` SQL'ini update etmen lazım. Karşılaştırma: `refresh-fund-cache-weekly` job'ı `vault.decrypted_secrets`'tan okuyor — doğru pattern.
**Kural:** Yeni pg_cron job yazarken Authorization header'ı `'Bearer ' || (SELECT value FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET')` ile dinamik oku — string literal değil. Mevcut `refresh-price-cache-6h` hardcoded'unu bir sonraki sprint'te vault-okumalı versiyona migrate et (gerek olursa Lessons.md'ye `refresh-fund-cache-weekly` template'ini örnek olarak göster). Token mismatch durumunda debug ilk adımı: `select jobname, command from cron.job where command like '%Bearer%';`

### 2026-05-19 — Doc grupları için `docs/<topic>/README.md` pattern
**Bağlam:** Repo root'unda brand (`portfoi-brand-kit.md`, `design_audit.md`) + strategy (`portfoi-product-vision.md`, `PORTFOI_LAUNCH_PLAN.md`) dokümanları birikmişti. Can "design/brand dosyalarını uygun yere taşı, Claude referans edebilsin" dedi, sonra aynısını marketing/strategy için de istedi.
**Hatam:** Pattern yoktu; .md dosyaları zaman içinde root'a yapışmıştı. Bazı asset path'leri (Logo PNG'leri, tokens.css, favicon) kodda hard-coded — taşımak app'i kırardı; bunu plan öncesi `grep` ile doğrulamak zorunluymuş.
**Doğrusu:** İki seviyeli ayrım yap: (1) **doc'ları topla** — `docs/<topic>/` altına git mv, başına `README.md` index yaz (içerik tablosu + ilgili in-place dosya path'leri + nasıl kullanılır); (2) **code-referenced asset'leri yerinde bırak** — sadece README'den point et. CLAUDE.md'ye topic başına TEK satır pointer ekle ki Claude session başında bulsun.
**Kural:** Bir konuda 2+ ilgili `.md` repo root'unda biriktiğinde `docs/<topic>/` altında topla + `README.md` index + CLAUDE.md'ye tek satır pointer. Taşımadan önce **`grep -rnE "filename"`** ile kod referansını doğrula: code'da path-referenced (binary/CSS/asset) dosyaları **asla taşıma**, sadece doc'ları taşı. `git mv` tracked dosyalar için; untracked için plain `mv`. Dated snapshot'ları filename'e tarih koyarak taşı (örn. `design-audit-2026-05-15.md`). Historical kayıtları (`_archive/`, `docs/superpowers/plans/*.md`) güncelleme — onlar zaman damgalı kayıt.

### 2026-05-17 — Agent vs Skill seçimi
**Bağlam:** Investment-Ledger'da 8 agent + 1 skill vardı. Hangisi agent hangisi skill olmalı sorusu çıktı.
**Hatam:** `product-owner`, `sql-writer`, `ui-builder` agent olarak duruyordu — alt-süreç izolasyonu bu işler için yarardan çok zarar veriyordu (Can ile diyalog kopuyor, knowledge paketi izole edilmek istemiyor). `babel-checker` agent'ı PostToolUse hook ile redundant olmuştu. `test-runner` Sonnet'teydi ama mekanik script çalıştırıyor.
**Doğrusu:** Karar kriteri: **izolasyon faydalı mı zararlı mı?** İzole audit/rapor/test = agent. Methodology + diyalog + paylaşımlı context = skill. Hook ile otomatize edilen iş = agent'a gerek yok.
**Kural:** Yeni .md tanımı yazarken sor: (1) çıktı izole rapor mu yoksa diyalog mu? (2) ana context'i kirletir mi? (3) hook/komut zaten yapabilir mi? Agent yalnız (1)=rapor, (2)=evet kirletir, (3)=hayır otomatize edilemez ise. Diğer her durumda skill. Mekanik tek-amaçlı agent'a Haiku, analitik agent'a Sonnet, yargı/yaratıcılık skill'i kullanırken `/model opus` öner.