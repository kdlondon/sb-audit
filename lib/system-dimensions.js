// System-level dimensions — always present, not editable by users.
// Same format as brand_frameworks.custom_dimensions (nested with fields array).
// The form, Settings, and AI prompt all read from this + custom dims.

export const SYSTEM_DIMENSIONS = [
  {
    key: "identification",
    name: "1. Identification",
    description: "Core metadata and classification of the communication piece",
    sort_order: 0,
    is_system: true,
    always_expanded: true,
    fields: [
      { key: "scope", name: "Scope", type: "toggle", values: ["local", "global"] },
      { key: "brand_name", name: "Brand", type: "brand_selector" },
      { key: "country", name: "Country / Market", type: "country_search" },
      { key: "category", name: "Category (industry)", type: "taxonomy", taxonomy_type: "category" },
      { key: "sub_category", name: "Sub-category", type: "taxonomy", taxonomy_type: "sub_category", parent_key: "category" },
      { key: "category_proximity", name: "Category proximity", type: "multichoice", values: ["Direct", "Adjacent", "Target proximity"] },
      { key: "description", name: "Title", type: "text" },
      { key: "year", name: "Year", type: "single_choice", values: ["2019","2020","2021","2022","2023","2024","2025","2026"] },
      { key: "type", name: "Type (format)", type: "single_choice", values: ["Video", "Print", "Digital", "Social post", "OOH", "Website", "Blog", "Podcast", "Event", "Direct mail", "In-branch", "Integrated campaign", "Other"], allow_other: true },
      { key: "communication_intent", name: "Communication intent", type: "multichoice", values: ["Brand Hero", "Brand Tactical", "Client Testimonials", "Product", "Innovation", "Beyond Banking", "Other"], allow_other: true },
      { key: "funnel", name: "Funnel stage", type: "multichoice", values: ["Awareness", "Consideration", "Conversion", "Retention", "Advocacy"] },
      { key: "rating", name: "Rating", type: "rating" },
      { key: "url", name: "URL", type: "url" },
      { key: "image_url", name: "Image URL", type: "url" },
      { key: "main_slogan", name: "Main slogan", type: "text" },
      { key: "transcript", name: "Transcript / copy", type: "textarea" },
      { key: "analyst_comment", name: "Analyst notes", type: "textarea" },
    ],
  },
  {
    key: "creative_evaluation",
    name: "2. Creative evaluation",
    description: "Strategic and creative analysis of the piece",
    sort_order: 1,
    is_system: true,
    fields: [
      { key: "synopsis", name: "Synopsis", type: "textarea" },
      { key: "insight", name: "Insight", type: "textarea" },
      { key: "insight_type", name: "Insight type", type: "multichoice", values: ["Behavioural", "Consumer", "Cultural", "Media/channel", "Shopper/path-to-purchase"] },
      { key: "idea", name: "Idea", type: "textarea" },
      { key: "primary_territory", name: "Primary territory", type: "text" },
      { key: "secondary_territory", name: "Secondary territory", type: "text" },
      { key: "creative_approach", name: "Creative approach", type: "multichoice", values: ["Advocacy", "AI as creative approach", "Brand activism", "Brand characters", "Branded utility/product", "Celebrity", "Challenger brand", "Consumer generated content", "CSR", "Emotion", "Humour", "Informative/educational", "Music and sounds", "Partnerships", "Personalisation", "Pop culture", "Shock/fear", "Storytelling", "Stunt", "Sustainability"] },
      { key: "execution_style", name: "Execution style", type: "multichoice", values: ["Live action", "Animation", "Mixed media", "Typography", "Stock footage", "UGC", "Illustration", "Cinematic", "Documentary", "Motion graphics", "Photography", "Data visualisation", "Interactive", "AR/VR", "Other"] },
      { key: "analyst_comment_creative", name: "Analyst comment", type: "textarea", db_key: "analyst_comment" },
    ],
  },
  {
    key: "brand_communication",
    name: "3. Brand & communication",
    description: "Brand positioning, value proposition, and communication strategy",
    sort_order: 2,
    is_system: true,
    fields: [
      { key: "bank_role", name: "Brand role", type: "text" },
      { key: "pain_point_type", name: "Pain point type", type: "text" },
      { key: "pain_point", name: "Pain point", type: "text" },
      { key: "language_register", name: "Language register", type: "text" },
      { key: "main_vp", name: "Main VP", type: "text" },
      { key: "brand_attributes", name: "Brand attributes", type: "text" },
      { key: "emotional_benefit", name: "Emotional benefit", type: "text" },
      { key: "rational_benefit", name: "Rational benefit", type: "text" },
      { key: "r2b", name: "R2B", type: "text" },
      { key: "brand_archetype", name: "Brand archetype", type: "multichoice", values: ["Innocent", "Explorer", "Sage", "Hero", "Outlaw", "Magician", "Regular Guy", "Lover", "Jester", "Caregiver", "Creator", "Ruler", "Not identifiable", "Other"] },
    ],
  },
  {
    key: "execution",
    name: "4. Execution",
    description: "Distribution channels, call to action, and tone",
    sort_order: 3,
    is_system: true,
    fields: [
      { key: "channel", name: "Channel (distribution)", type: "multichoice", values: ["Television/Connected TV", "Cinema", "Radio & audio", "Newspapers", "Magazines", "OOH", "Print", "Social media", "Online video", "Online display", "Email marketing", "Mobile & apps", "Websites & microsites", "Search", "Gaming", "Livestreaming", "Voice/chatbots", "Events & experiential", "Content marketing", "Direct marketing", "PR", "Sponsorship", "Word of mouth/influencers", "Point-of-purchase", "Product placement", "Other"] },
      { key: "cta", name: "CTA", type: "multichoice", values: ["Visit branch", "Call advisor", "Use digital tool", "Apply for product", "Learn more", "Brand only", "No CTA", "Other"] },
      { key: "tone_of_voice", name: "Tone of voice", type: "multichoice", values: ["Authoritative", "Empathetic", "Aspirational", "Peer-level", "Institutional", "Playful", "Urgent", "Other"] },
      { key: "diff_claim", name: "Differentiation", type: "single_choice", values: ["Explicit differentiation", "Implicit positioning", "Interchangeable", "Other"] },
    ],
  },
];

/**
 * Get all dimensions for rendering: system + custom from brand_frameworks.
 * @param {object} brandFramework — from brand_frameworks table (or null)
 * @returns {Array} merged dimensions in sort_order
 */
export function getAllDimensions(brandFramework) {
  const system = SYSTEM_DIMENSIONS.map(d => ({ ...d, is_system: true }));
  // Support both snake_case (from DB) and camelCase (from React context)
  const customRaw = brandFramework?.custom_dimensions || brandFramework?.customDimensions || brandFramework?.dimensions || [];
  const custom = customRaw.map((d, i) => ({
    ...d,
    is_system: false,
    sort_order: d.sort_order ?? (100 + i),
  }));
  // System dims always first (in order), then custom dims sorted by their sort_order
  const sortedCustom = custom.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  return [...system, ...sortedCustom];
}

/**
 * Get a field value from an entry, checking direct column first, then custom_dimensions JSONB.
 * @param {object} entry — creative_source row
 * @param {string} key — field key
 * @returns {string|null}
 */
export function getFieldValue(entry, key) {
  if (!entry) return null;
  // Direct column takes precedence
  if (entry[key] !== undefined && entry[key] !== null && entry[key] !== "") {
    return entry[key];
  }
  // Fallback to JSONB
  return entry.custom_dimensions?.[key] || null;
}

/**
 * Build the list of all field keys (for LOCAL_COLUMNS equivalent).
 * @param {object} brandFramework
 * @returns {string[]}
 */
export function getAllFieldKeys(brandFramework) {
  const dims = getAllDimensions(brandFramework);
  const keys = new Set(["id", "organization_id", "brand_id", "project_id", "scope", "brand_name",
    "country", "custom_dimensions", "created_at", "updated_at", "created_by",
    "competitor", "brand", "image_urls", "xtype"]);
  for (const dim of dims) {
    for (const field of dim.fields || []) {
      keys.add(field.db_key || field.key);
    }
  }
  return [...keys];
}
