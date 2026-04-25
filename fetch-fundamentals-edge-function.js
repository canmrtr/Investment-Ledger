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

// Module-level ticker→CIK cache. Edge function instance lifetime boyunca tutulur.
// Cold start'larda yeniden fetch edilir (~1MB, ~10k entry, OK).
let cikCache = null;
let cikCacheAt = 0;
const CIK_TTL_MS = 24 * 60 * 60 * 1000;  // 24 saat

async function getCikMap() {
  const now = Date.now();
  if (cikCache && (now - cikCacheAt) < CIK_TTL_MS) return cikCache;
  const r = await fetch("https://www.sec.gov/files/company_tickers.json", {
    headers: { "User-Agent": SEC_UA }
  });
  if (!r.ok) throw new Error(`SEC ticker map fetch HTTP ${r.status}`);
  const data = await r.json();
  // Format: { "0": { cik_str: 320193, ticker: "AAPL", title: "Apple Inc." }, ... }
  const map = {};
  for (const k in data) {
    const e = data[k];
    if (e.ticker && e.cik_str != null) {
      map[String(e.ticker).toUpperCase()] = String(e.cik_str).padStart(10, "0");
    }
  }
  cikCache = map;
  cikCacheAt = now;
  return map;
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

// Concept'lerin fallback chain'i — en uygun olanı bul (companies use different names)
function edgarFirstSeries(facts, conceptList) {
  for (const c of conceptList) {
    const s = edgarAnnualSeries(facts, c);
    if (s.length > 0) return { concept: c, series: s };
  }
  return { concept: null, series: [] };
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
  if (!cik) {
    return { error: `EDGAR'da ticker bulunamadı: ${ticker}` };
  }
  const r = await fetch(`https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`, {
    headers: { "User-Agent": SEC_UA }
  });
  if (!r.ok) {
    return { error: `EDGAR companyfacts HTTP ${r.status}` };
  }
  const data = await r.json();
  const facts = data.facts || {};

  // Latest + 5Y series for each concept
  const series = {};
  for (const k in CONCEPTS) {
    series[k] = edgarFirstSeries(facts, CONCEPTS[k]).series;
  }

  // Latest annual values
  const latest = {};
  for (const k in series) latest[k] = series[k][0]?.val ?? null;

  // 5Y CAGR — en eski/en yeni alınır
  const cagrFromSeries = (s) => {
    if (!s || s.length < 2) return null;
    const newest = s[0], oldest = s[Math.min(s.length - 1, 4)];  // max 5 yıl geri
    const years = (+newest.fy) - (+oldest.fy);
    return cagr(oldest.val, newest.val, years);
  };
  const revGrowth  = cagrFromSeries(series.revenue);
  const earnGrowth = cagrFromSeries(series.netIncome);

  // Türetilen değerler
  const fcf = (latest.ocf != null && latest.capex != null) ? latest.ocf - Math.abs(latest.capex) : null;
  const totalDebt = (latest.longTermDebt || 0) + (latest.shortTermDebt || 0);

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
    capexToNetIncome: div(latest.capex ? Math.abs(latest.capex) : null, latest.netIncome),
    capexToSales:     div(latest.capex ? Math.abs(latest.capex) : null, latest.revenue),
    capexToOcf:       div(latest.capex ? Math.abs(latest.capex) : null, latest.ocf),
    ebitToInterest:   div(latest.operatingIncome, latest.interestExp),
    netDebtToFcf:     div(totalDebt - (latest.cash || 0), fcf),
  };

  return {
    metrics,
    raw: {
      latestFiscalYear: series.revenue[0]?.fy ?? series.netIncome[0]?.fy ?? null,
      yearsBackUsed: series.revenue.length >= 2 ? Math.min(series.revenue.length - 1, 4) : 0,
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
    const { ticker } = await req.json();
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
