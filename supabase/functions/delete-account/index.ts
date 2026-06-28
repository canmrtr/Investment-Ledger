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

// Hesap silme: auth.users satırını kaldırır → FK ON DELETE CASCADE ile tüm
// kullanıcı-scope veri (positions, transactions, watchlist, portfolios,
// feedback, follows, portfolio_activities, profiles, splits) temizlenir.
// auth.users silme yalnızca service_role admin API ile yapılabilir; bu yüzden
// edge function şart. IDOR koruması: yalnızca token sahibinin uid'si silinir —
// gövdeden user_id ASLA kabul edilmez.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Yöntem desteklenmiyor" }, 405);
  }

  try {
    // ── JWT doğrulama (--no-verify-jwt ile deploy; kimlik içeride zorunlu) ──
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Kimlik doğrulama gerekli" }, 401);

    const supaUrl = Deno.env.get("SUPABASE_URL");
    const supaAnon = Deno.env.get("SUPABASE_ANON_KEY");
    const supaService = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supaUrl || !supaAnon || !supaService) {
      console.error("[delete-account] missing env: SUPABASE_URL/SERVICE_ROLE_KEY");
      return json({ error: "Sunucu hatası" }, 500);
    }

    const supa = createClient(supaUrl, supaAnon, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: { user }, error: authErr } = await supa.auth.getUser(token);
    if (authErr || !user) return json({ error: "Geçersiz oturum" }, 401);

    // ── Admin silme: yalnızca token'daki uid (IDOR yok) ──
    const supaAdmin = createClient(supaUrl, supaService);
    const { error: delErr } = await supaAdmin.auth.admin.deleteUser(user.id);
    if (delErr) {
      console.error("[delete-account] admin.deleteUser error:", delErr.message);
      return json({ error: "Hesap silinemedi" }, 500);
    }

    console.log("[delete-account] deleted user:", user.id);
    return json({ ok: true });
  } catch (e) {
    console.error("[delete-account] unexpected:", e?.message || e);
    return json({ error: "Sunucu hatası" }, 500);
  }
});
