// Framework loader — loads project framework from DB, builds prompt context
// This replaces the hardcoded lib/framework.js for multi-client support.
// Falls back to static FRAMEWORK_CONTEXT for backward compatibility.

import { FRAMEWORK_CONTEXT } from "@/lib/framework";

/**
 * Server-side: Create a Supabase client for API routes.
 * Uses the service role or anon key depending on context.
 */
function createServerClient() {
  const { createClient } = require("@supabase/supabase-js");
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

/**
 * Load framework configuration for a project.
 * @param {string} projectId - The project ID
 * @param {object} [supabaseClient] - Optional Supabase client (for client-side use)
 * @returns {object|null} Framework object or null
 */
export async function loadFramework(projectId, supabaseClient) {
  if (!projectId) return null;

  const supabase = supabaseClient || createServerClient();
  const { data, error } = await supabase
    .from("project_frameworks")
    .select("*")
    .eq("project_id", projectId)
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    projectId: data.project_id,
    name: data.name,
    tier: data.tier || "essential",

    // Brand profile
    brandName: data.brand_name,
    brandDescription: data.brand_description,
    brandPositioning: data.brand_positioning,
    brandDifferentiator: data.brand_differentiator,
    brandAudience: data.brand_audience,
    brandTone: data.brand_tone,
    industry: data.industry,
    subCategory: data.sub_category,
    primaryMarket: data.primary_market,
    globalMarkets: data.global_markets || [],
    language: data.language || "English",
    secondaryLanguage: data.secondary_language,
    objectives: data.objectives || [],
    specificQuestions: data.specific_questions,
    reportingFrequency: data.reporting_frequency,
    logoUrl: data.logo_url,
    yearsInMarket: data.years_in_market,

    // Framework data
    dimensions: data.dimensions || [],
    frameworkText: data.framework_text || "",
    brandCategories: data.brand_categories || ["Other"],
    communicationIntents: data.communication_intents || ["Brand Hero", "Brand Tactical", "Client Testimonials", "Product", "Innovation"],
    standardDimensions: data.standard_dimensions || ["archetype", "tone", "execution", "funnel", "rating"],

    // Competitors/benchmarks
    localCompetitors: data.local_competitors || [],
    globalBenchmarks: data.global_benchmarks || [],
  };
}

/**
 * Build prompt context string for AI injection.
 * Tier 1: Generic brand context from profile
 * Tier 2: Brand context + custom dimensions with values & descriptions
 * Tier 3: Brand context + full framework_text (e.g., Scotiabank FRAMEWORK_CONTEXT)
 */
export function buildPromptContext(framework) {
  if (!framework) return FRAMEWORK_CONTEXT; // Fallback to static

  const { tier, brandName, brandDescription, brandPositioning, brandDifferentiator,
    brandAudience, brandTone, industry, primaryMarket, language, objectives,
    dimensions, frameworkText, communicationIntents } = framework;

  // Brand profile section (all tiers)
  const brandProfile = `
=== BRAND PROFILE ===
Brand: ${brandName || "Unknown"}
Industry: ${industry || "Not specified"}
Market: ${primaryMarket || "Not specified"}
Description: ${brandDescription || "Not provided"}
Positioning: ${brandPositioning || "Not provided"}
Key Differentiator: ${brandDifferentiator || "Not provided"}
Target Audience: ${brandAudience || "Not provided"}
Brand Tone: ${brandTone || "Not provided"}
Language: ${language || "English"}
${objectives?.length ? `Objectives: ${objectives.join(", ")}` : ""}
`.trim();

  // Communication intents
  const intentsSection = communicationIntents?.length
    ? `\n\n=== COMMUNICATION INTENTS ===\nActive intents: ${communicationIntents.join(", ")}`
    : "";

  // Tier-specific content
  if (tier === "specialist" && frameworkText) {
    // Tier 3: Full proprietary framework
    return `${brandProfile}${intentsSection}\n\n${frameworkText}`;
  }

  if (tier === "enhanced" && dimensions?.length > 0) {
    // Tier 2: Brand context + custom dimensions
    const dimSections = dimensions.map(d => {
      const values = d.values?.join(", ") || "Not defined";
      const rules = d.classification_rules ? `\nClassification rules: ${d.classification_rules}` : "";
      return `${d.name}: ${values}${d.description ? `\nDescription: ${d.description}` : ""}${rules}`;
    }).join("\n\n");

    return `${brandProfile}${intentsSection}\n\n=== CUSTOM ANALYSIS DIMENSIONS ===\n\n${dimSections}`;
  }

  // Tier 1: Generic brand context only
  return `${brandProfile}${intentsSection}\n\nYou are analyzing competitive communications for ${brandName || "this brand"} in the ${industry || "given"} industry. Use standard marketing analysis dimensions. Focus on communication intent, brand archetype, tone of voice, execution style, funnel stage, and overall quality rating.`;
}

/**
 * Build a dynamic classification prompt for the analyze endpoint.
 * Only includes fields that the framework defines.
 */
export function buildClassificationFields(framework) {
  if (!framework) return null; // Use legacy prompt

  const fields = {
    // Always included (all tiers)
    description: '"Brief title/description (max 15 words)"',
    synopsis: '"What is this piece communicating? (3-5 sentences)"',
    main_slogan: '"Main headline, tagline, or slogan (exact text if visible/audible)"',
    insight: '"The human truth this piece activates (1 sentence)"',
    idea: '"The creative concept (1 sentence)"',
    primary_territory: '"The main emotional/strategic territory"',
    secondary_territory: '"Secondary territory if applicable, or empty string"',
    type: '"MUST be: Video | Print | Digital | Social | OOH | Website | Blog | Podcast | Event | Direct Mail | In-branch | Other"',
    rating: '"MUST be: 1 | 2 | 3 | 4 | 5"',
    transcript: '"Extract any readable text/copy/dialogue from the piece"',
    analyst_comment: '"Strategic observation — what makes this piece interesting (2-3 sentences)"',
  };

  // Communication intents (dynamic values)
  const intents = framework.communicationIntents || ["Brand Hero", "Brand Tactical", "Client Testimonials", "Product", "Innovation"];
  fields.communication_intent = `"MUST be one or more of: ${intents.join(" | ")} — comma separated if multiple"`;

  // Standard dimensions (togglable)
  const stdDims = framework.standardDimensions || [];
  if (stdDims.includes("tone")) {
    fields.tone_of_voice = '"MUST be: Authoritative | Empathetic | Aspirational | Peer-level | Institutional | Playful | Urgent | Other"';
  }
  if (stdDims.includes("execution")) {
    fields.execution_style = '"MUST be: Testimonial | Documentary | Manifesto | Product demo | Humor | Slice of life | Animation | Data-driven | Other"';
  }
  if (stdDims.includes("archetype")) {
    fields.brand_archetype = '"MUST be: Innocent | Explorer | Sage | Hero | Outlaw | Magician | Regular Guy | Lover | Jester | Caregiver | Creator | Ruler | Not identifiable | Other"';
  }
  if (stdDims.includes("funnel")) {
    fields.funnel = '"MUST be one or more of: Awareness | Consideration | Conversion | Retention | Advocacy — comma separated if multiple"';
  }

  // Always include these brand/communication fields
  fields.brand_attributes = '"Key brand attributes (comma separated, max 5)"';
  fields.emotional_benefit = '"Primary emotional benefit (1 phrase)"';
  fields.rational_benefit = '"Primary rational benefit (1 phrase)"';
  fields.main_vp = '"Main value proposition (1 sentence)"';
  fields.pain_point = '"Specific pain point addressed (1 sentence, or empty)"';
  fields.diff_claim = '"MUST be: Explicit differentiation | Implicit positioning | Interchangeable | Other"';
  fields.cta = '"MUST be: Visit branch | Call advisor | Use digital tool | Apply for product | Learn more | Brand only | No CTA | Other"';
  fields.channel = '"MUST be: Branch | Digital (web) | Digital (app) | Social media | Mass media | OOH | Direct mail | Event | Content marketing | PR | Other"';

  // Custom dimensions from framework (Tier 2+)
  if (framework.dimensions?.length > 0) {
    for (const dim of framework.dimensions) {
      if (dim.key && dim.values?.length > 0) {
        fields[dim.key] = `"MUST be: ${dim.values.join(" | ")} | Other"`;
      }
    }
  }

  // Tier 3 specialist dimensions (only if framework defines them)
  const hasDimension = (key) => framework.dimensions?.some(d => d.key === key);
  if (hasDimension("portrait")) {
    const portraitDim = framework.dimensions.find(d => d.key === "portrait");
    fields.portrait = `"MUST be: ${portraitDim.values.join(" | ")} | Multiple | None identifiable | Other"`;
  }
  if (hasDimension("entry_door")) {
    const doorDim = framework.dimensions.find(d => d.key === "entry_door");
    fields.entry_door = `"MUST be: ${doorDim.values.join(" | ")} | Multiple | None identifiable | Other"`;
  }
  if (hasDimension("journey_phase")) {
    const phaseDim = framework.dimensions.find(d => d.key === "journey_phase");
    fields.journey_phase = `"MUST be: ${phaseDim.values.join(" | ")} | Cross-phase | Not specific | Other"`;
  }
  if (hasDimension("client_lifecycle")) {
    const lcDim = framework.dimensions.find(d => d.key === "client_lifecycle");
    fields.client_lifecycle = `"MUST be: ${lcDim.values.join(" | ")} | Cross-lifecycle | Not specific | Other"`;
  }
  if (hasDimension("richness_definition")) {
    const richDim = framework.dimensions.find(d => d.key === "richness_definition");
    fields.richness_definition = `"MUST be: ${richDim.values.join(" | ")} | Not addressed | Other"`;
  }
  if (hasDimension("experience_reflected")) {
    const expDim = framework.dimensions.find(d => d.key === "experience_reflected");
    fields.experience_reflected = `"MUST be: ${expDim.values.join(" | ")} | Not specific | Other"`;
  }
  // Moment dimensions
  for (const momentKey of ["moment_acquisition", "moment_deepening", "moment_unexpected"]) {
    if (hasDimension(momentKey)) {
      const mDim = framework.dimensions.find(d => d.key === momentKey);
      fields[momentKey] = `"MUST be: ${mDim.values.join(" | ")} | None | Other"`;
    }
  }
  // Additional specialist fields
  if (hasDimension("bank_role") || framework.tier === "specialist") {
    if (hasDimension("bank_role")) {
      const brDim = framework.dimensions.find(d => d.key === "bank_role");
      fields.bank_role = `"MUST be: ${brDim.values.join(" | ")} | Other"`;
    }
  }

  return fields;
}

/**
 * Returns which audit form sections/fields should be visible for a framework.
 * Used by the audit page to conditionally render form sections.
 */
export function getActiveFields(framework) {
  if (!framework) {
    // No framework = show everything (backward compat)
    return { showAllSections: true, hiddenSections: [], hiddenFields: [] };
  }

  const hasDimension = (key) => framework.dimensions?.some(d => d.key === key);
  const stdDims = framework.standardDimensions || [];
  const hiddenSections = [];
  const hiddenFields = [];

  // Section C (Entrepreneur Identity) — only for frameworks with portrait/entry_door dimensions
  if (!hasDimension("portrait") && !hasDimension("entry_door") &&
      !hasDimension("richness_definition") && !hasDimension("experience_reflected")) {
    hiddenSections.push("C. Entrepreneur Identity");
  }

  // Section D (Business Journey) — only for frameworks with journey/lifecycle dimensions
  if (!hasDimension("journey_phase") && !hasDimension("client_lifecycle") &&
      !hasDimension("moment_acquisition") && !hasDimension("moment_deepening") &&
      !hasDimension("moment_unexpected")) {
    hiddenSections.push("D. Business Journey");
  }

  // Standard dimension toggles
  if (!stdDims.includes("archetype")) hiddenFields.push("brand_archetype");
  if (!stdDims.includes("tone")) hiddenFields.push("tone_of_voice");
  if (!stdDims.includes("execution")) hiddenFields.push("execution_style");
  if (!stdDims.includes("funnel")) hiddenFields.push("funnel");
  if (!stdDims.includes("rating")) hiddenFields.push("rating");

  // Section E fields — hide bank-specific fields for non-banking
  if (!hasDimension("bank_role") && framework.industry !== "Banking & Financial Services") {
    hiddenFields.push("bank_role");
    hiddenFields.push("language_register");
  }

  return {
    showAllSections: false,
    hiddenSections,
    hiddenFields,
    // Custom dimensions that should be added to the form
    customDimensions: framework.dimensions?.filter(d =>
      !["portrait", "entry_door", "journey_phase", "client_lifecycle",
        "richness_definition", "experience_reflected", "moment_acquisition",
        "moment_deepening", "moment_unexpected", "bank_role"].includes(d.key)
    ) || [],
  };
}

/**
 * Get the language instruction for AI prompts.
 */
export function getLanguageInstruction(framework) {
  if (!framework?.language || framework.language === "English") return "";
  return `\n\nIMPORTANT: Respond in ${framework.language}.`;
}
