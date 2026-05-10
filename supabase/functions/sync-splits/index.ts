// Fetches stock split history from FMP for non-BIST tickers and upserts
// into the splits table (service_role, bypasses RLS).
// Called by the frontend after saving transactions and from Settings backfill.
//
// Body: { tickers: string[], portfolioId: string }
// Returns: { inserted: number, checked: number }

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://canmrtr.github.io",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Kimlik doğrulama gerekli" }, 401);

    const supaUrl = Deno.env.get("SUPABASE_URL");
    const supaAnon = Deno.env.get("SUPABASE_ANON_KEY");
    const supaService = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const fmpKey = Deno.env.get("FMP_KEY");

    if (!supaUrl || !supaAnon || !supaService || !fmpKey) {
      return json({ error: "Sunucu yapılandırma hatası" }, 500);
    }

    const supa = createClient(supaUrl, supaAnon, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: { user }, error: authErr } = await supa.auth.getUser(token);
    if (authErr || !user) return json({ error: "Geçersiz oturum" }, 401);

    const body = await req.json();
    const { tickers, portfolioId } = body;
    if (!Array.isArray(tickers) || !portfolioId) {
      return json({ error: "tickers ve portfolioId gerekli" }, 400);
    }

    // Deduplicate and cap at 50 to respect FMP free-tier limits
    const eligible = [...new Set(tickers.map((t) => t.toUpperCase()))].slice(0, 50);
    if (eligible.length === 0) return json({ inserted: 0, checked: 0 });

    const supaAdmin = createClient(supaUrl, supaService, { auth: { persistSession: false } });

    // Verify portfolioId belongs to this user before any service_role writes
    const { data: pfCheck } = await supaAdmin
      .from("portfolios")
      .select("id")
      .eq("id", portfolioId)
      .eq("user_id", user.id)
      .single();
    if (!pfCheck) return json({ error: "Portföy sahiplik doğrulaması başarısız" }, 403);

    // Load existing splits so we can skip already-known ones
    const { data: existingSplits } = await supaAdmin
      .from("splits")
      .select("ticker, split_date")
      .eq("user_id", user.id)
      .eq("portfolio_id", portfolioId)
      .in("ticker", eligible);

    const existingSet = new Set(
      (existingSplits || []).map((s) => `${s.ticker}|${s.split_date}`)
    );

    const toInsert = [];

    await Promise.all(
      eligible.map(async (ticker) => {
        try {
          const r = await fetch(
            `https://financialmodelingprep.com/stable/historical-stock-splits?symbol=${ticker}&apikey=${fmpKey}`,
            { signal: AbortSignal.timeout(8000) }
          );
          if (!r.ok) return;
          const d = await r.json();
          // Stable API returns array directly; v3 legacy returned { historical: [] }
          const splits = Array.isArray(d) ? d : (d?.historical || []);
          for (const s of splits) {
            if (!s.date || !s.numerator || !s.denominator) continue;
            const ratio = s.numerator / s.denominator;
            if (ratio <= 1) continue; // skip reverse splits
            const key = `${ticker}|${s.date}`;
            if (existingSet.has(key)) continue;
            toInsert.push({
              user_id: user.id,
              portfolio_id: portfolioId,
              ticker,
              split_date: s.date,
              ratio,
              note: `auto:FMP ${s.numerator}:${s.denominator}`,
            });
          }
        } catch (e) {
          console.warn(`[sync-splits] FMP failed for ${ticker}:`, e.message);
        }
      })
    );

    let inserted = 0;
    if (toInsert.length > 0) {
      const { error } = await supaAdmin
        .from("splits")
        .upsert(toInsert, { onConflict: "portfolio_id,ticker,split_date", ignoreDuplicates: true });
      if (error) {
        console.error("[sync-splits] upsert error:", error.message);
        return json({ error: "Upsert failed: " + error.message }, 500);
      }
      inserted = toInsert.length;
    }

    return json({ inserted, checked: eligible.length });
  } catch (e) {
    console.error("[sync-splits] unhandled error:", e);
    return json({ error: String(e) }, 500);
  }
});
