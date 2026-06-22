// Weighting engine for report generation.
// Base signal weight = sourceStrength (1-3) x intentTier (1-3) -> 0-9, modulated by recency +
// quality, then re-weighted per report SECTION. Three report families ("modes") flip the
// primary driver: brand-signal (intent x source), performance (engagement), quality (rating).
// Config-driven and fuzzy on labels so it survives per-project/framework taxonomies.

const INTENT_TIER = {
  "brand hero": 3,
  "brand tactical": 2,
  innovation: 2,
  "beyond banking": 2,
  "client testimonials": 1.5,
  product: 1,
};

// An entry's communication_intent may be comma-separated and/or framework-custom. Take the
// strongest (most brand-defining) part. Fuzzy so custom intents still land on a tier.
export function intentTier(intent) {
  if (!intent) return 1.5;
  let t = 0;
  for (const raw of String(intent).toLowerCase().split(",")) {
    const p = raw.trim();
    if (!p) continue;
    if (INTENT_TIER[p] != null) { t = Math.max(t, INTENT_TIER[p]); continue; }
    if (/hero|manifest|positioning/.test(p)) t = Math.max(t, 3);
    else if (/tactical|innovation|beyond|brand/.test(p)) t = Math.max(t, 2);
    else if (/testimon/.test(p)) t = Math.max(t, 1.5);
    else if (/product|promo|offer|sale/.test(p)) t = Math.max(t, 1);
    else t = Math.max(t, 1.5);
  }
  return t || 1.5;
}

const CHANNEL_STRENGTH = {
  "mass media": 3,
  "digital (web)": 2,
  ooh: 2,
  "content marketing": 2,
  pr: 1.5,
  event: 1.5,
  "digital (app)": 1.5,
  "social media": 1.5,
  branch: 1,
  "direct mail": 1,
  other: 1,
};
const FORMAT_BONUS = { reel: 0.5, video: 0.5, carousel: 0, slideshow: 0, static: -0.5, story: -0.5 };

// How deliberate / production-heavy / official the signal is (1-3).
// A web brand profile (Brand DNA crawl) is the strongest "expressed" source.
export function sourceStrength(piece = {}) {
  if (piece.source === "brand_dna" || piece.kind === "brand_profile") return 3;
  const ch = String(piece.channel || "").toLowerCase();
  let s = CHANNEL_STRENGTH[ch] != null ? CHANNEL_STRENGTH[ch] : 1.5;
  if (ch === "social media") s = 1 + (FORMAT_BONUS[String(piece.format || "").toLowerCase()] || 0);
  return Math.max(1, Math.min(3, s));
}

export function baseWeight(piece = {}) {
  return sourceStrength(piece) * intentTier(piece.communication_intent || piece.intent);
}

// Recent pieces drive the pattern; older ones show evolution. Decays past ~3 years.
export function recencyFactor(piece = {}, refYear) {
  const y = Number(piece.year) || (piece.posted_at ? new Date(piece.posted_at).getFullYear() : null);
  if (!y || !refYear) return 1;
  const age = refYear - y;
  if (age <= 1) return 1;
  if (age <= 3) return 0.9;
  if (age <= 5) return 0.7;
  return 0.5;
}

// AI/analyst rating (1-5) nudges weight: 1 -> 0.8, 3 -> 1.0, 5 -> 1.3.
export function qualityFactor(piece = {}) {
  const r = Number(piece.rating);
  if (!r) return 1;
  return 0.8 + (r - 1) * 0.125;
}

// Per-section re-weighting for the flagship (brand-signal mode). tierMult multiplies by the
// piece's intent-tier band; brandDnaMult boosts the expressed source; a 0 filters a band out.
export const SECTION_PROFILES = {
  landscape: { tierMult: { 3: 1, 2: 1, 1: 1 }, brandDnaMult: 1, recency: true },
  positioning: { tierMult: { 3: 1.5, 2: 1, 1: 0.5 }, brandDnaMult: 2, recency: true },
  hero: { tierMult: { 3: 1, 2: 0, 1: 0 }, brandDnaMult: 1.5, recency: true },
  whitespace: { tierMult: { 3: 1, 2: 1, 1: 1 }, brandDnaMult: 1, coverage: true },
};

const band = (tier) => (tier >= 2.5 ? 3 : tier >= 1.5 ? 2 : 1);

// The one call sites use. mode picks the report family's primary driver.
export function pieceWeight(piece = {}, { section, mode = "brand_signal", refYear } = {}) {
  if (mode === "performance") {
    const eng = (Number(piece.likes) || 0) + 3 * (Number(piece.comments) || 0) + 0.1 * (Number(piece.views) || 0);
    return Math.log10(1 + eng) * recencyFactor(piece, refYear);
  }
  if (mode === "quality") {
    return (Number(piece.rating) || 0) * qualityFactor(piece);
  }
  const prof = SECTION_PROFILES[section] || SECTION_PROFILES.landscape;
  const tier = intentTier(piece.communication_intent || piece.intent);
  let w = sourceStrength(piece) * tier * (prof.tierMult[band(tier)] != null ? prof.tierMult[band(tier)] : 1);
  if (piece.source === "brand_dna" || piece.kind === "brand_profile") w *= prof.brandDnaMult || 1;
  if (prof.recency) w *= recencyFactor(piece, refYear);
  if (prof.quality) w *= qualityFactor(piece);
  return Math.round(w * 100) / 100;
}
