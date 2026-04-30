import Anthropic from "npm:@anthropic-ai/sdk";
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

// AI bazen ```json ... ``` ile sarıyor veya öncesine açıklama ekliyor.
const extractJson = (s) => {
  if (!s) return "";
  const fenced = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start >= 0 && end > start) return s.slice(start, end + 1);
  return s.trim();
};

const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];
const MAX_IMAGE_B64_LEN = 5_000_000; // ~3.75 MB decoded

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  let raw = "";
  try {
    // ── JWT doğrulama ──────────────────────────────────────────────────────────
    // --no-verify-jwt ile deploy edilmiş olsa da rate limit için kimlik zorunlu.
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Kimlik doğrulama gerekli" }, 401);

    const supaUrl = Deno.env.get("SUPABASE_URL");
    const supaAnon = Deno.env.get("SUPABASE_ANON_KEY");
    const supaService = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supa = createClient(supaUrl, supaAnon, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: { user }, error: authErr } = await supa.auth.getUser(token);
    if (authErr || !user) return json({ error: "Geçersiz oturum" }, 401);

    // ── Rate limit: increment_parse_calls RPC (SECURITY DEFINER, service_role) ─
    const supaAdmin = createClient(supaUrl, supaService);
    const { data: rateData, error: rateErr } = await supaAdmin.rpc(
      "increment_parse_calls",
      { p_user_id: user.id }
    );
    if (rateErr) {
      console.error("[parse-tx] rate-limit RPC error:", rateErr.message);
      return json({ error: "Sunucu hatası" }, 500);
    }
    if (rateData === false) {
      return json({ error: "Günlük AI parse limitine ulaşıldı (20/gün)" }, 429);
    }

    // ── Input parse ────────────────────────────────────────────────────────────
    const body = await req.json();
    const { text, imageBase64, imageType } = body;
    const isImage = !!imageBase64;

    if (!isImage && !text) {
      return json({ error: "text veya imageBase64 gerekli" }, 400);
    }

    if (isImage) {
      if (!ALLOWED_IMAGE_TYPES.includes(imageType)) {
        return json({ error: "Desteklenmeyen görsel tipi (PNG/JPEG/GIF/WEBP)" }, 400);
      }
      if (imageBase64.length > MAX_IMAGE_B64_LEN) {
        return json({ error: "Görsel çok büyük (max ~3.75 MB)" }, 413);
      }
    }

    // ── Claude çağrısı ─────────────────────────────────────────────────────────
    const apiKey = Deno.env.get("ANTHROPIC_KEY");
    if (!apiKey) return json({ error: "Yapılandırma hatası" }, 500);

    const client = new Anthropic({ apiKey });
    const today = new Date().toISOString().split("T")[0];

    const SYSTEM = `Yatırım işlemi parser. SADECE JSON döndür, başka hiçbir şey yazma — açıklama, markdown code fence, selamlama YOK.

Format — her zaman \`transactions\` array'i (tek işlem olsa bile array içinde):
{"transactions":[{"date":"YYYY-MM-DD","ticker":"","name":"","asset_type":"US_STOCK|FUND|CRYPTO|BIST|GOLD|FX","way":"BUY|SELL","shares":0,"price":0,"currency":"USD|TRY|EUR","broker":"","commission":0,"exchange":"","notes":""}]}

Girdide birden fazla işlem varsa hepsini ayrı obje olarak array'e ekle. Bugün: ${today}. Tarih belirtilmemişse bugünü kullan. Komisyon yoksa 0. Ticker büyük harf. Para birimi belirtilmemişse USD.`;

    const userContent = isImage
      ? [
          {
            type: "image",
            source: { type: "base64", media_type: imageType, data: imageBase64 },
          },
          { type: "text", text: "Bu broker ekran görüntüsünden işlem bilgilerini çıkar ve yalnızca JSON döndür." },
        ]
      : text;

    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1200,
      system: SYSTEM,
      messages: [{ role: "user", content: userContent }],
    });

    raw = message.content?.[0]?.text || "";
    const jsonStr = extractJson(raw);

    let result;
    try {
      result = JSON.parse(jsonStr);
    } catch (parseErr) {
      return json({ error: "AI yanıtı geçerli JSON değil", raw: raw.slice(0, 500) }, 422);
    }

    // Normalize: response her zaman { transactions: [...] } olsun.
    if (!Array.isArray(result?.transactions)) {
      if (result && (result.ticker || result.date)) {
        result = { transactions: [result] };
      } else {
        return json({ error: "AI yanıtı geçerli işlem içermiyor", raw: raw.slice(0, 500) }, 422);
      }
    }

    return json(result);
  } catch (err) {
    console.error("[parse-tx] unhandled error:", err);
    return json({ error: "İşlem parse hatası", raw: raw.slice(0, 500) }, 500);
  }
});
