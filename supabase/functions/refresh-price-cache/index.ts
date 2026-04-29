// Supabase Scheduled Edge Function: price_cache tablosunu en eski güncellenmiş
// ticker'lardan başlayarak partial-batch ile tazeler. Günde birkaç kez çağrılır
// (örn. 6 saatte bir) — her çağrıda ~5 ticker işler, edge function 50 sn
// CPU limitine sığar.
//
// Provider routing (fetch-prices ile paralel):
//   BIST              → Yahoo Finance (yfHistorical)
//   CRYPTO            → Massive (X:{BASE}USD normalize)
//   GOLD              → Massive (C:{SYM}USD normalize)
//   FX                → Massive (C:{BASE}{QUOTE} — ticker zaten normalize ise geç)
//   US_STOCK / FUND   → Massive (direkt ticker)
//
// Gerekli Secrets:
//   MASSIVE_KEY                 (zaten mevcut)
//   SUPABASE_URL                (platform otomatik sağlar)
//   SUPABASE_SERVICE_ROLE_KEY   (platform otomatik sağlar)
//   CRON_SECRET                 (fail-closed auth)

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://canmrtr.github.io",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MASSIVE_RATE_MS = 7500;
const DEFAULT_BATCH   = 5;
const YF_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Massive historical ───────────────────────────────────────────────
async function massiveHistorical(ticker, massiveKey) {
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
  const yearAgo   = new Date(Date.now() - 366 * 86400000).toISOString().split("T")[0];
  const url = `https://api.massive.com/v2/aggs/ticker/${ticker}/range/1/day/${yearAgo}/${yesterday}?adjusted=true&limit=400&apiKey=${massiveKey}`;
  const r = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!r.ok) return { error: `HTTP ${r.status}` };
  const d = await r.json();
  if (!d.results || d.results.length <= 1) return { error: "yetersiz veri" };
  const bars = d.results.sort((a, b) => a.t - b.t);
  const n = bars.length, last = bars[n - 1].c;
  const get = (i) => (i >= 0 && i < n ? bars[i].c : null);
  const chg = (old) => (old != null ? (last / old - 1) * 100 : null);
  const p_d1 = get(n-2), p_w1 = get(n-6), p_m1 = get(n-22);
  const p_m3 = get(n-66), p_m6 = get(n-132), p_y1 = get(0);
  return { price: last, d1: chg(p_d1), w1: chg(p_w1), m1: chg(p_m1), y1: chg(p_y1), p_d1, p_w1, p_m1, p_m3, p_m6, p_y1 };
}

// ── Yahoo Finance historical (BIST) ─────────────────────────────────
async function yfHistorical(rawTicker) {
  const sym = /\.[A-Z]+$/i.test(rawTicker) ? rawTicker : `${rawTicker}.IS`;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=1y&interval=1d`;
  const r = await fetch(url, { headers: { "User-Agent": YF_UA }, signal: AbortSignal.timeout(10000) });
  if (!r.ok) return { error: `Yahoo HTTP ${r.status}` };
  const d = await r.json();
  if (d.chart?.error) return { error: d.chart.error.description || "Yahoo chart error" };
  const res = d.chart?.result?.[0];
  if (!res) return { error: "Yahoo: result yok" };
  const ts    = res.timestamp || [];
  const close = res.indicators?.quote?.[0]?.close || [];
  const bars  = [];
  for (let i = 0; i < ts.length; i++) {
    if (close[i] != null) bars.push({ t: ts[i] * 1000, c: close[i] });
  }
  if (bars.length < 2) return { error: "yfHistorical: yetersiz veri" };
  bars.sort((a, b) => a.t - b.t);
  const n = bars.length, last = bars[n - 1].c;
  const get = (i) => (i >= 0 && i < n ? bars[i].c : null);
  const chg = (old) => (old != null ? (last / old - 1) * 100 : null);
  const p_d1 = get(n-2), p_w1 = get(n-6), p_m1 = get(n-22);
  const p_m3 = get(n-66), p_m6 = get(n-132), p_y1 = get(0);
  return { price: last, d1: chg(p_d1), w1: chg(p_w1), m1: chg(p_m1), y1: chg(p_y1), p_d1, p_w1, p_m1, p_m3, p_m6, p_y1 };
}

// ── Ticker → Massive API formatı normalize ───────────────────────────
// fetch-prices edge function ile paralel mantık.
function normalizeMassiveTicker(ticker, asset_type) {
  if (asset_type === "CRYPTO") {
    if (/^[XCI]:/i.test(ticker)) return ticker.toUpperCase();
    const base = ticker.toUpperCase().split(/[-_/]/)[0].replace(/[^A-Z0-9]/g, "");
    if (!base || base.length > 10) return null;
    return `X:${base}USD`;
  }
  if (asset_type === "GOLD") {
    if (/^[XCI]:/i.test(ticker)) return ticker.toUpperCase();
    const upper = ticker.toUpperCase().replace(/Ü/g,"U").replace(/Ş/g,"S").replace(/[^A-Z]/g, "");
    const map = { XAU:"XAU", ALTIN:"XAU", GOLD:"XAU", XAG:"XAG", GUMUS:"XAG", SILVER:"XAG", XPT:"XPT", PLATIN:"XPT", XPD:"XPD", PALADYUM:"XPD" };
    const sym = map[upper];
    if (!sym) return null;
    return `C:${sym}USD`;
  }
  if (asset_type === "FX") {
    if (/^[CI]:/i.test(ticker)) return ticker.toUpperCase();
    if (/^[A-Z]{6}$/.test(ticker.toUpperCase())) return `C:${ticker.toUpperCase()}`;
    return null;
  }
  // US_STOCK / FUND — ticker allowlist (Massive URL injection koruması)
  if (!/^[A-Z0-9.:_-]{1,20}$/i.test(ticker)) return null;
  return ticker.toUpperCase();
}

// ── CRON_SECRET constant-time compare ───────────────────────────────
function checkCronSecret(req, secret) {
  const auth = req.headers.get("Authorization") || "";
  const expected = `Bearer ${secret}`;
  const enc = new TextEncoder();
  const ab = enc.encode(auth), eb = enc.encode(expected);
  let mismatch = ab.length !== eb.length ? 1 : 0;
  const len = Math.max(ab.length, eb.length);
  for (let i = 0; i < len; i++) mismatch |= (ab[i] ?? 0) ^ (eb[i] ?? 0);
  return mismatch === 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const cronSecret = Deno.env.get("CRON_SECRET");
  if (!cronSecret) {
    return new Response(JSON.stringify({ error: "CRON_SECRET not configured" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
  if (!checkCronSecret(req, cronSecret)) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  try {
    const massiveKey = Deno.env.get("MASSIVE_KEY");
    const supaUrl    = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!massiveKey || !supaUrl || !serviceKey) {
      return new Response(
        JSON.stringify({ error: "missing secrets" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let limit = DEFAULT_BATCH;
    try {
      const body = await req.json();
      if (typeof body.limit === "number" && body.limit > 0) limit = Math.max(1, Math.min(Math.floor(body.limit), 10));
    } catch (_) { /* body yok */ }

    const supa = createClient(supaUrl, serviceKey, { auth: { persistSession: false } });

    // 1) Tüm asset tiplerinden unique (ticker, asset_type) çiftleri
    const { data: posList, error: posErr } = await supa
      .from("positions")
      .select("ticker, asset_type");
    if (posErr) throw new Error("positions read: " + posErr.message);

    // Ticker başına ilk gördüğümüz asset_type'ı al (deduplicate)
    const tickerMap = new Map(); // ticker → asset_type
    for (const p of (posList || [])) {
      if (p.ticker && !tickerMap.has(p.ticker)) tickerMap.set(p.ticker, p.asset_type || "US_STOCK");
    }
    const allTickers = [...tickerMap.keys()];

    if (allTickers.length === 0) {
      return new Response(
        JSON.stringify({ message: "no positions", total: 0, processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2) Stale-first sıralama
    const { data: cacheList } = await supa.from("price_cache").select("ticker, updated_at");
    const cacheMap = Object.fromEntries((cacheList || []).map((c) => [c.ticker, c.updated_at]));
    const sorted = [...allTickers].sort((a, b) => {
      const ua = cacheMap[a] || "1970-01-01T00:00:00Z";
      const ub = cacheMap[b] || "1970-01-01T00:00:00Z";
      return ua.localeCompare(ub);
    });

    const batch   = sorted.slice(0, limit);
    const ok      = [];
    const failed  = [];

    // 3) Fetch + upsert
    let massiveCallCount = 0;
    let bistCallCount = 0;
    for (let i = 0; i < batch.length; i++) {
      const t         = batch[i];
      const assetType = tickerMap.get(t) || "US_STOCK";
      const isBist    = assetType === "BIST";

      try {
        let data;
        if (isBist) {
          // Yahoo Finance: bot-block riskini azaltmak için çağrılar arası 1s bekleme
          if (bistCallCount > 0) await sleep(1000);
          data = await yfHistorical(t);
          bistCallCount++;
        } else {
          const massiveTicker = normalizeMassiveTicker(t, assetType);
          if (!massiveTicker) throw new Error(`normalize başarısız: ${t} (${assetType})`);
          // Rate limit: Massive çağrıları arasında bekleme
          if (massiveCallCount > 0) await sleep(MASSIVE_RATE_MS);
          data = await massiveHistorical(massiveTicker, massiveKey);
          massiveCallCount++;
        }

        if (data.error) throw new Error(data.error);

        const { error: upErr } = await supa.from("price_cache").upsert(
          { ticker: t, ...data, updated_at: new Date().toISOString() },
          { onConflict: "ticker" }
        );
        if (upErr) throw new Error("upsert: " + upErr.message);
        ok.push(t);
      } catch (e) {
        failed.push({ ticker: t, asset_type: assetType, error: e.message });
      }
    }

    return new Response(
      JSON.stringify({ total: allTickers.length, batch_size: batch.length, ok, failed, next_candidates: sorted.slice(limit, limit + 5) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
