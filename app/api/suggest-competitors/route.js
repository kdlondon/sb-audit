import { requireAuth } from "@/lib/api-auth";

export async function POST(request) {
  // const denied = await requireAuth(request); // TODO: fix auth with Supabase SSR
  // if (denied) return denied;

  const { brand_name, industry, market, global_markets, type, exclude, model, positioning } = await request.json();
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return Response.json({ error: "API key not configured" }, { status: 500 });

  const isGlobal = type === "global";
  const excludeClause = exclude ? `\nDO NOT suggest any of these brands (they are already tracked): ${exclude}` : "";
  const posClause = positioning ? `\nBrand context (match the same BUSINESS MODEL / sub-category, not just the broad industry): ${positioning}` : "";

  const prompt = isGlobal
    ? `Given brand: ${brand_name}, category: ${industry}${market ? `, home market: ${market}` : ""}${posClause}
Suggest exactly 5 GLOBAL REFERENCE brands to benchmark. STRICT RULES:
- Every brand MUST compete in the SAME category (${industry}) globally — same business model as ${brand_name} where possible. NO cross-industry picks, NO generic famous brands (never Apple/Ikea/Nike unless the category IS theirs).
- Each must be a recognized LEADER or best-in-class in that category in its market.
- Prioritize brands from the UK, US, EU and LATAM (in that spirit of coverage — aim for a mix across those regions).
- Exclude brands from the home market (${market || "n/a"}) — those are local competitors, not global references.${excludeClause}
Return ONLY a JSON array with exactly 5 items: [{"name": "Brand Name", "country": "XX", "industry": "Their category", "reason": "One-line: why it's a same-category global reference"}]`
    : `Given this brand: ${brand_name}, industry: ${industry}, market: ${market}${posClause}
Suggest exactly 5 direct competitors or adjacent competitors in the ${market} market.${excludeClause}
Return ONLY a JSON array with exactly 5 items: [{"name": "Brand Name", "type": "direct" or "adjacent", "reason": "One-line why this is a competitor"}]`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: model || "claude-sonnet-4-6",
        max_tokens: 1500,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const data = await response.json();
    if (data.error) {
      return Response.json({ error: data.error.message || "API error" }, { status: 500 });
    }

    const text = data.content?.map(c => c.text || "").join("") || "";

    try {
      const parsed = JSON.parse(text);
      return Response.json({ suggestions: parsed });
    } catch {
      const match = text.match(/\[[\s\S]*\]/);
      if (match) {
        return Response.json({ suggestions: JSON.parse(match[0]) });
      }
      return Response.json({ suggestions: [] });
    }
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
