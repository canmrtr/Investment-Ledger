// Financial Modeling Prep "stable" API'sinden + SEC EDGAR fallback ile
// (US için) ve İş Yatırım MaliTablo'dan (BIST için) fundamental veri çeker.
// 21 metrik value-investing checklist için derive eder.
//
// Akış (asset_type'a göre):
//   - BIST → İş Yatırım MaliTablo (XI_29 industrial; bankalar henüz desteklenmiyor)
//   - default/US_STOCK/FUND →
//       1. FMP dener (popüler S&P 500 → en zengin metrikler dahil PE/PS)
//       2. FMP "Special Endpoint" 402 ile fail olursa, SEC EDGAR'a düşer
//          (ücretsiz, sınırsız, NOW/MNSO/NNOX gibi tüm SEC dosyalayıcılarını kapsar)
//       3. EDGAR mode'da PE/PS şu an null (price + shares gerektirir, ileride)
//
// Gerekli secret: FMP_KEY (US için), TWELVEDATA_KEY (ticker-list BIST için)
// Body: { "ticker": "AAPL" }  veya  { "ticker": "THYAO", "asset_type": "BIST" }

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://canmrtr.github.io",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// SEC ToS: tüm istekler User-Agent header gerektirir, contact info zorunlu.
const SEC_UA = "Investment-Ledger app canmerter85@gmail.com";

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
    headers: { "User-Agent": SEC_UA }, signal: AbortSignal.timeout(8000)
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

// BIST ticker listesi — Twelve Data /stocks reference (free tier OK, ~640 ticker)
let bistListCache = null;
let bistListCacheAt = 0;

async function getBistList() {
  const now = Date.now();
  if (bistListCache && (now - bistListCacheAt) < CIK_TTL_MS) return bistListCache;
  const apiKey = Deno.env.get("TWELVEDATA_KEY");
  if (!apiKey) return [];
  const r = await fetch(`https://api.twelvedata.com/stocks?exchange=XIST&apikey=${apiKey}`, { signal: AbortSignal.timeout(8000) });
  if (!r.ok) return [];
  const d = await r.json();
  if (!Array.isArray(d.data)) return [];
  const list = d.data.map(x => ({
    ticker: String(x.symbol || "").toUpperCase(),
    name: x.name || "",
  })).filter(x => x.ticker);
  bistListCache = list;
  bistListCacheAt = now;
  return list;
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

// ── İş Yatırım (BIST) helpers ─────────────────────────────────────────

// XI_29 (sektörel konsolide olmayan) MaliTablo formatında itemCode → kavram.
// itemDescTr/itemDescEng yerine itemCode kullanılıyor: text whitespace/casing
// varyasyonlarına karşı sağlam. Bankalar (UFRS group) farklı kod yapısı (Roman
// numerals) kullanır → ayrı çalışma alanı.
const BIST_CONCEPTS = {
  // Income statement (3xxx)
  revenue:        "3C",     // Net Sales
  grossProfit:    "3D",     // GROSS PROFIT (LOSS)
  operatingIncome:"3DF",    // OPERATING PROFITS (EBIT)
  netIncome:      "3L",     // NET PROFIT AFTER TAXES
  marketing:      "3DA",    // Marketing Selling & Distrib. Expenses (-)
  generalAdmin:   "3DB",    // General Administrative Expenses (-)
  interestExp:    "3HC",    // Financial Expenses (from Other Operations) (-)
  // Balance sheet (1xxx, 2xxx)
  totalAssets:    "1BL",    // TOTAL ASSETS
  cash:           "1AA",    // Cash and Cash Equivalents
  shortTermLiab:  "2A",     // SHORT TERM LIABILITIES
  longTermLiab:   "2B",     // LONG TERM LIABILITIES
  shortTermDebt:  "2AA",    // Short-Term Financial Loans
  longTermDebt:   "2BA",    // Long-Term Financial Loans
  totalEquity:    "2N",     // SHAREHOLDERS EQUITY
  retained:       "2OCE",   // Retained Earnings /(Acc. Losses)
  // Cash flow (4xxx)
  da:             "4B",     // Depreciation & Amortization
  ocf:            "4C",     // Net Cash from Operations
  capex:          "4CAI",   // Capital Expenditures (CapEx) — negative
  fcf:            "4CB",    // Free Cash Flow
};

const ISY_BASE = "https://www.isyatirim.com.tr/_layouts/15/IsYatirim.Website/Common/Data.aspx/MaliTablo";
const ISY_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
  "Accept": "*/*",
  "Accept-Language": "tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7",
  "X-Requested-With": "XMLHttpRequest",
};

// Bankalar UFRS grubu (Roman numeral itemCode'lar) kullanır; XI_29 mapping'imiz
// boşa istek üretmesin. Bilinen ana bankalar — UFRS support eklenince kaldırılır.
const ISY_KNOWN_BANKS = new Set([
  "GARAN","AKBNK","YKBNK","ISCTR","HALKB","VAKBN","ALBRK","QNBFB","TSKB","ICBCT","SKBNK"
]);

// fetchBist sonuçları için instance-lifetime cache (6 saat TTL).
// Edge function instance ömrü boyunca tutulur; cold start'ta sıfırlanır.
const bistFundCache = new Map();  // code → { data, at }
const BIST_FUND_TTL_MS = 6 * 60 * 60 * 1000;

// İş Yatırım MaliTablo: 4 yıl kolonu / çağrı. URL+params builder.
function isyBuildUrl(code, group, years) {
  const p = new URLSearchParams({ companyCode: code, exchange: "TRY", financialGroup: group });
  for (let i = 0; i < 4; i++) {
    p.set(`year${i + 1}`, String(years[i]));
    p.set(`period${i + 1}`, "12");  // 12 = full year (annual)
  }
  p.set("_", String(Date.now()));
  return `${ISY_BASE}?${p.toString()}`;
}

async function isyFetch(code, group, years) {
  try {
    const r = await fetch(isyBuildUrl(code, group, years), { headers: ISY_HEADERS, signal: AbortSignal.timeout(8000) });
    if (!r.ok) return null;
    const d = await r.json();
    if (!d.ok || !Array.isArray(d.value) || d.value.length === 0) return null;
    return d.value;
  } catch (_) { return null; }
}

async function fetchBist(rawTicker) {
  const code = String(rawTicker).toUpperCase().replace(/\.IS$/i, "");

  // Defense in depth: BIST tickers 3-6 büyük harf; URLSearchParams encode etse de
  // explicit whitelist beklenmedik path/host injection riskini sıfırlar.
  if (!/^[A-Z0-9]{2,8}$/.test(code)) {
    return { error: `Geçersiz BIST ticker formatı: ${rawTicker}` };
  }

  // Bilinen banka → erken çıkış (XI_29 yok, gereksiz outbound istek olmasın)
  if (ISY_KNOWN_BANKS.has(code)) {
    return { error: `${code} bir banka tickerı; XI_29 finansal tablosu yok. UFRS desteği henüz eklenmedi.` };
  }

  // Module-level cache (6h TTL) — multi-user senaryoda isyatirim.com.tr'a tekrar
  // outbound istek atılmasın. Frontend ayrıca 7 gün LS cache yapar.
  const cached = bistFundCache.get(code);
  if (cached && Date.now() - cached.at < BIST_FUND_TTL_MS) return cached.data;

  const thisYear = new Date().getUTCFullYear();
  const probeYears = [thisYear - 1, thisYear - 2];  // FY-1 önce; henüz dosyalanmadıysa FY-2

  // Anchor year tespiti — XI_29 grubunda "3C" (Net Sales) value1 dolu olan ilk yıl
  let anchorYear = null;
  let primary = null;
  for (const py of probeYears) {
    const years = [py, py - 1, py - 2, py - 3];
    const result = await isyFetch(code, "XI_29", years);
    if (!result) continue;
    const rev = result.find(r => r.itemCode === BIST_CONCEPTS.revenue);
    if (rev && rev.value1 != null && +rev.value1 > 0) {
      primary = result;
      anchorYear = py;
      break;
    }
  }

  if (!primary || !anchorYear) {
    return { error: `İş Yatırım'da ${code} için XI_29 yıllık veri bulunamadı (banka/sigorta veya henüz desteklenmiyor olabilir)` };
  }

  // 5Y CAGR için ek 4 yıl (Y-4..Y-7) — başarısızsa graceful (fewer-years CAGR).
  const olderYears = [anchorYear - 4, anchorYear - 5, anchorYear - 6, anchorYear - 7];
  const older = await isyFetch(code, "XI_29", olderYears);

  // byCode[itemCode][year] = numeric value
  const byCode = {};
  const ingest = (rows, years) => {
    for (const r of rows) {
      const c = r.itemCode;
      if (!byCode[c]) byCode[c] = {};
      for (let i = 0; i < 4; i++) {
        const v = r[`value${i + 1}`];
        if (v != null && v !== "") byCode[c][years[i]] = +v;
      }
    }
  };
  ingest(primary, [anchorYear, anchorYear - 1, anchorYear - 2, anchorYear - 3]);
  if (older) ingest(older, olderYears);

  const get = (concept, year) => {
    const c = BIST_CONCEPTS[concept];
    if (!c) return null;
    const v = byCode[c]?.[year];
    return (v == null || !isFinite(v)) ? null : v;
  };

  const Y = anchorYear;
  const revenue         = get("revenue", Y);
  const grossProfit     = get("grossProfit", Y);
  const operatingIncome = get("operatingIncome", Y);
  const netIncome       = get("netIncome", Y);
  const marketing       = get("marketing", Y);
  const generalAdmin    = get("generalAdmin", Y);
  const interestExpRaw  = get("interestExp", Y);
  const totalAssets     = get("totalAssets", Y);
  const cash            = get("cash", Y);
  const shortTermLiab   = get("shortTermLiab", Y);
  const longTermLiab    = get("longTermLiab", Y);
  const shortTermDebt   = get("shortTermDebt", Y);
  const longTermDebt    = get("longTermDebt", Y);
  const totalEquity     = get("totalEquity", Y);
  const retained        = get("retained", Y);
  const da              = get("da", Y);
  const ocf             = get("ocf", Y);
  const capexRaw        = get("capex", Y);
  const fcf             = get("fcf", Y);

  // SG&A = Marketing + G&A (mutlak değer; raw negatif gelir)
  const sga = (() => {
    const m = marketing != null ? Math.abs(marketing) : 0;
    const g = generalAdmin != null ? Math.abs(generalAdmin) : 0;
    return (m + g) || null;
  })();
  const interestAbs = interestExpRaw != null ? Math.abs(interestExpRaw) : null;
  const capexAbs    = capexRaw != null ? Math.abs(capexRaw) : null;
  // totalLiab: kısa+uzun vadeli; eksikse Assets - Equity ile yedek
  const totalLiab = (shortTermLiab != null && longTermLiab != null)
    ? shortTermLiab + longTermLiab
    : (totalAssets != null && totalEquity != null ? totalAssets - totalEquity : null);
  const totalDebt = (shortTermDebt || 0) + (longTermDebt || 0);

  // CAGR — Y-4 → Y-1'e kadar fallback (FMP/EDGAR ile aynı semantik)
  const cagrFor = (concept) => {
    const newest = get(concept, Y);
    if (newest == null) return { val: null, years: 0 };
    for (let years = 4; years >= 1; years--) {
      const oldest = get(concept, Y - years);
      if (oldest != null) return { val: cagr(oldest, newest, years), years };
    }
    return { val: null, years: 0 };
  };
  const revC  = cagrFor("revenue");
  const earnC = cagrFor("netIncome");
  const yearsBackUsed = Math.max(revC.years, earnC.years);

  const metrics = {
    revenueGrowth5Y:    revC.val,
    earningsGrowth5Y:   earnC.val,
    grossMargin:        div(grossProfit, revenue),
    operatingMargin:    div(operatingIncome, revenue),
    netMargin:          div(netIncome, revenue),
    fcfMargin:          div(fcf, revenue),
    sgaToGrossProfit:   div(sga, grossProfit),
    depToGrossProfit:   div(da, grossProfit),
    interestToOpIncome: div(interestAbs, operatingIncome),
    liabToEquity:       div(totalLiab, totalEquity),
    retainedToEquity:   div(retained, totalEquity),
    roe:                div(netIncome, totalEquity),
    roa:                div(netIncome, totalAssets),
    roic:               div(netIncome, (totalEquity || 0) + totalDebt - (cash || 0)),
    pe:                 null,  // BIST: meta.pe_ratio'dan FE inject (ileride: market_cap × shares)
    ps:                 null,
    capexToNetIncome:   div(capexAbs, netIncome),
    capexToSales:       div(capexAbs, revenue),
    capexToOcf:         div(capexAbs, ocf),
    ebitToInterest:     div(operatingIncome, interestAbs),
    netDebtToFcf:       div(totalDebt - (cash || 0), fcf),
  };

  const result = {
    metrics,
    annual: Array.from({length:5},(_,i)=>Y-4+i)
      .map(yr=>({
        year: String(yr),
        revenue: get("revenue",yr),
        netIncome: get("netIncome",yr),
        operatingIncome: get("operatingIncome",yr),
      }))
      .filter(y=>y.revenue!=null),
    raw: {
      latestFiscalYear: anchorYear,
      yearsBackUsed,
      financialGroup: "XI_29",
      currency: "TRY",
    }
  };

  bistFundCache.set(code, { data: result, at: Date.now() });
  return result;
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
    annual: inc.slice(0,5).reverse().map(y=>({
      year: y.calendarYear||y.fiscalYear||y.date?.slice(0,4),
      revenue: y.revenue??null,
      netIncome: y.netIncome??null,
      operatingIncome: y.operatingIncome??null,
    })).filter(y=>y.year),
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

    // Mode: ticker-list — US (SEC EDGAR) + BIST (Twelve Data) merged.
    // Browser SEC'e direkt fetch yapamaz (User-Agent zorunluluğu); edge
    // function proxy görevi görür. BIST için Twelve Data /stocks reference
    // free tier'da açık (~640 ticker).
    if (body.mode === "ticker-list") {
      const [usDb, bistList] = await Promise.all([getTickerDb(), getBistList()]);
      const list = [
        ...Object.entries(usDb).map(([ticker, info]) => ({ ticker, name: info.name, exchange: "US" })),
        ...bistList.map(x => ({ ...x, exchange: "XIST" })),
      ];
      return json({
        list, count: list.length,
        us_count: Object.keys(usDb).length,
        bist_count: bistList.length,
        fetched_at: new Date().toISOString()
      });
    }

    // Mode: sync-ticker-db — ticker_db Supabase tablosunu SEC EDGAR + Twelve Data
    // ile günceller. pg_cron (haftalık) tarafından CRON_SECRET ile çağrılır.
    // Frontend artık bu modu değil; doğrudan Supabase SELECT kullanır.
    if (body.mode === "sync-ticker-db") {
      const cronSecret = Deno.env.get("CRON_SECRET");
      if (!cronSecret || cronSecret.length < 16) return json({ error: "CRON_SECRET not configured" }, 500);
      const auth = req.headers.get("Authorization") || "";
      const expected = `Bearer ${cronSecret}`;
      const enc = new TextEncoder();
      const ab = enc.encode(auth), eb = enc.encode(expected);
      let mismatch = ab.length !== eb.length ? 1 : 0;
      const len = Math.max(ab.length, eb.length);
      for (let i = 0; i < len; i++) mismatch |= (ab[i] ?? 0) ^ (eb[i] ?? 0);
      if (mismatch !== 0) return json({ error: "unauthorized" }, 401);

      const supaUrl    = Deno.env.get("SUPABASE_URL");
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (!supaUrl || !serviceKey) return json({ error: "supabase secrets eksik" }, 500);

      const supa = createClient(supaUrl, serviceKey, { auth: { persistSession: false } });
      const [usDb, bistList] = await Promise.all([getTickerDb(), getBistList()]);
      const now  = new Date().toISOString();
      const rows = [
        ...Object.entries(usDb).map(([ticker, info]) => ({ ticker, name: info.name, exchange: "US",   updated_at: now })),
        ...bistList.map(x => ({ ticker: x.ticker, name: x.name, exchange: "XIST", updated_at: now })),
      ];

      // Batch upsert (Supabase 1000-row limit)
      const BATCH = 500;
      let inserted = 0;
      for (let i = 0; i < rows.length; i += BATCH) {
        const { error } = await supa.from("ticker_db").upsert(rows.slice(i, i + BATCH), { onConflict: "ticker" });
        if (error) throw new Error(`upsert batch ${Math.floor(i/BATCH)}: ${error.message}`);
        inserted += Math.min(BATCH, rows.length - i);
      }

      return json({ synced: inserted, us: Object.keys(usDb).length, bist: bistList.length, synced_at: now });
    }

    const { ticker, asset_type } = body;
    if (!ticker) return json({ error: "ticker required" }, 400);

    // BIST → İş Yatırım MaliTablo (FMP/EDGAR US-only). Bankalar şimdilik kapsam dışı.
    if (asset_type === "BIST") {
      const bist = await fetchBist(ticker);
      if (bist.error) return json({ error: bist.error }, 422);
      return json({
        ticker,
        fetched_at: new Date().toISOString(),
        source: "isyatirim",
        metrics: bist.metrics,
        raw: bist.raw,
      });
    }

    const fmpKey = Deno.env.get("FMP_KEY");
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
      // EDGAR de fail oldu — out-of-plan code'u FE warn-card için stable işaret
      return json({
        code: "OUT_OF_PLAN",
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
