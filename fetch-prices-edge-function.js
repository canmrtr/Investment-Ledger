const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  try {
    const { ticker, mode, date, from, to } = await req.json();
    const massiveKey = Deno.env.get("MASSIVE_KEY");

    if (!ticker) return new Response(JSON.stringify({ error: "ticker required" }), { status: 400, headers: corsHeaders });
    if (!massiveKey) return new Response(JSON.stringify({ ticker, result: { error: "MASSIVE_KEY secret eksik" }, date: "" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
    const yearAgo   = new Date(Date.now() - 366 * 86400000).toISOString().split("T")[0];

    // date parametresi belirtilmişse onu kullan, yoksa dün
    const priceDate = date || yesterday;
    let result = {};

    if (mode === "historical") {
      const fromDate = from || yearAgo;
      const toDate   = to   || yesterday;
      const url = `https://api.massive.com/v2/aggs/ticker/${ticker}/range/1/day/${fromDate}/${toDate}?adjusted=true&limit=400&apiKey=${massiveKey}`;
      const r = await fetch(url);
      if (r.ok) {
        const d = await r.json();
        if (d.results && d.results.length > 1) {
          const bars = d.results.sort((a, b) => a.t - b.t);
          const n = bars.length, last = bars[n - 1].c;
          const get = (i) => (i >= 0 && i < n ? bars[i].c : null);
          const chg = (old) => (old != null ? (last / old - 1) * 100 : null);
          const p_d1 = get(n-2), p_w1 = get(n-6), p_m1 = get(n-22);
          const p_m3 = get(n-66), p_m6 = get(n-132), p_y1 = get(0);
          result = { price: last, d1: chg(p_d1), w1: chg(p_w1), m1: chg(p_m1), y1: chg(p_y1), p_d1, p_w1, p_m1, p_m3, p_m6, p_y1 };
        }
      }
    } else {
      // Price mode — belirli bir tarihin kapanış fiyatı
      const url = `https://api.massive.com/v1/open-close/${ticker}/${priceDate}?apiKey=${massiveKey}`;
      const r = await fetch(url);
      if (r.ok) {
        const text = await r.text();
        const trimmed = text.trim();

        if (trimmed.startsWith("{")) {
          // JSON response
          try {
            const json = JSON.parse(trimmed);
            if (json.close != null) result = { price: parseFloat(json.close) };
            else if (json.c != null) result = { price: parseFloat(json.c) };
          } catch (e) {
            result = { error: "JSON parse hatası: " + e.message };
          }
        } else {
          // CSV response: from,symbol,open,high,low,close,...
          const lines = trimmed.split("\n");
          const row = lines[1];
          if (row && row.trim()) {
            const cols = row.trim().split(",");
            if (cols.length >= 6) result = { price: parseFloat(cols[5]) };
          }
        }
      } else {
        const errText = await r.text();
        result = { error: `HTTP ${r.status}`, raw: errText.slice(0, 100) };
      }
    }

    return new Response(JSON.stringify({ ticker, result, date: priceDate }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});
