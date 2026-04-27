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
};

const RATE_LIMIT_MS = 7500;
const DEFAULT_BATCH = 5;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Massive.com historical fetch — fetch-prices edge function ile aynı mantık.
const fetchHistorical = async (ticker, massiveKey) => {
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
  const yearAgo = new Date(Date.now() - 366 * 86400000).toISOString().split("T")[0];
  const url = `https://api.massive.com/v2/aggs/ticker/${ticker}/range/1/day/${yearAgo}/${yesterday}?adjusted=true&limit=400&apiKey=${massiveKey}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const d = await r.json();
  if (!d.results || d.results.length < 2) throw new Error("insufficient data");
  const bars = d.results.sort((a, b) => a.t - b.t);
  const n = bars.length, last = bars[n - 1].c;
  const get = (i) => (i >= 0 && i < n ? bars[i].c : null);
  const chg = (old) => (old != null ? (last / old - 1) * 100 : null);
  const p_d1 = get(n - 2), p_w1 = get(n - 6), p_m1 = get(n - 22);
  const p_m3 = get(n - 66), p_m6 = get(n - 132), p_y1 = get(0);
  return {
    price: last,
    d1: chg(p_d1), w1: chg(p_w1), m1: chg(p_m1), y1: chg(p_y1),
    p_d1, p_w1, p_m1, p_m3, p_m6, p_y1,
  };
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
      if (typeof body.limit === "number" && body.limit > 0) limit = Math.min(body.limit, 10);
    } catch (_) { /* body yok / invalid — default */ }

    const supa = createClient(supaUrl, serviceKey, { auth: { persistSession: false } });

    // 1) Tüm user'ların USD pozisyonlarından unique ticker listesi (RLS bypass)
    const { data: posList, error: posErr } = await supa
      .from("positions")
      .select("ticker")
      .eq("currency", "USD");
    if (posErr) throw new Error("positions read failed: " + posErr.message);
    const allTickers = [...new Set((posList || []).map((p) => p.ticker))];

    if (allTickers.length === 0) {
      return new Response(
        JSON.stringify({ message: "no USD tickers in positions", total: 0, processed: 0 }),
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
        const data = await fetchHistorical(t, massiveKey);
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
