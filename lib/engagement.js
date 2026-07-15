// Single source of truth for "engagement" across Intelligence + Reports.
//
// PRIMARY metric = engagement RATE = interactions / followers — the cross-brand-comparable
// industry standard (a % that doesn't just reward big accounts). Falls back to per-view
// rate (reels/video) when follower data is absent, then to raw interactions for legacy
// content captured before we stored followers. Every consumer imports from here so the
// number means the SAME thing everywhere (the old code had two divergent formulas).
//
// A piece is { likes, comments, views, followers } (all from custom_dimensions._meta).

const n = (v) => Number(v) || 0;

// Raw interaction count (likes + comments). Absolute — use only within one brand.
export const interactions = (p = {}) => n(p.likes) + n(p.comments);

// Engagement rate as a FRACTION (×100 for %). null when neither followers nor views exist.
// `basis` tells the caller which denominator was used ("followers" | "views" | null).
export function engagementRate(p = {}) {
  const followers = n(p.followers);
  if (followers > 0) return interactions(p) / followers;
  const views = n(p.views);
  if (views > 0) return interactions(p) / views;
  return null;
}
export function rateBasis(p = {}) {
  if (n(p.followers) > 0) return "followers";
  if (n(p.views) > 0) return "views";
  return null;
}

// Average engagement rate across posts (fraction). null if none computable.
export function avgEngagementRate(posts = []) {
  const rates = posts.map(engagementRate).filter((r) => r != null);
  if (!rates.length) return null;
  return rates.reduce((a, b) => a + b, 0) / rates.length;
}

// How many of these posts carry the data needed for a rate (for "N/M measurable" notes).
export const rateCoverage = (posts = []) => posts.filter((p) => engagementRate(p) != null).length;

// Format a fraction as a percentage string: 0.0342 → "3.4%", 0.0009 → "0.09%", null → "—".
export function fmtRate(r) {
  if (r == null) return "—";
  const pct = r * 100;
  return `${pct.toFixed(pct < 0.1 ? 2 : pct < 10 ? 1 : 0)}%`;
}

// For the weight engine's performance mode: a rate-first score that still ranks legacy
// (no-follower) content sensibly. Rate when available; else log-scaled interactions
// mapped into a comparable small-fraction band so mixing doesn't explode the ranking.
export function performanceScore(p = {}) {
  const rate = engagementRate(p);
  if (rate != null) return rate;
  return Math.log10(1 + interactions(p)) / 100; // legacy fallback, kept sub-1% so rates dominate
}
