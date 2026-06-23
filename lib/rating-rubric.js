// Multi-dimensional rating rubric, BY PIECE TYPE. The AI scores each dimension 1-5 with a
// one-line rationale; the overall rating = rounded average; the analyst can override.
// Feeds the weight engine's QUALITY mode (Global Creative Inspiration) and each report's
// "what's working" selection. Keep this the single source of truth for the dimensions —
// the analyze route mirrors these labels in its prompt.

export const RUBRICS = {
  hero: {
    label: "Hero / commercial",
    hint: "TV, YouTube, brand film, manifesto",
    dims: [
      { key: "distinctiveness", label: "Distinctiveness" },
      { key: "craft", label: "Craft" },
      { key: "strategic_clarity", label: "Strategic clarity" },
      { key: "resonance", label: "Resonance" },
    ],
  },
  social: {
    label: "Social content",
    hint: "IG / TikTok / social post",
    dims: [
      { key: "hook", label: "Hook / scroll-stop" },
      { key: "native_craft", label: "Platform-native craft" },
      { key: "brand_fit", label: "Brand fit" },
      { key: "traction", label: "Traction" },
    ],
  },
  positioning: {
    label: "Positioning / web",
    hint: "Declared positioning, website",
    dims: [
      { key: "clarity", label: "Clarity" },
      { key: "distinctiveness", label: "Distinctiveness" },
      { key: "credibility", label: "Credibility / proof" },
    ],
  },
  product: {
    label: "Product / promo",
    hint: "Product, offer, promo",
    dims: [
      { key: "offer_clarity", label: "Offer clarity" },
      { key: "persuasion", label: "Persuasion" },
      { key: "brand_building", label: "Brand-building" },
    ],
  },
};

// Infer the piece type from its metadata (used for the UI label; the AI also self-selects).
export function pieceType(piece = {}) {
  const t = String(piece.type || "").toLowerCase();
  const ch = String(piece.channel || "").toLowerCase();
  const intent = String(piece.communication_intent || piece.intent || "").toLowerCase();
  if (/social/.test(t) || /social/.test(ch)) return "social";
  if (/product|promo|offer|sale/.test(intent)) return "product";
  if (/web|positioning|declared/.test(ch) || /positioning|manifesto/.test(intent) === false && /web/.test(ch)) return "positioning";
  if (/hero|manifesto|positioning/.test(intent) || /mass media|tv|youtube|video|film|commercial/.test(ch + " " + t)) return "hero";
  return "hero";
}

export function rubricFor(piece) { return RUBRICS[pieceType(piece)] || RUBRICS.hero; }

// Average of the dimension scores (1-5), rounded. Returns null if nothing scored.
export function overallFromDims(dims) {
  const vals = (Array.isArray(dims) ? dims.map((d) => d.score) : Object.values(dims || {})).map(Number).filter((n) => n >= 1 && n <= 5);
  if (!vals.length) return null;
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}
