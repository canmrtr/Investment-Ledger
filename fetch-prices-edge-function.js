// Multi-provider price fetcher.
//   - US/global stocks, ETF, FX, crypto → Massive.com (Polygon clone)
//   - BIST hisseleri (XIST exchange) → Twelve Data
//
// Routing: body'de `asset_type:"BIST"` gelirse veya ticker `.IS` suffix'liyse
// Twelve Data, aksi halde Massive. Frontend asset_type'ı geçirmeyi tercih eder.
//
// Body: { ticker, mode, date?, from?, to?, asset_type? }
// Modes: "price" (default), "historical", "meta"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

const yesterdayISO = () => new Date(Date.now() - 86400000).toISOString().split("T")[0];
const yearAgoISO   = () => new Date(Date.now() - 366 * 86400000).toISOString().split("T")[0];

// ── Twelve Data (BIST) ───────────────────────────────────────────────

async function tdPrice(ticker, date, apiKey) {
  // Spesifik tarih için time_series; tarih yoksa /price (en güncel)
  const url = date
    ? `https://api.twelvedata.com/time_series?symbol=${ticker}&exchange=XIST&interval=1day&start_date=${date}&end_date=${date}&apikey=${apiKey}`
    : `https://api.twelvedata.com/price?symbol=${ticker}&exchange=XIST&apikey=${apiKey}`;
  const r = await fetch(url);
  if (!r.ok) return { error: `Twelve Data HTTP ${r.status}` };
  const d = await r.json();
  if (d.status === "error" || d.code) return { error: d.message || `code ${d.code}` };
  if (date) {
    const v = Array.isArray(d.values) ? d.values[0] : null;
    if (v?.close) return { price: parseFloat(v.close), currency: "TRY" };
    return { error: "Tarihte veri yok" };
  } else {
    if (d.price) return { price: parseFloat(d.price), currency: "TRY" };
    return { error: "Fiyat alınamadı" };
  }
}

async function tdHistorical(ticker, from, to, apiKey) {
  const url = `https://api.twelvedata.com/time_series?symbol=${ticker}&exchange=XIST&interval=1day&start_date=${from}&end_date=${to}&order=asc&outputsize=400&apikey=${apiKey}`;
  const r = await fetch(url);
  if (!r.ok) return {};
  const d = await r.json();
  if (d.status === "error" || !Array.isArray(d.values) || d.values.length < 2) return {};
  // Twelve Data bar'ları en yeni-en eski sıralayabilir (order=asc gönderdik ama yine de güvenli)
  const bars = d.values
    .map(v => ({ t: new Date(v.datetime).getTime(), c: parseFloat(v.close) }))
    .filter(b => !isNaN(b.c))
    .sort((a, b) => a.t - b.t);
  const n = bars.length, last = bars[n - 1].c;
  const get = (i) => (i >= 0 && i < n ? bars[i].c : null);
  const chg = (old) => (old != null ? (last / old - 1) * 100 : null);
  const p_d1 = get(n-2), p_w1 = get(n-6), p_m1 = get(n-22);
  const p_m3 = get(n-66), p_m6 = get(n-132), p_y1 = get(0);
  return { price: last, currency: "TRY", d1: chg(p_d1), w1: chg(p_w1), m1: chg(p_m1), y1: chg(p_y1), p_d1, p_w1, p_m1, p_m3, p_m6, p_y1 };
}

async function tdMeta(ticker, apiKey) {
  const url = `https://api.twelvedata.com/stocks?symbol=${ticker}&exchange=XIST&apikey=${apiKey}`;
  const r = await fetch(url);
  if (!r.ok) return { error: `Twelve Data HTTP ${r.status}` };
  const d = await r.json();
  const x = Array.isArray(d.data) ? d.data[0] : null;
  if (!x) return { error: "BIST'te ticker bulunamadı" };
  return {
    name: x.name,
    market: "stocks",
    locale: "tr",
    primary_exchange: "XIST",
    type: x.type || "Common Stock",
    currency: x.currency || "TRY",
    // Twelve Data /stocks limited fields; description/market_cap için fundamentals endpoint gerek
  };
}

// ── Massive (US/global) ──────────────────────────────────────────────

async function massivePrice(ticker, date, apiKey) {
  const url = `https://api.massive.com/v1/open-close/${ticker}/${date}?apiKey=${apiKey}`;
  const r = await fetch(url);
  if (!r.ok) {
    const errText = await r.text();
    return { error: `HTTP ${r.status}`, raw: errText.slice(0, 100) };
  }
  const text = await r.text();
  const trimmed = text.trim();
  if (trimmed.startsWith("{")) {
    try {
      const json = JSON.parse(trimmed);
      if (json.close != null) return { price: parseFloat(json.close) };
      if (json.c != null)     return { price: parseFloat(json.c) };
      return { error: "Fiyat alanı yok", raw: trimmed.slice(0, 200) };
    } catch (e) {
      return { error: "JSON parse hatası: " + e.message };
    }
  }
  // CSV fallback
  const lines = trimmed.split("\n");
  const row = lines[1];
  if (row && row.trim()) {
    const cols = row.trim().split(",");
    if (cols.length >= 6) return { price: parseFloat(cols[5]) };
  }
  return { error: "Boş response" };
}

async function massiveHistorical(ticker, from, to, apiKey) {
  const url = `https://api.massive.com/v2/aggs/ticker/${ticker}/range/1/day/${from}/${to}?adjusted=true&limit=400&apiKey=${apiKey}`;
  const r = await fetch(url);
  if (!r.ok) return {};
  const d = await r.json();
  if (!d.results || d.results.length <= 1) return {};
  const bars = d.results.sort((a, b) => a.t - b.t);
  const n = bars.length, last = bars[n - 1].c;
  const get = (i) => (i >= 0 && i < n ? bars[i].c : null);
  const chg = (old) => (old != null ? (last / old - 1) * 100 : null);
  const p_d1 = get(n-2), p_w1 = get(n-6), p_m1 = get(n-22);
  const p_m3 = get(n-66), p_m6 = get(n-132), p_y1 = get(0);
  return { price: last, d1: chg(p_d1), w1: chg(p_w1), m1: chg(p_m1), y1: chg(p_y1), p_d1, p_w1, p_m1, p_m3, p_m6, p_y1 };
}

async function massiveMeta(ticker, apiKey) {
  const url = `https://api.massive.com/v3/reference/tickers/${ticker}?apiKey=${apiKey}`;
  const r = await fetch(url);
  if (!r.ok) {
    const errText = await r.text();
    return { error: `HTTP ${r.status}`, raw: errText.slice(0, 200) };
  }
  const d = await r.json();
  const x = d.results;
  if (!x) return { error: "results yok", raw: JSON.stringify(d).slice(0, 200) };
  return {
    name: x.name,
    market: x.market,
    locale: x.locale,
    primary_exchange: x.primary_exchange,
    type: x.type,
    currency: x.currency_name,
    market_cap: x.market_cap,
    description: x.description,
    homepage_url: x.homepage_url,
    sic_description: x.sic_description,
    total_employees: x.total_employees,
    list_date: x.list_date,
    phone_number: x.phone_number,
    address: x.address,
    logo_url: x.branding?.logo_url,
    icon_url: x.branding?.icon_url,
    shares_outstanding: x.weighted_shares_outstanding || x.share_class_shares_outstanding,
  };
}

// ── Handler ──────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (body, status = 200) => new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" }
  });

  try {
    const { ticker, mode, date, from, to, asset_type } = await req.json();
    if (!ticker) return json({ error: "ticker required" }, 400);

    const massiveKey = Deno.env.get("MASSIVE_KEY");
    const tdKey      = Deno.env.get("TWELVEDATA_KEY");

    // Routing: BIST için asset_type veya .IS suffix
    const isBist = asset_type === "BIST" || /\.IS$/i.test(ticker);
    const cleanTicker = ticker.replace(/\.IS$/i, "");

    // Provider key check
    if (isBist && !tdKey) {
      return json({ ticker, result: { error: "TWELVEDATA_KEY secret eksik" }, date: "" });
    }
    if (!isBist && !massiveKey) {
      return json({ ticker, result: { error: "MASSIVE_KEY secret eksik" }, date: "" });
    }

    const priceDate = date || yesterdayISO();
    const fromDate  = from || yearAgoISO();
    const toDate    = to   || yesterdayISO();

    let result = {};

    if (mode === "historical") {
      result = isBist
        ? await tdHistorical(cleanTicker, fromDate, toDate, tdKey)
        : await massiveHistorical(ticker, fromDate, toDate, massiveKey);
    } else if (mode === "meta") {
      result = isBist
        ? await tdMeta(cleanTicker, tdKey)
        : await massiveMeta(ticker, massiveKey);
    } else {
      // Default: price mode
      result = isBist
        ? await tdPrice(cleanTicker, date, tdKey)  // BIST: tarih yoksa /price latest
        : await massivePrice(ticker, priceDate, massiveKey);
    }

    return json({ ticker, result, date: priceDate, source: isBist ? "twelvedata" : "massive" });

  } catch (err) {
    return json({ error: err.message }, 500);
  }
});
