// Supabase Scheduled Edge Function: price_cache tablosunu en eski güncellenmiş
// ticker'lardan başlayarak partial-batch ile tazeler. Günde birkaç kez çağrılır
// (örn. 6 saatte bir) — her çağrıda ~5 ticker işler, edge function 50 sn
// CPU limitine sığar.
//
// Gerekli Secrets (Supabase Edge Functions → Manage Secrets):
//   MASSIVE_KEY                 (zaten mevcut — fetch-prices için)
//   SUPABASE_URL                (otomatik — platform sağlar)
//   SUPABASE_SERVICE_ROLE_KEY   (manuel eklenmeli)
//
// Body (opsiyonel): { "limit": 5 } — kaç ticker işlensin. Default 5.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://canmrtr.github.io",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const RATE_LIMIT_MS = 7500;
const DEFAULT_BATCH = 5;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const YF_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36";

// Yahoo Finance US historical (addIS=false).
const yfHistoricalUS = async (ticker) => {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=1y&interval=1d`;
  const r = await fetch(url, { headers: { "User-Agent": YF_UA }, signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`Yahoo HTTP ${r.status}`);
  const d = await r.json();
  if (d.chart?.error) throw new Error(d.chart.error.description || "Yahoo chart error");
  const res = d.chart?.result?.[0];
  if (!res) throw new Error("Yahoo: result yok");
  const ts = res.timestamp || [];
  const closes = res.indicators?.quote?.[0]?.close || [];
  const bars = [];
  for (let i = 0; i < ts.length; i++) {
    if (closes[i] != null) bars.push({ t: ts[i] * 1000, c: closes[i] });
  }
  if (bars.length < 2) throw new Error("Yahoo: yetersiz veri");
  bars.sort((a, b) => a.t - b.t);
  const n = bars.length, last = bars[n - 1].c;
  const get = (i) => (i >= 0 && i < n ? bars[i].c : null);
  const chg = (old) => (old != null ? (last / old - 1) * 100 : null);
  const p_d1 = get(n - 2), p_w1 = get(n - 6), p_m1 = get(n - 22);
  const p_m3 = get(n - 66), p_m6 = get(n - 132), p_y1 = get(0);
  return { price: last, d1: chg(p_d1), w1: chg(p_w1), m1: chg(p_m1), y1: chg(p_y1), p_d1, p_w1, p_m1, p_m3, p_m6, p_y1 };
};

// Massive.com historical — Yahoo başarısız olursa yedek.
const massiveHistorical = async (ticker, massiveKey) => {
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
  const yearAgo = new Date(Date.now() - 366 * 86400000).toISOString().split("T")[0];
  const url = `https://api.massive.com/v2/aggs/ticker/${ticker}/range/1/day/${yearAgo}/${yesterday}?adjusted=true&limit=400&apiKey=${massiveKey}`;
  const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const d = await r.json();
  if (!d.results || d.results.length < 2) throw new Error("insufficient data");
  const bars = d.results.sort((a, b) => a.t - b.t);
  const n = bars.length, last = bars[n - 1].c;
  const get = (i) => (i >= 0 && i < n ? bars[i].c : null);
  const chg = (old) => (old != null ? (last / old - 1) * 100 : null);
  const p_d1 = get(n - 2), p_w1 = get(n - 6), p_m1 = get(n - 22);
  const p_m3 = get(n - 66), p_m6 = get(n - 132), p_y1 = get(0);
  return { price: last, d1: chg(p_d1), w1: chg(p_w1), m1: chg(p_m1), y1: chg(p_y1), p_d1, p_w1, p_m1, p_m3, p_m6, p_y1 };
};

// Yahoo birincil, Massive yedek.
// Crypto (X:) ve Gold (C:) tickers Yahoo'da desteklenmez → direkt Massive.
const fetchHistorical = async (ticker, massiveKey) => {
  if (/^[XCI]:/i.test(ticker)) return massiveHistorical(ticker, massiveKey);
  try {
    return await yfHistoricalUS(ticker);
  } catch (_) {
    return await massiveHistorical(ticker, massiveKey);
  }
};

// Pozisyon tipine göre ticker'ı API formatına normalize et.
// Sonuç `fetchHistorical`'a gönderilir; price_cache'e OrijinalTicker ile yazılır.
const normalizeTicker = (ticker, type) => {
  if (type === "CRYPTO") {
    if (/^[XC]:/i.test(ticker)) return ticker.toUpperCase();
    // Base: split quote-pair separators, strip non-alphanum, then strip common quote suffixes.
    const base = ticker.toUpperCase().split(/[-_/]/)[0].replace(/[^A-Z0-9]/g, "");
    const stripped = base.replace(/(USDT?|USDC|BUSD|EUR|BTC|ETH)$/, "") || base;
    if (!stripped) throw new Error(`CRYPTO ticker "${ticker}" formatı geçersiz`);
    return `X:${stripped}USD`;
  }
  if (type === "GOLD") {
    if (/^[XC]:/i.test(ticker)) return ticker.toUpperCase();
    const upper = ticker.toUpperCase().replace(/Ü/g, "U").replace(/Ş/g, "S").replace(/[^A-Z]/g, "");
    const goldMap = { XAU:"XAU", ALTIN:"XAU", GOLD:"XAU", XAG:"XAG", GUMUS:"XAG", SILVER:"XAG", XPT:"XPT", PLATIN:"XPT", PLATINUM:"XPT", XPD:"XPD", PALADYUM:"XPD", PALLADIUM:"XPD" };
    const sym = goldMap[upper];
    if (!sym) throw new Error(`GOLD ticker "${ticker}" goldMap'te bulunamadı`);
    return `C:${sym}USD`;
  }
  if (type === "BIST") {
    if (/\.IS$/i.test(ticker)) return ticker.toUpperCase();
    return `${ticker.toUpperCase()}.IS`;
  }
  return ticker;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // CRON_SECRET guard — fail-closed: secret yoksa 500, yanlışsa 401.
  const cronSecret = Deno.env.get("CRON_SECRET");
  if (!cronSecret) {
    return new Response(JSON.stringify({ error: "CRON_SECRET not configured" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
  const auth = req.headers.get("Authorization") || "";
  const expected = `Bearer ${cronSecret}`;
  // XOR tabanlı constant-time compare — erken çıkış yok.
  const enc = new TextEncoder();
  const ab = enc.encode(auth), eb = enc.encode(expected);
  let mismatch = ab.length !== eb.length ? 1 : 0;
  const len = Math.max(ab.length, eb.length);
  for (let i = 0; i < len; i++) mismatch |= (ab[i] ?? 0) ^ (eb[i] ?? 0);
  if (mismatch !== 0) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  try {
    const massiveKey = Deno.env.get("MASSIVE_KEY");
    const supaUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!massiveKey || !supaUrl || !serviceKey) {
      return new Response(
        JSON.stringify({ error: "missing secrets (MASSIVE_KEY / SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Body opsiyonel
    let limit = DEFAULT_BATCH;
    try {
      const body = await req.json();
      if (typeof body.limit === "number" && body.limit > 0) limit = Math.min(body.limit, 7);
    } catch (_) { /* body yok / invalid — default */ }

    const supa = createClient(supaUrl, serviceKey, { auth: { persistSession: false } });

    // 1) Tüm user'lardan unique ticker listesi (RLS bypass).
    // FX hariç tüm desteklenen asset tipleri dahil edilir.
    // `type` alıyoruz — CRYPTO/GOLD tickers Massive formatına normalize etmek için gerekli.
    const REFRESHABLE_TYPES = ["US_STOCK", "FUND", "CRYPTO", "GOLD", "BIST"];
    const { data: posList, error: posErr } = await supa
      .from("positions")
      .select("ticker, type")
      .in("type", REFRESHABLE_TYPES);
    if (posErr) throw new Error("positions read failed: " + posErr.message);
    // ticker → type haritası (ilk occurrence kazanır — aynı ticker farklı portföyde olabilir)
    const tickerTypes = {};
    for (const p of (posList || [])) {
      if (!tickerTypes[p.ticker]) tickerTypes[p.ticker] = p.type;
    }
    const allTickers = Object.keys(tickerTypes);

    if (allTickers.length === 0) {
      return new Response(
        JSON.stringify({ message: "no refreshable tickers in positions", total: 0, processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2) Mevcut cache'i oku, stale-first sıralama için
    const { data: cacheList } = await supa.from("price_cache").select("ticker, updated_at");
    const cacheMap = Object.fromEntries((cacheList || []).map((c) => [c.ticker, c.updated_at]));

    // Sort: cache'te olmayanlar önce (epoch 0), sonra updated_at ASC
    const sorted = [...allTickers].sort((a, b) => {
      const ua = cacheMap[a] || "1970-01-01T00:00:00Z";
      const ub = cacheMap[b] || "1970-01-01T00:00:00Z";
      return ua.localeCompare(ub);
    });

    const batch = sorted.slice(0, limit);
    const ok = [];
    const failed = [];

    // 3) Her ticker için fetch + upsert (seri, rate-limit'li)
    for (let i = 0; i < batch.length; i++) {
      const t = batch[i];
      try {
        const apiTicker = normalizeTicker(t, tickerTypes[t]);
        const data = await fetchHistorical(apiTicker, massiveKey);
        const { error: upErr } = await supa.from("price_cache").upsert(
          { ticker: t, ...data, updated_at: new Date().toISOString() },
          { onConflict: "ticker" }
        );
        if (upErr) throw new Error("upsert: " + upErr.message);
        ok.push(t);
      } catch (e) {
        failed.push({ ticker: t, error: e.message });
      }
      if (i < batch.length - 1) await sleep(RATE_LIMIT_MS);
    }

    return new Response(
      JSON.stringify({
        total: allTickers.length,
        batch_size: batch.length,
        ok,
        failed,
        next_candidates: sorted.slice(limit, limit + 5),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
