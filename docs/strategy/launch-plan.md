# Portfoi Launch Plan

Date: 2026-05-19

## Launch Readiness

Do not take Portfoi to a broad public launch yet. The app is close to a closed beta, but security, privacy, legal, reliability, onboarding, and positioning gaps should be handled first.

Static readiness is good:

- `npm run check:babel` passes.
- `npm run check:edge` passes.
- `npm run check:edge-drift` passes.

The main risks are product and operational, not syntax.

Key repo references:

- `CLAUDE.md`
- `ROADMAP.md`
- `audit.md`
- `docs/brand/design-audit-2026-05-15.md`
- `docs/strategy/product-vision.md`

## Strategic Position

Do not position Portfoi as another broker, stock screener, or trading signal app. Midas already owns a broad broker/investing interface in Turkey, Fintables is strong on market data, KAP, analysis, alarms, education, and virtual portfolios, and FinAi is already speaking to AI investment assistant language.

Reference market sources:

- Midas: https://www.getmidas.com/
- Fintables: https://fintables.com/
- Fintables app listing: https://fintables.andro.io/
- FinAi: https://www.finai.net.tr/

Portfoi's sharper positioning should be:

> Portfoi helps long-term individual investors understand their portfolio, avoid emotional decisions, and build investing discipline.

This matches the repo's product vision: tracker now, behavioral nudges next, coach later, AI assistant later.

## Phase 0: Before Any External Users

Target duration: 3-5 days

Goal: remove launch blockers before anyone outside the core team uses real data.

### Product And Engineering

1. Fix the high-severity `set-manual-price` issue from `audit.md`.
   - Current risk: authenticated users can overwrite shared `price_cache` values through `fetch-prices` manual mode.
   - Required fix: move BES/manual values to user-scoped storage, or enforce server-side ownership and asset-type checks before any service-role write.

2. Resolve public portfolio ambiguity.
   - Current risk: `full` sharing still hides details and computes percentages from cost basis in `src/components/App.js`.
   - Required fix: either disable `full` sharing entirely or implement a real full-detail public view.

3. Make BES update atomic.
   - Current risk: BES price update can partially commit while DK update fails.
   - Required fix: make price and DK update one RPC or edge operation.

4. Define deposit accounting after partial withdrawals.
   - Current risk: current interest model can overstate remaining value depending on intended accounting.
   - Required fix: define whether accrued interest is realized, retained, or reset on withdrawal, then add test coverage.

5. Verify live Supabase state, not just migrations.
   - Check actual RLS policies.
   - Check grants.
   - Check cron jobs.
   - Check env vars.
   - Check edge deploy versions.
   - Check secret storage.

6. Add legal surfaces.
   - Terms of service.
   - Privacy/KVKK disclosure.
   - Cookie policy if analytics is added.
   - Clear "not investment advice" disclaimer.

Legal reference sources:

- SPK investment advisory page: https://spk.gov.tr/kurumlar/portfoy-yonetim-sirketleri/basvuru-surecleri/yatirim-danismanligi-yetki-belgesi-talebi
- Yatirim Finansman disclaimer example: https://www.yf.com.tr/yasal-uyari
- KVKK disclosure pattern: https://www.csgb.gov.tr/footer-contents/kvkk-aydinlatma-metni/

## Phase 1: Closed Beta

Target duration: Week 1-2

Goal: 10-25 real users, manually onboarded.

### Product Work

1. Keep the product scoped to Katman 1: portfolio tracker plus light nudges.
   - Do not ship AI coach yet.
   - Do not ship broad social features yet.

2. Improve first-run onboarding.
   - Explain what to enter first.
   - Offer a sample portfolio option.
   - Guide the user to add the first position.

3. Add data freshness and status clarity.
   - Show when prices were last updated.
   - Show when FX was last updated.
   - Show when fundamentals were last updated.
   - Show when dividend data was last updated.

4. Add export and backup confidence.
   - CSV export should be visible.
   - The user should understand that their data is recoverable.

5. Finish Design Audit Phase 2 essentials.
   - Normalize empty states.
   - Replace button-like spans with buttons.
   - Make tooltip behavior consistent.
   - Add inline alert class instead of reusing fixed `.flash`.

6. Add basic analytics events.
   - Signup.
   - First position added.
   - First price refresh.
   - First analysis viewed.
   - First export.
   - Public share enabled.

### Engineering And Ops

1. Create a production checklist and release tag process.
2. Add a staging Supabase project or at least staging environment separation before broader launch.
3. Run E2E with real test credentials:

```bash
IL_EMAIL=... IL_PASS=... node e2e/smoke.mjs
```

4. Add uptime and error monitoring for edge functions.
5. Add rate-limit dashboards for FMP, Massive, Twelve Data, Claude, and Supabase.
6. Create a rollback procedure for GitHub Pages and Supabase edge functions.

### Marketing Work

1. Recruit beta users from warm network.
   - Long-term investors.
   - Midas users.
   - BIST/fon investors.
   - BES users.

2. Use direct interviews, not paid acquisition.

3. Landing page should promise one job:

> Portfoyunun ne durumda oldugunu ve davranis risklerini tek ekranda gor.

4. Collect objections.
   - Trust.
   - Privacy.
   - Data entry burden.
   - Accuracy.
   - "Why not Excel?"
   - "Why not Midas/Fintables?"

### Success Gate

- 70% of beta users add at least 3 positions.
- 40% return within 7 days.
- At least 5 users say the analysis changed how they thought about their portfolio.
- Zero unresolved privacy/security issues.

## Phase 2: Private Launch

Target duration: Week 3-4

Goal: 50-100 invited users.

### Product

1. Add behavioral nudge MVP.
   - Concentration warning.
   - Inactivity nudge.
   - Market drop nudge.
   - New position checklist prompt.
   - Big winner thesis-check prompt.

2. Add "Investment thesis" note per position.
   - This is highly aligned with Portfoi's differentiated promise.

3. Add Rehber content.
   - The current Rehber placeholder weakens the product story.
   - Ship 5-7 practical guides:
     - XIRR.
     - Concentration.
     - FOMO.
     - Diversification.
     - BES/deposit tracking.
     - Portfolio review checklist.

4. Clarify supported and unsupported assets in-app.

5. Add "data may be delayed/incomplete" language near price and fundamental surfaces.

### Marketing

1. Publish 3 core content pieces.
   - "Portfoy takip etmek yetmez: yatirim davranisini da takip et."
   - "FOMO ile alinan hisseyi nasil fark edersin?"
   - "Excel'den Portfoi'ye: bireysel yatirimci icin portfoy sagligi."

2. Create short demo videos.
   - Add position.
   - Analysis tab.
   - Concentration warning.
   - Dividend calendar.

3. Start waitlist with invite code.

4. Launch in small Turkish investor communities carefully.
   - Position as education/productivity.
   - Do not position as stock advice.

5. Build founder-led trust.
   - Public changelog.
   - Transparent data sources.
   - Security notes.

### Success Gate

- 100 invited users.
- 30 weekly active users.
- 20 users with complete portfolios.
- 10 qualitative testimonials.
- No major data accuracy complaints unresolved for more than 48 hours.

## Phase 3: Public Beta

Target duration: Month 2

Goal: repeatable acquisition and retention.

### Product

1. Ship polished onboarding and sample portfolio.
2. Add TEFAS only if WAF/provider reliability is solved.
   - If not solved, do not market fund tracking heavily.
3. Add weekly portfolio summary email only after unsubscribe, KVKK, and email consent are ready.
4. Add account deletion and data deletion.
5. Add pricing gate only after retention is proven.

Potential first paid packaging:

- Free: manual tracker, basic dashboard.
- Pro: analysis, nudges, dividend calendar, exports, weekly report.

Avoid AI pricing until AI quality and legal boundaries are clear.

### Marketing

1. Launch website on a real domain, not only the GitHub Pages path.

2. Build SEO pages.
   - `portfoy takip uygulamasi`
   - `yatirim portfoyu nasil takip edilir`
   - `XIRR nedir`
   - `BIST portfoy takip`
   - `BES portfoy takip`
   - `temettu takibi`

3. Build comparison messaging.
   - Broker degil.
   - Al-sat sinyali degil.
   - Excel'den daha akilli.
   - Fintables/Midas yerine degil, yatirim davranisinin yaninda.

4. Start newsletter.
   - Weekly behavioral investing lesson.
   - Product update.

5. Use product-led loops.
   - Shareable allocation view.
   - Anonymized portfolio health snapshot.
   - Referral invite.

### Success Gate

- 500 signups.
- 150 activated users.
- 25-40% week-4 retention among activated users.
- At least 5% free-to-paid intent from interviews or preorders.

## Phase 4: V1 Launch

Target duration: Month 3

Only call it V1 when these are true:

1. Security audit is clean.
2. Live RLS tests are automated.
3. Public sharing is unambiguous.
4. Legal/KVKK/terms are published.
5. Data freshness and provider failure states are visible.
6. Onboarding reliably gets users to first value in under 5 minutes.
7. At least one acquisition channel brings activated users, not just signups.

### V1 Marketing Launch

1. Product Hunt is less important than Turkish finance communities, SEO, X/Twitter threads, LinkedIn founder posts, and newsletter partnerships.
2. Launch message:

> Uzun vadeli yatirimcilar icin davranis odakli portfoy takip uygulamasi.

3. Primary CTA:

> Portfoyunu ekle, saglik skorunu gor.

4. Secondary CTA:

> Excel'den aktar.

5. Trust CTA:

> Veri kaynaklari ve gizlilik nasil calisiyor?

## Recommended Next Sprint

The next sprint should be launch-hardening, not new features.

1. Fix `set-manual-price` shared cache risk.
2. Disable or complete `full` public sharing.
3. Add legal/privacy pages.
4. Add onboarding/sample portfolio.
5. Run live Supabase RLS and E2E tests.
6. Recruit 10 closed beta users manually.

After that, ship behavioral nudges and Rehber content. Those are the first features that make Portfoi meaningfully different from a tracker.
