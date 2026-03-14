export async function POST(request) {
  const { imageUrl, context } = await request.json();
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return Response.json({ error: "API key not configured" }, { status: 500 });

  const prompt = `You are a senior brand strategist classifying a competitive communication piece for a business banking category audit.

${context ? `CONTEXT PROVIDED BY ANALYST:\n${context}\n` : ""}

Analyze this piece and return ONLY a raw JSON object (no markdown, no backticks) with these fields. For dropdown fields, you MUST pick EXACTLY one of the provided options — do not invent new values.

{
  "description": "Brief title/description of the piece (max 15 words)",
  "synopsis": "What is this piece communicating? Full description (3-5 sentences)",
  "main_slogan": "Main headline, tagline, or slogan (exact text if visible/audible)",
  "insight": "The human truth this piece activates (1 sentence)",
  "idea": "The creative concept (1 sentence)",
  "primary_territory": "The main emotional/strategic territory this piece occupies",
  "secondary_territory": "A secondary territory if applicable, or empty string",
  "category": "MUST be one of: Traditional Banking, Fintech, Other",
  "company_type": "MUST be one of: Bank, Fintech, Neobank, Credit Union, Non-financial, Other",
  "category_proximity": "MUST be one of: Banking, Financial Services, Insurance, Tech, Telco, Retail, Other",
  "type": "MUST be one of: Video, Print, Digital, Social, OOH, Website, Blog, Podcast, Event, Direct Mail, In-branch, Other",
  "tone_of_voice": "MUST be one of: Authoritative, Empathetic, Aspirational, Peer-level, Institutional, Playful, Urgent, Other",
  "execution_style": "MUST be one of: Testimonial, Documentary, Manifesto, Product demo, Humor, Slice of life, Animation, Data-driven, Other",
  "brand_archetype": "MUST be one of: Innocent, Explorer, Sage, Hero, Outlaw, Magician, Regular Guy, Lover, Jester, Caregiver, Creator, Ruler, Not identifiable, Other",
  "bank_role": "MUST be one of: Advisor, Partner, Enabler, Cheerleader, Invisible infrastructure, Community builder, Not clear, Other",
  "language_register": "MUST be one of: Owner language, Banking language, Mixed, Neither, Other",
  "pain_point_type": "MUST be one of: Names real problem, Aspiration territory, Product-focused only, Other",
  "pain_point": "Describe the specific pain point addressed (1 sentence, or empty if none)",
  "representation": "MUST be one of: Solo founder, Founder + team, Founder + family, Business only, Diverse mix, Corporate imagery, Other",
  "cta": "MUST be one of: Visit branch, Call advisor, Use digital tool, Apply for product, Learn more, Brand only, No CTA, Other",
  "channel": "MUST be one of: Branch, Digital (web), Digital (app), Social media, Mass media, OOH, Direct mail, Event, Content marketing, PR, Other",
  "portrait": "Based on the implied audience, MUST be one of: Dreamer, Builder, Sovereign, Architect, Multiple, None identifiable, Other. Dreamer=early stage/potential, Builder=identity fused with business/impact, Sovereign=lifestyle/freedom/enough, Architect=strategic/scale/exit",
  "entry_door": "Based on the motivation shown, MUST be one of: Freedom, Craft, Identity, Build to Exit, Multiple, None identifiable, Other",
  "journey_phase": "MUST be one of: Existential, Validation, Complexity, Consolidation, Cross-phase, Not specific, Other. Existential=survival, Validation=proving it works, Complexity=scaling beyond founder, Consolidation=sustainable shape",
  "client_lifecycle": "MUST be one of: Starter, Growth, Steady, Succession, Cross-lifecycle, Not specific, Other",
  "richness_definition": "MUST be one of: Potential, Impact, Life well-designed, Strategic capability, Financial (default), Not addressed, Other",
  "diff_claim": "MUST be one of: Explicit differentiation, Implicit positioning, Interchangeable, Other",
  "brand_attributes": "Key brand attributes communicated (comma separated, max 5)",
  "emotional_benefit": "Primary emotional benefit promised (1 phrase)",
  "rational_benefit": "Primary rational/functional benefit promised (1 phrase)",
  "main_vp": "Main value proposition in one sentence",
  "rating": "Quality/effectiveness rating, MUST be one of: 1, 2, 3, 4, 5",
  "transcript": "Extract any readable text, copy, or dialogue from the piece (as much as possible)",
  "analyst_comment": "Brief strategic observation — what makes this piece interesting or notable (2-3 sentences)"
}

CRITICAL: Return ONLY the JSON object. No preamble, no explanation, no markdown formatting.`;

  try {
    const messages = [{
      role: "user",
      content: []
    }];

    // Add image if provided
    if (imageUrl) {
      messages[0].content.push({
        type: "image",
        source: { type: "url", url: imageUrl },
      });
    }

    messages[0].content.push({
      type: "text",
      text: prompt
    });

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 3000,
        messages,
      }),
    });

    const data = await response.json();
    const text = data.content?.map(c => c.text || "").join("") || "";

    try {
      const parsed = JSON.parse(text);
      return Response.json({ success: true, analysis: parsed });
    } catch {
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
