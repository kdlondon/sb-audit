// Visual blocks for report sections (B11).
//
// DESIGN DECISION: charts are computed DETERMINISTICALLY from the stats the engines
// already precompute — they are NOT asked of the LLM. The model writes prose; the numbers
// come from the data. That removes any chance of hallucinated figures in a client-facing
// deliverable, and makes the blocks reproducible.
//
// Every builder returns a block matching lib/report-blocks BLOCK_TYPES, so the Document
// view, the paginated PDF and (later) the deck all render from the same structure.

import { makeBlock } from "./report-blocks";

const median = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0; };
const num = (v) => { const n = Number(String(v).replace(/[^\d.-]/g, "")); return Number.isFinite(n) ? n : 0; };

// ── Primitives ──────────────────────────────────────────────────────────────
export const kpiRow = (items, sectionKey) =>
  makeBlock("kpi", { sectionKey, data: { items: items.filter(Boolean).slice(0, 4) } });

export const rankingBars = (items, sectionKey, { max, title, hint } = {}) => {
  const list = items.filter(Boolean);
  const top = max || Math.max(1, ...list.map((i) => num(i.value)));
  return makeBlock("bars", { sectionKey, data: { items: list, max: top, title, hint } });
};

export const formatSplit = (items, sectionKey, { title } = {}) =>
  makeBlock("split", { sectionKey, data: { items: items.filter(Boolean), title } });

export const heatmap = ({ rows, cols, cells, hero = null, legend = ["WEAK", "STRONG"], title }, sectionKey) =>
  makeBlock("heatmap", { sectionKey, data: { rows, cols, cells, hero, legend, title } });

export const quadrant = ({ points, xLabel, yLabel, title, qualitative, measured }, sectionKey) =>
  makeBlock("quadrant", { sectionKey, data: { points, xLabel, yLabel, title, qualitative, measured } });

export const pullQuote = (text, sectionKey, attribution = "") =>
  makeBlock("pullquote", { sectionKey, data: { text, attribution } });

// "k: n" / "k n" aggregate strings → [{ label, value }]
export const parseMix = (mix = []) =>
  mix.map((s) => {
    const m = String(s).match(/^(.*?)[:\s]+(\d+)$/);
    return m ? { label: m[1].trim(), value: Number(m[2]) } : null;
  }).filter(Boolean);

// ── Social Content Benchmark ────────────────────────────────────────────────
// Built from the route's existing perBrand / pillarLandscape / mixes.
export function socialVisuals(key, S = {}) {
  const { perBrand = [], pillarLandscape = [], formatMix = [], platformMix = [], totalPosts = 0, brandCount = 0, windowLabel = "" } = S;
  const byEng = [...perBrand].sort((a, b) => num(b.avgEng) - num(a.avgEng));
  const leader = byEng[0];

  switch (key) {
    case "snapshot": {
      const out = [];
      out.push(kpiRow([
        { label: "Pieces analysed", value: String(totalPosts), caption: windowLabel },
        { label: "Brands", value: String(brandCount), caption: "in this benchmark" },
        { label: "Content pillars", value: String(pillarLandscape.length), caption: "territories in play" },
        leader && { label: "Engagement leader", value: leader.avgEng, caption: leader.brand, hero: true },
      ], key));
      if (perBrand.length) {
        out.push(rankingBars(
          [...perBrand].sort((a, b) => b.posts - a.posts).map((b) => ({ label: b.brand, value: b.posts, hero: leader && b.brand === leader.brand })),
          key, { title: "Volume by brand", hint: "pieces captured" }
        ));
      }
      return out;
    }
    case "territories": {
      if (!pillarLandscape.length) return [];
      const top = pillarLandscape.slice(0, 8);
      return [rankingBars(top.map((p) => ({ label: p.pillar, value: p.posts, caption: `${p.brands} brands · ${p.avgEng}` })), key, { title: "Share of posts by territory", hint: "volume" })];
    }
    case "working": {
      if (!byEng.length) return [];
      return [rankingBars(
        byEng.map((b) => ({ label: b.brand, value: num(b.avgEng), display: b.avgEng, hero: leader && b.brand === leader.brand })),
        key, { title: "Average engagement by brand", hint: "interactions ÷ followers" }
      )];
    }
    case "cadence": {
      const out = [];
      const fmt = parseMix(formatMix);
      if (fmt.length) out.push(formatSplit(fmt, key, { title: "Format" }));
      const plt = parseMix(platformMix);
      if (plt.length > 1) out.push(formatSplit(plt, key, { title: "Platform" }));
      return out;
    }
    case "voice": {
      // Brand × dimension heatmap: presence of each top pillar per brand.
      const cols = pillarLandscape.slice(0, 5).map((p) => p.pillar);
      if (!cols.length || !perBrand.length) return [];
      const rows = perBrand.map((b) => b.brand);
      const cells = perBrand.map((b) => cols.map((c) => (b.topPillars || []).some((tp) => String(tp).startsWith(c)) ? 1 : 0));
      return [heatmap({ rows, cols, cells, title: "Brand × territory" }, key)];
    }
    default:
      return [];
  }
}

// ── Strategic Positioning (flagship) ────────────────────────────────────────
// White space is the section the design gives a 2×2: supply (how covered a territory is)
// against audience pull (how it performs). Both axes come from the entry set.
export function flagshipVisuals(key, S = {}) {
  const { territories = [], brandCount = 0, totalPieces = 0, inRange = 0, gaps = null } = S;
  switch (key) {
    case "landscape": {
      // The MEASURED chart belongs here: it counts what brands actually publish, which is
      // exactly what this section describes.
      if (!territories.length) return [];
      const out = [rankingBars(territories.slice(0, 8).map((t) => ({ label: t.name, value: t.count, caption: `${t.brands} brands` })), key, { title: "Territory ownership", hint: "pieces per territory" })];
      const real = territories.filter((t) => t.pull != null && t.count >= 2);
      if (real.length >= 3) {
        const supplyMid = median(real.map((t) => t.count));
        const pullMid = median(real.map((t) => t.pull));
        const scored = real.map((t) => ({
          label: t.name.length > 34 ? t.name.slice(0, 33) + "…" : t.name,
          x: t.count, y: t.pull,
          open: t.count <= supplyMid, wanted: t.pull >= pullMid,
          hero: t.count <= supplyMid && t.pull >= pullMid,
        }));
        const bucket = (o, w) => scored.filter((p) => p.open === o && p.wanted === w)
          .sort((a, b) => (o ? b.y - a.y : b.x - a.x)).slice(0, 4);
        out.push(quadrant({
          points: [...bucket(true, true), ...bucket(false, true), ...bucket(true, false), ...bucket(false, false)],
          xLabel: "Coverage (pieces) →", yLabel: "↑ Rating", title: "Territory map",
          measured: true,
        }, key));
      }
      return out;
    }
    case "whitespace": {
      // The white spaces are the ones the ANALYSIS named — by definition an unworked space
      // has no tagged pieces, so it can never come out of a count. The engine returns them
      // alongside the prose; the axes are the analyst's judgement, and the chart says so.
      const list = Array.isArray(gaps) ? gaps.filter((g) => g && g.name) : [];
      if (list.length < 2) return [];
      const points = list.slice(0, 8).map((g) => {
        const supply = Number(g.supply) || 1, demand = Number(g.demand) || 3;
        return {
          label: String(g.name).length > 34 ? String(g.name).slice(0, 33) + "…" : String(g.name),
          x: supply, y: demand,
          open: supply <= 2, wanted: demand >= 3,
          hero: supply <= 2 && demand >= 3,
          caption: g.closest || undefined,
        };
      });
      return [quadrant({
        points, xLabel: "Little worked ↔ crowded", yLabel: "↑ Pull with the audience",
        title: "White space", qualitative: true,
      }, key)];
    }
    case "exec": {
      return [kpiRow([
        { label: "Pieces analysed", value: String(inRange || totalPieces) },
        { label: "Brands", value: String(brandCount) },
        { label: "Territories", value: String(territories.length) },
      ], key)];
    }
    default:
      return [];
  }
}

// Router used by the routes: pick the family's builder.
export function visualsFor(family, key, stats) {
  if (family === "performance") return socialVisuals(key, stats);
  if (family === "brand_signal") return flagshipVisuals(key, stats);
  return [];
}
