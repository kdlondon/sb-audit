import { FRAMEWORK_CONTEXT } from "@/lib/framework";
import { loadFramework, loadBrandFramework, buildPromptContext, buildClassificationFields, getLanguageInstruction } from "@/lib/framework-loader";
import { requireAuth } from "@/lib/api-auth";

// Build the legacy (Scotiabank-hardcoded) classification prompt
function buildLegacyPrompt(context) {
  return `${FRAMEWORK_CONTEXT}

You are classifying a competitive communication piece for the Scotiabank Business Banking category audit.

LANGUAGE RULE — CRITICAL: The material you are analyzing may be in any language (Spanish, French, English, etc.). Regardless of the language of the source material, ALL your output fields must be written in English. Translate any copy, slogans, insights, synopses, and pain points into English. Never output text in Spanish, French, or any other language.

${context ? `CONTEXT PROVIDED BY ANALYST:\n${context}\n` : ""}

Analyze this piece and return ONLY a raw JSON object (no markdown, no backticks) with these fields. For dropdown fields, pick EXACTLY one of the provided options.

{
  "description": "Brief title/description (max 15 words)",
  "synopsis": "What is this piece communicating? (3-5 sentences)",
  "main_slogan": "Main headline, tagline, or slogan (exact text if visible/audible)",
  "insight": "The human truth this piece activates (1 sentence)",
  "idea": "The creative concept (1 sentence)",
  "primary_territory": "The main emotional/strategic territory",
  "secondary_territory": "Secondary territory if applicable, or empty string",
  "category": "MUST be: Traditional Banking | Fintech | Other",
  "company_type": "MUST be: Bank | Fintech | Neobank | Credit Union | Non-financial | Other",
  "category_proximity": "MUST be: Banking | Financial Services | Insurance | Tech | Telco | Retail | Other",
  "type": "MUST be: Video | Print | Digital | Social | OOH | Website | Blog | Podcast | Event | Direct Mail | In-branch | Other",
  "communication_intent": "MUST be one or more of: Brand Hero | Brand Tactical | Client Testimonials | Product | Innovation | Beyond Banking — comma separated if multiple. Brand Hero = core brand positioning pieces that define the bank's overall identity, voice, and market stance — manifestos, brand commercials, major campaign films, tagline-driven ads. These are the pieces you'd analyze to understand what the brand STANDS FOR. Brand Tactical = brand-building pieces that support brand values but are not core positioning — events, sponsorships, community initiatives, cause marketing, employer branding, CSR campaigns. They build perception but don't define the central proposition. Client Testimonials = real customer stories, case studies, or testimonials where clients share their experience with the brand in their own voice. These reveal what customers value and how they perceive the brand relationship. Product = drives a specific product/service/offer, has CTA to buy/apply. Innovation = showcases new capability, platform, social initiative, or technology. Beyond Banking = educational content, how-to guides, business tools, community building, mentorship, financial literacy — value beyond core banking that positions the brand as a life/business partner.",
  "funnel": "MUST be one or more of: Awareness | Consideration | Conversion | Retention | Advocacy — comma separated if multiple",
  "tone_of_voice": "MUST be: Authoritative | Empathetic | Aspirational | Peer-level | Institutional | Playful | Urgent | Other",
  "execution_style": "MUST be: Testimonial | Documentary | Manifesto | Product demo | Humor | Slice of life | Animation | Data-driven | Other",
  "brand_archetype": "MUST be: Innocent | Explorer | Sage | Hero | Outlaw | Magician | Regular Guy | Lover | Jester | Caregiver | Creator | Ruler | Not identifiable | Other",
  "bank_role": "MUST be: Advisor | Partner | Enabler | Cheerleader | Invisible infrastructure | Community builder | Not clear | Other",
  "language_register": "MUST be: Owner language | Banking language | Mixed | Neither | Other",
  "pain_point_type": "MUST be: Names real problem | Aspiration territory | Product-focused only | Other",
  "pain_point": "Specific pain point addressed (1 sentence, or empty)",
  "representation": "MUST be: Solo founder | Founder + team | Founder + family | Business only | Diverse mix | Corporate imagery | Other",
  "cta": "MUST be: Visit branch | Call advisor | Use digital tool | Apply for product | Learn more | Brand only | No CTA | Other",
  "channel": "MUST be: Branch | Digital (web) | Digital (app) | Social media | Mass media | OOH | Direct mail | Event | Content marketing | PR | Other",
  "portrait": "MUST be: Dreamer | Builder | Sovereign | Architect | Multiple | None identifiable | Other — USE THE FRAMEWORK DEFINITIONS ABOVE. Base on IMPLIED audience, not product.",
  "entry_door": "MUST be: Freedom | Craft | Identity | Build to Exit | Multiple | None identifiable | Other — USE THE FRAMEWORK DEFINITIONS ABOVE.",
  "journey_phase": "MUST be: Existential | Validation | Complexity | Consolidation | Cross-phase | Not specific | Other — USE THE FRAMEWORK DEFINITIONS ABOVE.",
  "client_lifecycle": "MUST be: Starter | Growth | Steady | Succession | Cross-lifecycle | Not specific | Other",
  "experience_reflected": "MUST be: Existential struggle | Validation seeking | Complexity navigation | Consolidation choice | General entrepreneurship | Not specific | Other",
  "richness_definition": "MUST be: Potential | Impact | Life well-designed | Strategic capability | Financial (default) | Not addressed | Other — MUST MATCH PORTRAIT: Dreamer=Potential, Builder=Impact, Sovereign=Life well-designed, Architect=Strategic capability",
  "moment_acquisition": "MUST be: Personal-to-business transition | First account setup | Digital tools config | First cash flow crisis | First LOC or credit | None | Other — Only if piece specifically addresses this moment",
  "moment_deepening": "MUST be: RM assignment/turnover | Major financing | Crisis navigation | Succession planning | Fintech adoption | None | Other",
  "moment_unexpected": "MUST be: Revenue milestone | Business anniversary | Employee milestone | Peer connection | Personal life transition | None | Other",
  "diff_claim": "MUST be: Explicit differentiation | Implicit positioning | Interchangeable | Other",
  "brand_attributes": "Key brand attributes (comma separated, max 5)",
  "emotional_benefit": "Primary emotional benefit (1 phrase)",
  "rational_benefit": "Primary rational benefit (1 phrase)",
  "main_vp": "Main value proposition (1 sentence)",
  "rating": "MUST be: 1 | 2 | 3 | 4 | 5",
  "transcript": "Extract any readable text/copy/dialogue from the piece",
  "analyst_comment": "Strategic observation — what makes this piece interesting (2-3 sentences)"
}

CRITICAL: Return ONLY the JSON object. Use the FRAMEWORK DEFINITIONS for portrait, entry door, journey phase, and richness — do not guess generically.`;
}

// Build a dynamic classification prompt from framework
function buildDynamicPrompt(framework, context) {
  const frameworkContext = buildPromptContext(framework);
  const fields = buildClassificationFields(framework);
  const langInstruction = getLanguageInstruction(framework);

  const brandName = framework.brandName || "this brand";
  const industry = framework.industry || "the given industry";

  // Build JSON schema from fields
  const fieldEntries = Object.entries(fields).map(([key, desc]) => `  "${key}": ${desc}`).join(",\n");

  return `${frameworkContext}

You are classifying a competitive communication piece for the ${brandName} competitive audit in the ${industry} category.

LANGUAGE RULE — CRITICAL: The material you are analyzing may be in any language. Regardless of the source material language, ALL your output fields must be written in English. Translate any copy, slogans, insights, synopses, and pain points into English.${langInstruction}

${context ? `CONTEXT PROVIDED BY ANALYST:\n${context}\n` : ""}

Analyze this piece and return ONLY a raw JSON object (no markdown, no backticks) with these fields. For dropdown fields, pick EXACTLY one of the provided options.

{
${fieldEntries}
}

CRITICAL: Return ONLY the JSON object.${framework.frameworkText ? " Use the FRAMEWORK DEFINITIONS above for any framework-specific dimensions — do not guess generically." : ""}`;
}

export async function POST(request) {
  // const denied = await requireAuth(request); // TODO: fix auth with Supabase SSR
  // if (denied) return denied;

  const { imageUrl, imageBase64, extraImageUrls = [], extraImageBase64 = [], context, documentBase64, documentMediaType, project_id, brand_id } = await request.json();
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return Response.json({ error: "API key not configured" }, { status: 500 });

  // Load framework and build prompt
  console.log("[Analyze] Received brand_id:", brand_id, "project_id:", project_id);
  let prompt;
  if (brand_id || project_id) {
    try {
      console.log("[Analyze] Loading framework for brand_id:", brand_id);
      const framework = brand_id
        ? await loadBrandFramework(brand_id)
        : await loadFramework(project_id);
      console.log("[Analyze] Framework loaded:", !!framework, "tier:", framework?.tier);
      if (framework) {
        const debugFields = buildClassificationFields(framework);
        console.log("[Analyze] Classification fields count:", Object.keys(debugFields || {}).length);
        console.log("[Analyze] Has custom dims:", (framework.dimensions || framework.customDimensions || []).length);
        prompt = buildDynamicPrompt(framework, context);
        console.log("[Analyze] Dynamic prompt built, length:", prompt.length);
      } else {
        console.log("[Analyze] No framework found — will use legacy prompt");
      }
    } catch (err) {
      console.error("[Analyze] FRAMEWORK ERROR:", err.message, err.stack?.split("\n")[1]);
    }
  }
  // Fallback to legacy prompt
  if (!prompt) {
    prompt = buildLegacyPrompt(context);
  }

  try {
    const messageContent = [];

    if (documentBase64) {
      messageContent.push({
        type: "document",
        source: { type: "base64", media_type: documentMediaType || "application/pdf", data: documentBase64 }
      });
    }

    if (imageBase64) {
      messageContent.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: imageBase64 } });
    } else if (imageUrl) {
      messageContent.push({ type: "image", source: { type: "url", url: imageUrl } });
    }

    if (extraImageBase64 && extraImageBase64.length > 0) {
      for (const b64 of extraImageBase64.slice(0, 3)) {
        if (b64) messageContent.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: b64 } });
      }
    } else {
      for (const url of (extraImageUrls || []).slice(0, 3)) {
        if (url) messageContent.push({ type: "image", source: { type: "url", url } });
      }
    }

    messageContent.push({ type: "text", text: prompt });

    const messages = [{ role: "user", content: messageContent }];

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        ...(documentBase64 ? { "anthropic-beta": "pdfs-2024-09-25" } : {}),
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 3000,
        messages
      }),
    });

    const data = await response.json();

    if (data.error) {
      return Response.json({ error: data.error.message || "API error" }, { status: 500 });
    }

    const text = data.content?.map(c => c.text || "").join("") || "";

    // DEBUG: log AI response
    try {
      const parsed = JSON.parse(text);
      console.log("[Analyze] AI response keys:", Object.keys(parsed));
      console.log("[Analyze] AI portrait value:", parsed.portrait);
      console.log("[Analyze] AI journey_phase value:", parsed.journey_phase);
      console.log("[Analyze] AI category value:", parsed.category);
      console.log("[Analyze] AI sub_category value:", parsed.sub_category);
      return Response.json({ success: true, analysis: parsed });
    } catch {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try { return Response.json({ success: true, analysis: JSON.parse(jsonMatch[0]) }); } catch {}
      }
      return Response.json({ success: true, analysis: { analyst_comment: text } });
    }
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
