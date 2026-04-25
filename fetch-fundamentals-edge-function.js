// Financial Modeling Prep "stable" API'sinden fundamental veri çeker.
// 21 metriği value-investing checklist için hazır halde döner.
//
// Gerekli secret: FMP_KEY
// Body: { "ticker": "AAPL" }
//
// Notlar:
// - FMP free tier `limit` max 5; bu yüzden income-statement 5 yıl (4Y CAGR).
// - Stable API'de field adları legacy v3'ten farklı. Eşleme:
//   peRatioTTM → priceToEarningsRatioTTM (ratios)
//   roeTTM → returnOnEquityTTM (km'ye taşındı)
//   roicTTM → returnOnInvestedCapitalTTM
//   interestCoverageTTM → interestCoverageRatioTTM (ratios)
// - ratios-ttm doğrudan TTM margin'leri verir; inc-derived fallback olarak kalır.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

// CAGR (Compound Annual Growth Rate). years: kaç yıl üzerinden.
const cagr = (start, end, years) => {
  if (start == null || end == null || start <= 0 || years <= 0) return null;
  return Math.pow(end / start, 1 / years) - 1;
};

// Güvenli bölme — null/0 koruması.
const div = (a, b) => (a == null || b == null || b === 0) ? null : a / b;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { ticker } = await req.json();
    const fmpKey = Deno.env.get("FMP_KEY");
    if (!ticker) return new Response(JSON.stringify({ error: "ticker required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (!fmpKey) return new Response(JSON.stringify({ error: "FMP_KEY secret eksik" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const base = "https://financialmodelingprep.com/stable";
    const urls = {
      km:     `${base}/key-metrics-ttm?symbol=${ticker}&apikey=${fmpKey}`,
      ratios: `${base}/ratios-ttm?symbol=${ticker}&apikey=${fmpKey}`,
      inc:    `${base}/income-statement?symbol=${ticker}&period=annual&limit=5&apikey=${fmpKey}`,
      bs:     `${base}/balance-sheet-statement?symbol=${ticker}&period=annual&limit=1&apikey=${fmpKey}`,
      cf:     `${base}/cash-flow-statement?symbol=${ticker}&period=annual&limit=1&apikey=${fmpKey}`,
    };

    // text→JSON parse — FMP premium guard'ı bazen non-JSON ("Premium Query...") döndürür.
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

    if (!km && !ra && inc.length === 0 && !bs) {
      return new Response(JSON.stringify({
        error: "FMP'den veri alınamadı (ticker geçersiz veya plan kapsam dışı olabilir)",
        raw: { km: kmR, ratios: raR, inc: incR, bs: bsR, cf: cfR }
      }), { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Income statement — FMP yeni-eski sıralı döndürür (en yeni [0]).
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

    // Büyüme — 4Y CAGR (5 yıl veri → 4 yıl aralık)
    const revGrowth = cagr(incOldest?.revenue, revenue, yearsBack);
    const earnGrowth = cagr(incOldest?.netIncome, netIncome, yearsBack);

    const metrics = {
      // Büyüme
      revenueGrowth5Y: revGrowth,
      earningsGrowth5Y: earnGrowth,
      // Marjlar — TTM ratios primary, inc-derived fallback
      grossMargin:     ra?.grossProfitMarginTTM     ?? div(grossProfit, revenue),
      operatingMargin: ra?.operatingProfitMarginTTM ?? div(operatingIncome, revenue),
      netMargin:       ra?.netProfitMarginTTM       ?? div(netIncome, revenue),
      fcfMargin:       div(fcf, revenue),
      // Gider rasyoları (inc-derived)
      sgaToGrossProfit:   div(sga, grossProfit),
      depToGrossProfit:   div(dep, grossProfit),
      interestToOpIncome: div(interestExp, operatingIncome),
      // Bilanço
      liabToEquity:     ra?.debtToEquityRatioTTM ?? div(totalLiab, totalEquity),
      retainedToEquity: div(retained, totalEquity),
      // Verimlilik — stable'da km'ye taşındı
      roe:  km?.returnOnEquityTTM           ?? null,
      roa:  km?.returnOnAssetsTTM           ?? div(netIncome, totalAssets),
      roic: km?.returnOnInvestedCapitalTTM  ?? null,
      // Değerleme
      pe: ra?.priceToEarningsRatioTTM ?? null,
      ps: ra?.priceToSalesRatioTTM    ?? null,
      // CAPEX
      capexToNetIncome: div(capex, netIncome),
      capexToSales:     km?.capexToRevenueTTM             ?? div(capex, revenue),
      capexToOcf:       km?.capexToOperatingCashFlowTTM   ?? null,
      // Borç servisi
      // FMP, interest expense ~0 olan şirketlerde ratio'yu 0 olarak verir (∞ koruması) —
      // bu yanlış; düşük borçlu şirket aslında çok güçlü. ratio 0 ise inc-derived'e düş.
      ebitToInterest: (ra?.interestCoverageRatioTTM > 0) ? ra.interestCoverageRatioTTM : div(ebit, interestExp),
      netDebtToFcf:   div((totalDebt ?? 0) - (cash ?? 0), fcf),
    };

    return new Response(JSON.stringify({
      ticker,
      fetched_at: new Date().toISOString(),
      metrics,
      raw: {
        latestFiscalYear: incLatest?.fiscalYear || incLatest?.calendarYear || incLatest?.date?.slice(0,4),
        yearsBackUsed: yearsBack,
      }
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
