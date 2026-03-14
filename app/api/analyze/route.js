export async function POST(request) {
  const { imageUrl, context } = await request.json();
  if (!imageUrl) return Response.json({ error: "No image URL" }, { status: 400 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return Response.json({ error: "API key not configured" }, { status: 500 });

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
        max_tokens: 2000,
        messages: [{
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "url", url: imageUrl },
            },
            {
              type: "text",
              text: `You are a brand strategist analyzing a competitive communication piece for a business banking audit. ${context ? `Context: ${context}` : ""}

Analyze this image and return a JSON object (no markdown, no backticks, just raw JSON) with these fields:

{
  "description": "Brief description of the piece (max 15 words)",
  "synopsis": "What is this piece communicating? (2-3 sentences)",
  "main_slogan": "Main headline, tagline, or slogan visible (exact text if readable)",
  "insight": "The human truth or insight this piece activates (1 sentence)",
  "idea": "The creative concept (1 sentence)",
  "tone_of_voice": "One of: Authoritative, Empathetic, Aspirational, Peer-level, Institutional, Playful, Urgent",
  "execution_style": "One of: Testimonial, Documentary, Manifesto, Product demo, Humor, Slice of life, Animation, Data-driven",
  "brand_archetype": "One of: Innocent, Explorer, Sage, Hero, Outlaw, Magician, Regular Guy, Lover, Jester, Caregiver, Creator, Ruler",
  "bank_role": "One of: Advisor, Partner, Enabler, Cheerleader, Invisible infrastructure, Community builder",
  "language_register": "One of: Owner language, Banking language, Mixed",
  "pain_point_type": "One of: Names real problem, Aspiration territory, Product-focused only",
  "representation": "One of: Solo founder, Founder + team, Founder + family, Business only, Diverse mix, Corporate imagery",
  "transcript": "Any readable text or copy from the image (extract as much as possible)",
  "analyst_comment": "Brief strategic observation about this piece (1-2 sentences)"
}`
            }
          ],
        }],
      }),
    });

    const data = await response.json();
    const text = data.content?.map(c => c.text || "").join("") || "";

    // Try to parse as JSON
    try {
      const parsed = JSON.parse(text);
      return Response.json({ success: true, analysis: parsed });
    } catch {
      // If not valid JSON, try to extract JSON from the response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          return Response.json({ success: true, analysis: parsed });
        } catch {
          return Response.json({ success: true, analysis: { analyst_comment: text } });
        }
      }
      return Response.json({ success: true, analysis: { analyst_comment: text } });
    }
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
