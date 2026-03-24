export async function POST(request) {
  const { brand_name, industry, market, global_markets, type } = await request.json();
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return Response.json({ error: "API key not configured" }, { status: 500 });

  const isGlobal = type === "global";

  const prompt = isGlobal
    ? `Given brand: ${brand_name}, industry: ${industry}, global markets: ${(global_markets || []).join(", ") || "worldwide"}
Suggest 10 international brands worth benchmarking — mix of same-industry leaders and cross-industry innovators known for exceptional marketing.
Return ONLY a JSON array: [{"name": "Brand Name", "country": "XX", "industry": "Their industry", "reason": "One-line why benchmark this brand"}]`
    : `Given this brand: ${brand_name}, industry: ${industry}, market: ${market}
Suggest 10 direct competitors and 3 adjacent/emerging competitors in the ${market} market.
Return ONLY a JSON array: [{"name": "Brand Name", "type": "direct" or "adjacent", "reason": "One-line why this is a competitor"}]`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
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
