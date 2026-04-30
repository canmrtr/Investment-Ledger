// Multi-provider price fetcher.
//   - US/global stocks, ETF, FX, crypto → Massive.com (Polygon clone)
//   - BIST hisseleri:
//     · price + historical → Yahoo Finance unofficial chart endpoint (free, no auth)
//     · meta → Twelve Data /stocks reference (free tier OK)
//   Twelve Data free tier US-only market data verir; reference data tüm
//   borsalar için açık. Yahoo `THYAO.IS` formatını kullanır.
//
// Routing: body'de `asset_type:"BIST"` gelirse veya ticker `.IS` suffix'liyse
// BIST kolu, aksi halde Massive.
//
// Body: { ticker, mode, date?, from?, to?, asset_type? }
// Modes: "price" (default), "historical", "meta"

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://canmrtr.github.io",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const yesterdayISO = () => new Date(Date.now() - 86400000).toISOString().split("T")[0];
const yearAgoISO   = () => new Date(Date.now() - 366 * 86400000).toISOString().split("T")[0];

// ── Yahoo Finance (BIST price/historical) ───────────────────────────
// Unofficial chart endpoint — auth yok, ücretsiz, ~5 yıl stabil. Yahoo
// `.IS` suffix'i ile BIST'i destekler (THYAO.IS, ASELS.IS).
// User-Agent gerekli (Yahoo bot algılaması browser-benzeri header bekler).
const YF_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36";

// addIS: BIST için ".IS" suffix ekler; US tickers için false geç.
async function yfChart(ticker, range = "1y", interval = "1d", addIS = true) {
  const sym = addIS
    ? (/\.[A-Z]+$/i.test(ticker) ? ticker : `${ticker}.IS`)
    : ticker;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=${range}&interval=${interval}`;
  const r = await fetch(url, { headers: { "User-Agent": YF_UA } });
  if (!r.ok) return { error: `Yahoo HTTP ${r.status}` };
  const d = await r.json();
  if (d.chart?.error) return { error: d.chart.error.description || "Yahoo chart error" };
  const res = d.chart?.result?.[0];
  if (!res) return { error: "Yahoo: result yok" };
  return { meta: res.meta, ts: res.timestamp || [], close: res.indicators?.quote?.[0]?.close || [] };
}

async function yfPrice(ticker, date) {
  // Tarih verilmezse meta.regularMarketPrice; verilirse o tarihteki close
  if (!date) {
    const c = await yfChart(ticker, "5d");
    if (c.error) return { error: c.error };
    const last = c.meta?.regularMarketPrice ?? c.close.filter(v => v != null).pop();
    if (last == null) return { error: "Fiyat yok" };
    return { price: last, currency: c.meta?.currency || "TRY" };
  }
  // Spesifik tarih için 1y range çekip o tarihin yakınını bul
  const c = await yfChart(ticker, "1y");
  if (c.error) return { error: c.error };
  const target = new Date(date).getTime() / 1000;
  let bestIdx = -1, bestDiff = Infinity;
  for (let i = 0; i < c.ts.length; i++) {
    const diff = Math.abs(c.ts[i] - target);
    if (diff < bestDiff && c.close[i] != null) { bestDiff = diff; bestIdx = i; }
  }
  if (bestIdx < 0) return { error: "Tarihte veri yok" };
  return { price: c.close[bestIdx], currency: c.meta?.currency || "TRY" };
}

async function yfHistorical(ticker) {
  const c = await yfChart(ticker, "1y");
  if (c.error) return { error: `yfHistorical: ${c.error}` };
  const bars = [];
  for (let i = 0; i < c.ts.length; i++) {
    if (c.close[i] != null) bars.push({ t: c.ts[i] * 1000, c: c.close[i] });
  }
  if (bars.length < 2) return { error: "yfHistorical: yetersiz veri" };
  bars.sort((a, b) => a.t - b.t);
  const n = bars.length, last = bars[n - 1].c;
  const get = (i) => (i >= 0 && i < n ? bars[i].c : null);
  const chg = (old) => (old != null ? (last / old - 1) * 100 : null);
  const p_d1 = get(n-2), p_w1 = get(n-6), p_m1 = get(n-22);
  const p_m3 = get(n-66), p_m6 = get(n-132), p_y1 = get(0);
  return {
    price: last,
    currency: c.meta?.currency || "TRY",
    d1: chg(p_d1), w1: chg(p_w1), m1: chg(p_m1), y1: chg(p_y1),
    p_d1, p_w1, p_m1, p_m3, p_m6, p_y1
  };
}

// US hisseleri için Yahoo Finance — addIS=false, currency sabit "USD".
async function yfHistoricalUS(ticker) {
  const c = await yfChart(ticker, "1y", "1d", false);
  if (c.error) return { error: `yfHistoricalUS: ${c.error}` };
  const bars = [];
  for (let i = 0; i < c.ts.length; i++) {
    if (c.close[i] != null) bars.push({ t: c.ts[i] * 1000, c: c.close[i] });
  }
  if (bars.length < 2) return { error: "yfHistoricalUS: yetersiz veri" };
  bars.sort((a, b) => a.t - b.t);
  const n = bars.length, last = bars[n - 1].c;
  const get = (i) => (i >= 0 && i < n ? bars[i].c : null);
  const chg = (old) => (old != null ? (last / old - 1) * 100 : null);
  const p_d1 = get(n-2), p_w1 = get(n-6), p_m1 = get(n-22);
  const p_m3 = get(n-66), p_m6 = get(n-132), p_y1 = get(0);
  return {
    price: last,
    currency: "USD",
    d1: chg(p_d1), w1: chg(p_w1), m1: chg(p_m1), y1: chg(p_y1),
    p_d1, p_w1, p_m1, p_m3, p_m6, p_y1
  };
}

async function yfPriceUS(ticker, date) {
  if (!date) {
    const c = await yfChart(ticker, "5d", "1d", false);
    if (c.error) return { error: c.error };
    const last = c.meta?.regularMarketPrice ?? c.close.filter(v => v != null).pop();
    if (last == null) return { error: "Fiyat yok" };
    return { price: last, currency: "USD" };
  }
  const c = await yfChart(ticker, "1y", "1d", false);
  if (c.error) return { error: c.error };
  const target = new Date(date).getTime() / 1000;
  let bestIdx = -1, bestDiff = Infinity;
  for (let i = 0; i < c.ts.length; i++) {
    const diff = Math.abs(c.ts[i] - target);
    if (diff < bestDiff && c.close[i] != null) { bestDiff = diff; bestIdx = i; }
  }
  if (bestIdx < 0) return { error: "Tarihte veri yok" };
  return { price: c.close[bestIdx], currency: "USD" };
}

// ── Twelve Data (BIST meta — reference data free tier) ──────────────

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
  };
}

// ── borsa-mcp (BIST profile — sektör, market cap, PE, temettü, 52W) ─
// Public hosted MCP server (saidsurucu/borsa-mcp, MIT). yfinance üzerinden
// BIST profili veriyor. SSE-format JSON-RPC; session ID handshake gerek.
const MCP_URL = "https://borsamcp.fastmcp.app/mcp";
let mcpSession = null;

async function mcpInitialize() {
  const r = await fetch(MCP_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json, text/event-stream"
    },
    body: JSON.stringify({
      jsonrpc: "2.0", id: 1, method: "initialize",
      params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "investment-ledger", version: "1.0" } }
    })
  });
  const sid = r.headers.get("mcp-session-id");
  if (!sid) throw new Error("MCP session header yok");
  // initialized notification (gerek olabilir, server tolere ediyor ama gönderiyoruz)
  await fetch(MCP_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept": "application/json, text/event-stream", "mcp-session-id": sid },
    body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" })
  });
  return sid;
}

async function mcpCallTool(toolName, args) {
  if (!mcpSession) mcpSession = await mcpInitialize();
  const doCall = async (sid) => fetch(MCP_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept": "application/json, text/event-stream", "mcp-session-id": sid },
    body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method: "tools/call", params: { name: toolName, arguments: args } })
  });
  let r = await doCall(mcpSession);
  if (r.status === 401 || r.status === 404) {
    // Session expired → re-init and retry once
    mcpSession = await mcpInitialize();
    r = await doCall(mcpSession);
  }
  if (!r.ok) throw new Error(`MCP HTTP ${r.status}`);
  // SSE response: "event: message\ndata: {...}\n\n"
  const text = await r.text();
  const dataLine = text.split("\n").find(l => l.startsWith("data: "));
  if (!dataLine) throw new Error("MCP: data satırı yok");
  const j = JSON.parse(dataLine.slice(6));
  if (j.error) throw new Error(j.error.message || "MCP error");
  return j.result?.structuredContent || null;
}

async function mcpProfile(ticker) {
  try {
    const result = await mcpCallTool("get_profile", { symbol: ticker, market: "bist" });
    return result?.profile || null;
  } catch (_) {
    return null;  // sessizce başarısız ol; çağıran fallback yapar
  }
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
  if (!r.ok) return { error: `massiveHistorical: HTTP ${r.status}` };
  const d = await r.json();
  if (!d.results || d.results.length <= 1) return { error: "massiveHistorical: yetersiz veri" };
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
    // Ticker format validation — path traversal / SSRF prevention
    if (!/^[A-Z0-9:.\-_]{1,30}$/i.test(ticker)) return json({ error: "Geçersiz ticker formatı" }, 400);

    const massiveKey = Deno.env.get("MASSIVE_KEY");
    const tdKey      = Deno.env.get("TWELVEDATA_KEY");

    // Routing: BIST için asset_type veya .IS suffix
    const isBist = asset_type === "BIST" || /\.IS$/i.test(ticker);
    const cleanTicker = ticker.replace(/\.IS$/i, "");
    // CRYPTO normalize: BTC/eth/eth-usd/BTC/USDT → X:{BASE}USD (Massive formatı).
    // X:/C:/I: ile başlıyorsa sadece uppercase. Quote currency (USDT/USDC/USD) strip:
    // split(/[-_/]/)[0] base'i alır, geri kalan sembolleri sanitize eder.
    const isCrypto = asset_type === "CRYPTO";
    let cryptoTicker = ticker;
    if (isCrypto) {
      if (/^[XCI]:/i.test(ticker)) {
        cryptoTicker = ticker.toUpperCase();
      } else {
        const base = ticker.toUpperCase().split(/[-_/]/)[0].replace(/[^A-Z0-9]/g, "");
        if (!base || base.length > 10) {
          return json({ ticker, result: { error: "Geçersiz kripto ticker formatı (örn: BTC, ETH)" }, date: "" });
        }
        cryptoTicker = `X:${base}USD`;
      }
    }
    // GOLD normalize: emtia kodları (XAU/XAG/XPT/XPD) → C:{SYM}USD.
    // Türkçe ad da kabul: ALTIN→XAU, GUMUS/GÜMÜŞ→XAG, PLATIN→XPT, PALADYUM→XPD.
    // Massive C: prefix'i forex/emtia için ortak; XAUUSD = 1 ons spot altın USD.
    const isGold = asset_type === "GOLD";
    let goldTicker = ticker;
    if (isGold) {
      if (/^[XCI]:/i.test(ticker)) {
        goldTicker = ticker.toUpperCase();
      } else {
        const upper = ticker.toUpperCase().replace(/Ü/g,"U").replace(/Ş/g,"S").replace(/[^A-Z]/g, "");
        const map = {
          XAU:"XAU", ALTIN:"XAU", GOLD:"XAU",
          XAG:"XAG", GUMUS:"XAG", SILVER:"XAG",
          XPT:"XPT", PLATIN:"XPT", PLATINUM:"XPT",
          XPD:"XPD", PALADYUM:"XPD", PALLADIUM:"XPD",
        };
        const sym = map[upper];
        if (!sym) {
          return json({ ticker, result: { error: "Geçersiz emtia kodu (XAU/XAG/XPT/XPD)" }, date: "" });
        }
        goldTicker = `C:${sym}USD`;
      }
    }
    const massiveTicker = isCrypto ? cryptoTicker : isGold ? goldTicker : ticker;

    // Provider key check
    if (!isBist && !massiveKey) {
      return json({ ticker, result: { error: "MASSIVE_KEY secret eksik" }, date: "" });
    }
    if (isBist && mode === "meta" && !tdKey) {
      return json({ ticker, result: { error: "TWELVEDATA_KEY secret eksik" }, date: "" });
    }

    const priceDate = date || yesterdayISO();
    const fromDate  = from || yearAgoISO();
    const toDate    = to   || yesterdayISO();

    let result = {};
    let source = isBist ? "yahoo" : "massive";

    if (mode === "historical") {
      if (isBist) {
        result = await yfHistorical(cleanTicker);
      } else {
        // US: Yahoo Finance birincil (gerçek zamanlı, ücretsiz); Massive yedek.
        // Crypto (X:) ve Gold (C:) Yahoo'da desteklenmez → direkt Massive.
        if (/^[XCI]:/i.test(massiveTicker)) {
          result = await massiveHistorical(massiveTicker, fromDate, toDate, massiveKey);
        } else {
          result = await yfHistoricalUS(ticker);
          if (!result?.error) {
            source = "yahoo";
          } else {
            result = await massiveHistorical(massiveTicker, fromDate, toDate, massiveKey);
            if (!result?.error) source = "massive-fallback";
          }
        }
      }
    } else if (mode === "meta") {
      // BIST: Twelve Data /stocks (name) + borsa-mcp get_profile (sektör, market cap, PE...)
      // paralel çek + merge.
      if (isBist) {
        const [td, prof] = await Promise.all([
          tdMeta(cleanTicker, tdKey),
          mcpProfile(cleanTicker),
        ]);
        result = {
          name: td?.name || prof?.name || cleanTicker,
          market: "stocks",
          locale: "tr",
          primary_exchange: "XIST",
          type: td?.type || "Common Stock",
          currency: prof?.currency || td?.currency || "TRY",
          // borsa-mcp profile alanları
          sic_description: prof?.sector || null,
          industry: prof?.industry || null,
          market_cap: prof?.market_cap || null,
          homepage_url: prof?.website ? prof.website.split(/\s|\/?http/)[0].trim() : null,
          total_employees: prof?.employees || null,
          country: prof?.country || "Turkey",
          // BIST-spesifik mini stats (FE ek satır olarak gösterir)
          pe_ratio: prof?.pe_ratio || null,
          dividend_yield: prof?.dividend_yield || null,
          week_52_high: prof?.week_52_high || null,
          week_52_low: prof?.week_52_low || null,
          beta: prof?.beta || null,
        };
        source = prof ? "twelvedata+borsa-mcp" : "twelvedata";
      }
      else result = await massiveMeta(massiveTicker, massiveKey);
    } else {
      // Default: price mode — BIST ve US için Yahoo; US Massive yedek.
      // Crypto (X:) ve Gold (C:) Yahoo'da desteklenmez → direkt Massive.
      if (isBist) {
        result = await yfPrice(cleanTicker, date);
      } else if (/^[XCI]:/i.test(massiveTicker)) {
        result = await massivePrice(massiveTicker, priceDate, massiveKey);
      } else {
        result = await yfPriceUS(ticker, date);
        if (!result?.error) {
          source = "yahoo";
        } else {
          result = await massivePrice(massiveTicker, priceDate, massiveKey);
          if (!result?.error) source = "massive-fallback";
        }
      }
    }

    // historical fetch başarılıysa price_cache'e yaz (service_role — frontend write-lock sonrası)
    if (mode === "historical" && result?.price != null && !result?.error) {
      const supaUrl = Deno.env.get("SUPABASE_URL");
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (supaUrl && serviceKey) {
        try {
          const supa = createClient(supaUrl, serviceKey, { auth: { persistSession: false } });
          await supa.from("price_cache").upsert(
            { ticker, price: result.price, d1: result.d1, w1: result.w1, m1: result.m1,
              y1: result.y1, p_d1: result.p_d1, p_w1: result.p_w1, p_m1: result.p_m1,
              p_m3: result.p_m3, p_m6: result.p_m6, p_y1: result.p_y1,
              updated_at: new Date().toISOString() },
            { onConflict: "ticker" }
          );
        } catch (_) { /* non-critical; frontend zaten veriyi aldı */ }
      }
    }

    return json({ ticker, result, date: priceDate, source });

  } catch (err) {
    return json({ error: err.message }, 500);
  }
});
