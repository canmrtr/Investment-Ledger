import Anthropic from "npm:@anthropic-ai/sdk";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

// AI bazen ```json ... ``` ile sarıyor veya öncesine açıklama ekliyor.
// Bu yüzden önce markdown fence'i, sonra ilk { ... son } bloğunu çıkar.
const extractJson = (s) => {
  if (!s) return "";
  const fenced = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start >= 0 && end > start) return s.slice(start, end + 1);
  return s.trim();
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  let raw = "";
  try {
    const body = await req.json();
    // Frontend iki şekilde gönderebilir:
    //  - metin:    { text }
    //  - görüntü:  { imageBase64, imageType }
    const { text, imageBase64, imageType } = body;
    const isImage = !!imageBase64;

    if (!isImage && !text) {
      return new Response(
        JSON.stringify({ error: "text veya imageBase64 gerekli" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiKey = Deno.env.get("ANTHROPIC_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "ANTHROPIC_KEY secret eksik" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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
            source: {
              type: "base64",
              media_type: imageType || "image/png",
              data: imageBase64,
            },
          },
          { type: "text", text: "Bu broker ekran görüntüsünden işlem bilgilerini çıkar ve yalnızca JSON döndür." },
        ]
      : text;

    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 800,
      system: SYSTEM,
      messages: [{ role: "user", content: userContent }],
    });

    raw = message.content?.[0]?.text || "";
    const jsonStr = extractJson(raw);

    let result;
    try {
      result = JSON.parse(jsonStr);
    } catch (parseErr) {
      return new Response(
        JSON.stringify({
          error: "AI yanıtı geçerli JSON değil",
          detail: parseErr.message,
          raw: raw.slice(0, 500),
        }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Normalize: response her zaman { transactions: [...] } olsun.
    // Eski format (tek obje) gelirse array'e sar.
    if (!Array.isArray(result?.transactions)) {
      if (result && (result.ticker || result.date)) {
        result = { transactions: [result] };
      } else {
        return new Response(
          JSON.stringify({ error: "AI yanıtı geçerli işlem içermiyor", raw: raw.slice(0, 500) }),
          { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message, raw: raw.slice(0, 500) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
