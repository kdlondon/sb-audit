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
 * Load framework configuration for a brand.
 * @param {string} brandId - The brand ID
 * @param {object} [supabaseClient] - Optional Supabase client (for client-side use)
 * @returns {object|null} Framework object or null
 */
export async function loadBrandFramework(brandId, supabaseClient) {
  if (!brandId) return null;

  const supabase = supabaseClient || createServerClient();
  const { data, error } = await supabase
    .from("brand_frameworks")
    .select("*")
    .eq("brand_id", brandId)
    .single();

  if (error || !data) {
    // Fallback: try project_frameworks via brand's project_id
    const { data: brand } = await supabase
      .from("brands")
      .select("project_id")
      .eq("id", brandId)
      .single();
    if (brand?.project_id) {
      return loadFramework(brand.project_id, supabase);
    }
    return null;
  }

  return {
    id: data.id,
    brandId: data.brand_id,
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
    // Tier 2: Brand context + custom dimensions (supports both flat and nested)
    const dimContext = buildCustomDimensionContext(framework);
    return `${brandProfile}${intentsSection}${dimContext}`;
  }

  // Tier 1: Generic brand context only
  return `${brandProfile}${intentsSection}\n\nYou are analyzing competitive communications for ${brandName || "this brand"} in the ${industry || "given"} industry. Use standard marketing analysis dimensions. Focus on communication intent, brand archetype, tone of voice, execution style, funnel stage, and overall quality rating.`;
}

/**
 * Build a dynamic classification prompt for the analyze endpoint.
 * Reads from SYSTEM_DIMENSIONS + custom dimensions (supports both flat and nested formats).
 */
export function buildClassificationFields(framework) {
  if (!framework) return null; // Use legacy prompt

  const { SYSTEM_DIMENSIONS } = require("@/lib/system-dimensions");
  const fields = {};

  // System dimensions — iterate all fields from config
  for (const dim of SYSTEM_DIMENSIONS) {
    for (const field of dim.fields || []) {
      // Skip non-classifiable fields (UI-only types)
      if (["toggle", "brand_selector", "country_search", "url", "rating"].includes(field.type)) continue;

      const key = field.db_key || field.key;
      if (field.type === "multichoice" && field.values?.length) {
        fields[key] = `MUST be one or more of: ${field.values.join(" | ")} — comma separated if multiple`;
      } else if (field.type === "single_choice" && field.values?.length) {
        fields[key] = `MUST be: ${field.values.join(" | ")}`;
      } else if (field.type === "textarea") {
        // Contextual descriptions for key textareas
        const descs = {
          synopsis: "What is this piece communicating? (3-5 sentences)",
          insight: "The human truth this piece activates (1 sentence)",
          idea: "The creative concept (1 sentence)",
          analyst_comment: "Strategic observation — what makes this piece interesting (2-3 sentences)",
          transcript: "Extract any readable text/copy/dialogue from the piece",
        };
        fields[key] = descs[key] || `${field.name} — brief description`;
      } else if (field.type === "text") {
        const descs = {
          description: "Brief title/description (max 15 words)",
          main_slogan: "Main headline, tagline, or slogan (exact text if visible/audible)",
          primary_territory: "The main emotional/strategic territory",
          secondary_territory: "Secondary territory if applicable, or empty string",
          brand_attributes: "Key brand attributes (comma separated, max 5)",
          emotional_benefit: "Primary emotional benefit (1 phrase)",
          rational_benefit: "Primary rational benefit (1 phrase)",
          main_vp: "Main value proposition (1 sentence)",
          r2b: "Reason to believe (1 phrase)",
          pain_point: "Specific pain point addressed (1 sentence, or empty)",
          bank_role: "The role the brand plays (e.g. Advisor, Partner, Enabler)",
          pain_point_type: "MUST be: Names real problem | Aspiration territory | Product-focused only | Other",
          language_register: "MUST be: Owner language | Institutional language | Mixed | Neither | Other",
        };
        fields[key] = descs[key] || `${field.name}`;
      } else if (field.type === "taxonomy") {
        const descs = {
          category: "Industry category of the brand — MUST be one of: Alcoholic drinks | Automotive | Business & industrial | Clothing & accessories | Financial services | Food | Household & domestic | Leisure & entertainment | Media & publishing | Nicotine | Non-profit, public sector & education | Pharma & healthcare | Politics | Retail | Soft drinks | Technology & electronics | Telecoms & utilities | Toiletries & cosmetics | Transport & tourism",
          sub_category: "Specific sub-category within the industry (e.g. for Financial services: Banks, Digital payments, Insurance, etc.)",
        };
        fields[key] = descs[key] || `${field.name} — classification from taxonomy`;
      }
    }
  }

  // Always include rating and type
  fields.rating = "MUST be: 1 | 2 | 3 | 4 | 5";
  fields.type = fields.type || "MUST be: Video | Print | Digital | Social post | OOH | Website | Blog | Podcast | Event | Direct mail | In-branch | Integrated campaign | Other";

  // Custom dimensions — support BOTH flat format and nested format
  const customDims = framework.dimensions || framework.customDimensions || [];
  for (const dim of customDims) {
    if (dim.fields?.length) {
      // NEW nested format: dimension has fields array
      for (const field of dim.fields) {
        const descSuffix = field.description ? ` (${field.description})` : "";
        if (field.type === "single_choice" && field.values?.length) {
          fields[field.key] = `MUST be: ${field.values.join(" | ")} | Other${descSuffix}`;
        } else if (field.type === "multichoice" && field.values?.length) {
          fields[field.key] = `MUST be one or more of: ${field.values.join(" | ")} | Other — comma separated if multiple${descSuffix}`;
        } else {
          fields[field.key] = `${field.name}${descSuffix || " — brief description or classification"}`;
        }
      }
    } else if (dim.key && dim.values?.length) {
      // OLD flat format: dimension IS the field
      fields[dim.key] = `MUST be: ${dim.values.join(" | ")} | Other`;
    }
  }

  return fields;
}

/**
 * Build prompt context for custom dimensions (classification rules).
 * Supports both flat and nested formats.
 */
export function buildCustomDimensionContext(framework) {
  const customDims = framework?.dimensions || framework?.customDimensions || [];
  if (!customDims.length) return "";

  let context = "\n=== CUSTOM ANALYSIS FRAMEWORKS ===\n";
  for (const dim of customDims) {
    if (dim.fields?.length) {
      // Nested format
      context += `\n${dim.name.toUpperCase()}:\n`;
      if (dim.description) context += `${dim.description}\n`;
      if (dim.classification_rules) context += `Classification rules: ${dim.classification_rules}\n`;
      for (const field of dim.fields) {
        if (field.values?.length) {
          context += `- ${field.name}: ${field.values.join(", ")}${field.description ? ` (${field.description})` : ""}\n`;
        }
      }
    } else if (dim.values?.length) {
      // Flat format
      context += `\n${dim.name}: ${dim.values.join(", ")}`;
      if (dim.description) context += `\nDescription: ${dim.description}`;
      if (dim.classification_rules) context += `\nClassification rules: ${dim.classification_rules}`;
      context += "\n";
    }
  }
  return context;
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
