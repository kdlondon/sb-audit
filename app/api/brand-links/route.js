// Identify each brand's official website + main social channels (IG, TikTok, YouTube).
// Batch: one AI call for the whole brand list (onboarding step). Links come from model
// knowledge — mark as unverified; the analyst can correct them in Settings → Landscape,
// and the Brand DNA crawl will surface a wrong website immediately (status=failed).
export const dynamic = "force-dynamic";

export async function POST(request) {
  const { brands = [], market = "", industry = "" } = await request.json();
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return Response.json({ error: "API key not configured" }, { status: 500 });
  const list = (Array.isArray(brands) ? brands : []).map((b) => (typeof b === "string" ? { name: b } : b)).filter((b) => b?.name);
  if (!list.length) return Response.json({ links: [] });

  const prompt = `For each of these ${industry || ""} brands${market ? ` (primary market: ${market})` : ""}, give their OFFICIAL digital presence.

BRANDS:
${list.map((b) => `- ${b.name}`).join("\n")}

Rules:
- website: the brand's main official website URL (https://…). Prefer the market-specific domain when the market is given.
- instagram / tiktok / youtube: the brand's main official account URL on that platform. Empty string if you are not confident it exists.
- NEVER invent plausible-looking handles — if unsure, use "".
- Return ONLY a raw JSON array, same order as the list, no markdown:
[{"name":"Brand","website":"https://…","instagram":"https://instagram.com/…","tiktok":"","youtube":"https://youtube.com/@…"}]`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 2000, messages: [{ role: "user", content: prompt }] }),
    });
    const data = await res.json();
    if (data.error) return Response.json({ error: data.error.message }, { status: 500 });
    const text = data.content?.map((c) => c.text || "").join("") || "";
    let parsed = [];
    try { parsed = JSON.parse(text); } catch { const m = text.match(/\[[\s\S]*\]/); if (m) { try { parsed = JSON.parse(m[0]); } catch {} } }
    const byName = {}; (Array.isArray(parsed) ? parsed : []).forEach((p) => { if (p?.name) byName[String(p.name).toLowerCase()] = p; });
    const links = list.map((b) => {
      const p = byName[String(b.name).toLowerCase()] || {};
      const clean = (u) => { const s = String(u || "").trim(); return /^https?:\/\//.test(s) || s === "" ? s : (s.startsWith("@") || s.includes(".") ? s : ""); };
      return { name: b.name, website: clean(p.website), instagram: clean(p.instagram), tiktok: clean(p.tiktok), youtube: clean(p.youtube) };
    });
    return Response.json({ links });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
