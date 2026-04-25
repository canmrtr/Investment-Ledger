// Financial Modeling Prep "stable" API'sinden + SEC EDGAR fallback ile
// fundamental veri çeker. 21 metrik value-investing checklist için derive eder.
//
// Akış:
//   1. FMP dener (popüler S&P 500 → en zengin metrikler dahil PE/PS)
//   2. FMP "Special Endpoint" 402 ile fail olursa, SEC EDGAR'a düşer
//      (ücretsiz, sınırsız, NOW/MNSO/NNOX gibi tüm SEC dosyalayıcılarını kapsar)
//   3. EDGAR mode'da PE/PS şu an null (price + shares gerektirir, ileride)
//
// Gerekli secret: FMP_KEY
// Body: { "ticker": "AAPL" }

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

// SEC ToS: tüm istekler User-Agent header gerektirir, contact info zorunlu.
const SEC_UA = "Investment-Ledger app contact@investment-ledger.local";

// CAGR helper — start/end + years
const cagr = (start, end, years) => {
  if (start == null || end == null || start <= 0 || years <= 0) return null;
  return Math.pow(end / start, 1 / years) - 1;
};

// Güvenli bölme
const div = (a, b) => (a == null || b == null || b === 0) ? null : a / b;

// ── SEC EDGAR helpers ────────────────────────────────────────────────

// Module-level ticker DB cache: { TICKER: {cik, name} }. Edge function
// instance lifetime boyunca tutulur, cold start'larda yeniden fetch edilir.
let tickerDbCache = null;
let tickerDbCacheAt = 0;
const CIK_TTL_MS = 24 * 60 * 60 * 1000;  // 24 saat

async function getTickerDb() {
  const now = Date.now();
  if (tickerDbCache && (now - tickerDbCacheAt) < CIK_TTL_MS) return tickerDbCache;
  const r = await fetch("https://www.sec.gov/files/company_tickers.json", {
    headers: { "User-Agent": SEC_UA }
  });
  if (!r.ok) throw new Error(`SEC ticker map fetch HTTP ${r.status}`);
  const data = await r.json();
  // Format: { "0": { cik_str: 320193, ticker: "AAPL", title: "Apple Inc." }, ... }
  const db = {};
  for (const k in data) {
    const e = data[k];
    if (e.ticker && e.cik_str != null) {
      db[String(e.ticker).toUpperCase()] = {
        cik: String(e.cik_str).padStart(10, "0"),
        name: e.title || "",
      };
    }
  }
  tickerDbCache = db;
  tickerDbCacheAt = now;
  return db;
}

// Geriye uyumluluk: ticker→CIK map'i sadece CIK döner
async function getCikMap() {
  const db = await getTickerDb();
  const m = {};
  for (const k in db) m[k] = db[k].cik;
  return m;
}

// us-gaap concept time serisi → annual (FY) sıralı array, en yeni başta.
// Aynı fy için birden fazla amendment varsa en son dosyalanmış olanı al.
function edgarAnnualSeries(facts, concept) {
  const c = facts?.["us-gaap"]?.[concept];
  if (!c || !c.units) return [];
  // İlk uygun unit'i seç (USD, shares, vs.)
  const unitKey = Object.keys(c.units)[0];
  if (!unitKey) return [];
  const arr = c.units[unitKey].filter(x => x.fp === "FY" && x.form && x.form.startsWith("10-K"));
  if (!arr.length) return [];
  // Aynı fy → en son filed olanı tut
  const byYear = {};
  for (const x of arr) {
    if (!byYear[x.fy] || (x.filed || "") > (byYear[x.fy].filed || "")) byYear[x.fy] = x;
  }
  return Object.values(byYear).sort((a, b) => +b.fy - +a.fy);
}

// Concept fallback chain'i — en YENİ verisi olan concept'i seç. ASC 606 gibi
// taxonomy migration'larında eski concept (Revenues) eski verilerle dolu kalıp
// yeni concept (RevenueFromContractWith...) yeni verileri tutar; "freshest"
// stratejisi yeni concept'i tercih eder.
function edgarFreshestSeries(facts, conceptList) {
  let best = { concept: null, series: [], maxFy: -Infinity };
  for (const c of conceptList) {
    const s = edgarAnnualSeries(facts, c);
    if (s.length === 0) continue;
    const maxFy = Math.max(...s.map(x => +x.fy));
    if (maxFy > best.maxFy) best = { concept: c, series: s, maxFy };
  }
  return best;
}

// Concept fallback'i + belirli bir fy için değer ara. Anchor FY'ye sabitlenmiş
// metrik hesabı için kullanılır (margin'lar cross-year karışmasın).
function edgarValueAtFy(facts, conceptList, fy) {
  for (const c of conceptList) {
    const s = edgarAnnualSeries(facts, c);
    const match = s.find(x => +x.fy === +fy);
    if (match) return match.val;
  }
  return null;
}

// Concept eşlemesi — companies aynı item'ı farklı us-gaap concept ile raporlayabilir.
const CONCEPTS = {
  revenue:        ["Revenues", "RevenueFromContractWithCustomerExcludingAssessedTax", "SalesRevenueNet"],
  grossProfit:    ["GrossProfit"],
  operatingIncome:["OperatingIncomeLoss"],
  netIncome:      ["NetIncomeLoss"],
  totalAssets:    ["Assets"],
  totalLiab:      ["Liabilities"],
  totalEquity:    ["StockholdersEquity", "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest"],
  retained:       ["RetainedEarningsAccumulatedDeficit"],
  cash:           ["CashAndCashEquivalentsAtCarryingValue", "Cash"],
  longTermDebt:   ["LongTermDebt", "LongTermDebtNoncurrent"],
  shortTermDebt:  ["ShortTermBorrowings", "DebtCurrent"],
  capex:          ["PaymentsToAcquirePropertyPlantAndEquipment"],
  ocf:            ["NetCashProvidedByUsedInOperatingActivities"],
  sga:            ["SellingGeneralAndAdministrativeExpense"],
  dep:            ["DepreciationDepletionAndAmortization", "DepreciationAndAmortization"],
  interestExp:    ["InterestExpense"],
};

async function fetchEdgar(ticker) {
  const cikMap = await getCikMap();
  const cik = cikMap[ticker.toUpperCase()];
  if (!cik) return { error: `EDGAR'da ticker bulunamadı: ${ticker}` };

  const r = await fetch(`https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`, {
    headers: { "User-Agent": SEC_UA }
  });
  if (!r.ok) return { error: `EDGAR companyfacts HTTP ${r.status}` };
  const data = await r.json();
  const facts = data.facts || {};

  // Anchor FY: NetIncomeLoss en yenisi (her firma her yıl raporlar). Tüm
  // metrikler bu FY'ye sabitlenir → cross-year karışma olmaz.
  const niPick = edgarFreshestSeries(facts, CONCEPTS.netIncome);
  const anchorFy = niPick.series[0]?.fy;
  if (!anchorFy) return { error: "EDGAR: NetIncomeLoss bulunamadı (firma SEC'e XBRL dosyalamamış olabilir)" };

  // Anchor FY'deki tüm değerleri topla
  const latest = {};
  for (const k in CONCEPTS) {
    latest[k] = edgarValueAtFy(facts, CONCEPTS[k], anchorFy);
  }

  // SG&A bazı SaaS firmalarında ayrı raporlanır: SellingAndMarketing + GeneralAndAdministrative
  if (latest.sga == null) {
    const sm = edgarValueAtFy(facts, ["SellingAndMarketingExpense"], anchorFy);
    const ga = edgarValueAtFy(facts, ["GeneralAndAdministrativeExpense"], anchorFy);
    if (sm != null && ga != null) latest.sga = sm + ga;
  }

  // 5Y CAGR — anchorFy'ı newest, anchorFy-N'i oldest (max N=4)
  const cagrAnchored = (conceptList) => {
    const pick = edgarFreshestSeries(facts, conceptList);
    const newestVal = pick.series.find(x => +x.fy === +anchorFy)?.val;
    if (newestVal == null) return null;
    for (let years = 4; years >= 1; years--) {
      const target = +anchorFy - years;
      const oldest = pick.series.find(x => +x.fy === target);
      if (oldest) return cagr(oldest.val, newestVal, years);
    }
    return null;
  };
  const revGrowth  = cagrAnchored(CONCEPTS.revenue);
  const earnGrowth = cagrAnchored(CONCEPTS.netIncome);

  // Türetilen değerler
  const fcf = (latest.ocf != null && latest.capex != null) ? latest.ocf - Math.abs(latest.capex) : null;
  const totalDebt = (latest.longTermDebt || 0) + (latest.shortTermDebt || 0);
  const capexAbs = latest.capex != null ? Math.abs(latest.capex) : null;

  const metrics = {
    revenueGrowth5Y: revGrowth,
    earningsGrowth5Y: earnGrowth,
    grossMargin:     div(latest.grossProfit, latest.revenue),
    operatingMargin: div(latest.operatingIncome, latest.revenue),
    netMargin:       div(latest.netIncome, latest.revenue),
    fcfMargin:       div(fcf, latest.revenue),
    sgaToGrossProfit:   div(latest.sga, latest.grossProfit),
    depToGrossProfit:   div(latest.dep, latest.grossProfit),
    interestToOpIncome: div(latest.interestExp, latest.operatingIncome),
    liabToEquity:    div(latest.totalLiab, latest.totalEquity),
    retainedToEquity:div(latest.retained, latest.totalEquity),
    roe:  div(latest.netIncome, latest.totalEquity),
    roa:  div(latest.netIncome, latest.totalAssets),
    roic: div(latest.netIncome, (latest.totalEquity || 0) + totalDebt - (latest.cash || 0)),
    pe:  null,  // EDGAR mode: market price gerek
    ps:  null,  // EDGAR mode: market price gerek
    capexToNetIncome: div(capexAbs, latest.netIncome),
    capexToSales:     div(capexAbs, latest.revenue),
    capexToOcf:       div(capexAbs, latest.ocf),
    ebitToInterest:   div(latest.operatingIncome, latest.interestExp),
    netDebtToFcf:     div(totalDebt - (latest.cash || 0), fcf),
  };

  return {
    metrics,
    raw: {
      latestFiscalYear: anchorFy,
      yearsBackUsed: 4,  // CAGR target window
      cik,
      entityName: data.entityName,
    }
  };
}

// ── FMP helpers ──────────────────────────────────────────────────────

async function fetchFmp(ticker, fmpKey) {
  const base = "https://financialmodelingprep.com/stable";
  const urls = {
    km:     `${base}/key-metrics-ttm?symbol=${ticker}&apikey=${fmpKey}`,
    ratios: `${base}/ratios-ttm?symbol=${ticker}&apikey=${fmpKey}`,
    inc:    `${base}/income-statement?symbol=${ticker}&period=annual&limit=5&apikey=${fmpKey}`,
    bs:     `${base}/balance-sheet-statement?symbol=${ticker}&period=annual&limit=1&apikey=${fmpKey}`,
    cf:     `${base}/cash-flow-statement?symbol=${ticker}&period=annual&limit=1&apikey=${fmpKey}`,
  };

  const fetchSafe = (u) => fetch(u).then(async r => {
    const t = await r.text();
    try { return JSON.parse(t); }
    catch (_) { return { _err: "non-JSON", _status: r.status, _body: t.slice(0, 240) }; }
  }).catch(e => ({ _err: e.message }));

  const [kmR, raR, incR, bsR, cfR] = await Promise.all(Object.values(urls).map(fetchSafe));

  const km  = Array.isArray(kmR)  && kmR.length  ? kmR[0]  : null;
  const ra  = Array.isArray(raR)  && raR.length  ? raR[0]  : null;
  const inc = Array.isArray(incR) ? incR : [];
  const bs  = Array.isArray(bsR)  && bsR.length  ? bsR[0]  : null;
  const cf  = Array.isArray(cfR)  && cfR.length  ? cfR[0]  : null;

  // FMP free tier kapsam dışıysa: km/ratios/inc/bs hepsi non-array (errored).
  // "Special Endpoint" string'i 402 body'sinde var.
  const allFailed = !km && !ra && inc.length === 0 && !bs;
  const isOutOfPlan = allFailed && [kmR, raR, incR, bsR].some(r =>
    r && typeof r._body === "string" && r._body.includes("Special Endpoint")
  );

  if (allFailed) {
    return { ok: false, isOutOfPlan, raw: { km: kmR, ratios: raR, inc: incR, bs: bsR, cf: cfR } };
  }

  // Income statement — FMP yeni-eski sıralı
  const incLatest = inc[0];
  const incOldest = inc.length >= 2 ? inc[inc.length - 1] : null;
  const yearsBack = inc.length >= 2 ? inc.length - 1 : 0;

  const revenue = incLatest?.revenue;
  const grossProfit = incLatest?.grossProfit;
  const operatingIncome = incLatest?.operatingIncome;
  const netIncome = incLatest?.netIncome;
  const sga = incLatest?.sellingGeneralAndAdministrativeExpenses;
  const dep = incLatest?.depreciationAndAmortization;
  const interestExp = incLatest?.interestExpense;
  const ebit = incLatest?.ebit ?? incLatest?.operatingIncome;

  const totalLiab = bs?.totalLiabilities;
  const totalEquity = bs?.totalStockholdersEquity;
  const totalAssets = bs?.totalAssets;
  const retained = bs?.retainedEarnings;
  const cash = bs?.cashAndCashEquivalents;
  const totalDebt = bs?.totalDebt;
  const fcf = cf?.freeCashFlow;
  const capex = cf?.capitalExpenditure ? Math.abs(cf.capitalExpenditure) : null;

  const revGrowth  = cagr(incOldest?.revenue, revenue, yearsBack);
  const earnGrowth = cagr(incOldest?.netIncome, netIncome, yearsBack);

  const metrics = {
    revenueGrowth5Y: revGrowth,
    earningsGrowth5Y: earnGrowth,
    grossMargin:     ra?.grossProfitMarginTTM     ?? div(grossProfit, revenue),
    operatingMargin: ra?.operatingProfitMarginTTM ?? div(operatingIncome, revenue),
    netMargin:       ra?.netProfitMarginTTM       ?? div(netIncome, revenue),
    fcfMargin:       div(fcf, revenue),
    sgaToGrossProfit:   div(sga, grossProfit),
    depToGrossProfit:   div(dep, grossProfit),
    interestToOpIncome: div(interestExp, operatingIncome),
    liabToEquity:     ra?.debtToEquityRatioTTM ?? div(totalLiab, totalEquity),
    retainedToEquity: div(retained, totalEquity),
    roe:  km?.returnOnEquityTTM           ?? null,
    roa:  km?.returnOnAssetsTTM           ?? div(netIncome, totalAssets),
    roic: km?.returnOnInvestedCapitalTTM  ?? null,
    pe: ra?.priceToEarningsRatioTTM ?? null,
    ps: ra?.priceToSalesRatioTTM    ?? null,
    capexToNetIncome: div(capex, netIncome),
    capexToSales:     km?.capexToRevenueTTM             ?? div(capex, revenue),
    capexToOcf:       km?.capexToOperatingCashFlowTTM   ?? null,
    // Interest coverage: FMP, faiz≈0 olan firmalarda ratio'yu 0 verir (∞ koruması).
    // 0 ise inc-derived'e düş.
    ebitToInterest: (ra?.interestCoverageRatioTTM > 0) ? ra.interestCoverageRatioTTM : div(ebit, interestExp),
    netDebtToFcf:   div((totalDebt ?? 0) - (cash ?? 0), fcf),
  };

  return {
    ok: true,
    metrics,
    raw: {
      latestFiscalYear: incLatest?.fiscalYear || incLatest?.calendarYear || incLatest?.date?.slice(0,4),
      yearsBackUsed: yearsBack,
    }
  };
}

// ── HTTP handler ─────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (body, status = 200) => new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" }
  });

  try {
    const body = await req.json();

    // Mode: ticker-list — SEC EDGAR'ın cache'lenmiş ticker DB'sini frontend'e
    // serve eder (search tab için). Browser SEC'e direkt fetch yapamaz
    // (User-Agent zorunluluğu); edge function proxy görevi görür.
    if (body.mode === "ticker-list") {
      const db = await getTickerDb();
      const list = Object.entries(db).map(([ticker, info]) => ({
        ticker, name: info.name
      }));
      return json({ list, count: list.length, fetched_at: new Date().toISOString() });
    }

    const { ticker } = body;
    const fmpKey = Deno.env.get("FMP_KEY");
    if (!ticker) return json({ error: "ticker required" }, 400);
    if (!fmpKey) return json({ error: "FMP_KEY secret eksik" }, 500);

    // 1) FMP dene
    const fmp = await fetchFmp(ticker, fmpKey);
    if (fmp.ok) {
      return json({
        ticker,
        fetched_at: new Date().toISOString(),
        source: "fmp",
        metrics: fmp.metrics,
        raw: fmp.raw,
      });
    }

    // 2) FMP "Special Endpoint" 402 → EDGAR fallback (US listed olmalı)
    if (fmp.isOutOfPlan) {
      const edgar = await fetchEdgar(ticker);
      if (!edgar.error) {
        return json({
          ticker,
          fetched_at: new Date().toISOString(),
          source: "edgar",
          metrics: edgar.metrics,
          raw: edgar.raw,
        });
      }
      // EDGAR de fail oldu — error mesajıyla dön
      return json({
        error: `FMP plan kapsam dışı; EDGAR fallback de başarısız: ${edgar.error}`,
        fmpRaw: fmp.raw,
      }, 422);
    }

    // 3) FMP başka sebepten fail (network, geçersiz ticker, vb.)
    return json({
      error: "FMP'den veri alınamadı (ticker geçersiz veya plan kapsam dışı olabilir)",
      raw: fmp.raw,
    }, 422);

  } catch (err) {
    return json({ error: err.message }, 500);
  }
});
