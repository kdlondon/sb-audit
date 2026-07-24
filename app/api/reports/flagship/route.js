import { createClient } from "@supabase/supabase-js";
import { loadFramework } from "@/lib/framework-loader";
import { pieceWeight } from "@/lib/weights";
import { flagshipVisuals } from "@/lib/report-visuals";
import { extractSectionData, dataInstruction } from "@/lib/report-section-data";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 6 weighted sections in 2 passes ~50s; give Vercel headroom

// Strategic Positioning Report (flagship). Six sections generated section-by-section, each fed
// the entries re-weighted for that section by lib/weights (brand-signal mode), plus Brand DNA as
// the "expressed" source. Two parallel passes: the 4 analytical sections, then exec read + recs.
const cdOf = (e) => { try { return typeof e.custom_dimensions === "string" ? JSON.parse(e.custom_dimensions) : (e.custom_dimensions || {}); } catch { return {}; } };
const clean = (s) => String(s || "").replace(/[\uD800-\uDFFF]/g, "").replace(/\s+/g, " ").trim();

async function claude(apiKey, prompt, maxTokens = 1300) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: maxTokens, messages: [{ role: "user", content: prompt.replace(/[\uD800-\uDFFF]/g, "") }] }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return (data.content?.map((c) => c.text || "").join("") || "").trim();
}

const ICP_LENS = {
  brand: "Frame for the CLIENT BRAND: where to move, what to own, what to protect.",
  agency: "Frame for an AGENCY: the territory worth selling and the diagnostic that justifies a strategic engagement.",
  vc: "Frame through a VC / startup lens: is the positioning defensible and distinct vs the category, and where is the wedge.",
};

export async function POST(request) {
  const { project_id, scope = "category", brand = "", icp = "brand", sections: cfgIn, section: regenKey, priorSections, filters: filtersIn, customInstructions = "", findings } = await request.json();
  const findingsBlock = (Array.isArray(findings) && findings.length)
    ? `\n\nANALYST FINDINGS — the analyst's saved conclusions. Treat as PRIORITY signals: weave them into the relevant sections where they fit, and honor them in recommendations.\n${findings.map((f) => `- ${f.title || f.summary || "Finding"}${f.stat ? ` (${f.stat})` : ""}${f.summary && f.title ? `: ${f.summary}` : ""}`).join("\n")}`
    : "";
  if (!project_id) return Response.json({ error: "project_id required" }, { status: 400 });
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const sUrl = process.env.NEXT_PUBLIC_SUPABASE_URL, sKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!apiKey || !sUrl || !sKey) return Response.json({ error: "Server not configured" }, { status: 500 });

  const admin = createClient(sUrl, sKey, { auth: { persistSession: false } });
  const { data: rows, error: rowsErr } = await admin.from("creative_source")
    .select("id,competitor,brand,brand_name,communication_intent,channel,year,rating,primary_territory,brand_archetype,tone_of_voice,main_slogan,synopsis,description,custom_dimensions")
    .eq("project_id", project_id);
  // A failed query must not masquerade as an empty project: that reads as a permanent
  // "no entries" and is never retried, when in fact it is usually transient.
  if (rowsErr) return Response.json({ error: `Could not load entries: ${rowsErr.message}` }, { status: 503 });
  if (!rows || rows.length === 0) return Response.json({ error: "No entries found for this project" }, { status: 404 });

  let framework = null; try { framework = await loadFramework(project_id); } catch {}
  const lang = framework?.language || "English";
  const category = framework?.industry || "the category";
  const refYear = new Date().getFullYear();

  const pieces = rows.map((e) => { const cd = cdOf(e), s = cd._social || {}; return {
    id: e.id, brand: e.competitor || e.brand || e.brand_name || "—",
    channel: e.channel || "", format: s.format || "",
    communication_intent: e.communication_intent || "", rating: e.rating, year: e.year,
    territory: e.primary_territory || "", archetype: e.brand_archetype || "", tone: e.tone_of_voice || "",
    slogan: clean(e.main_slogan), text: clean(e.description || e.synopsis).slice(0, 160),
  }; });

  const brands = [...new Set(pieces.map((p) => p.brand))].filter((b) => b && b !== "—");
  const subject = brand || brands[0] || "the subject brand";
  const client = framework?.brandName || (scope === "brand" ? subject : "the client");

  // Brand DNA (latest per brand) — the "expressed" source
  const { data: dnaRows } = await admin.from("brand_dna").select("brand,profile,created_at").eq("project_id", project_id).order("created_at", { ascending: false });
  const dnaByBrand = {}; (dnaRows || []).forEach((r) => { if (!dnaByBrand[r.brand]) dnaByBrand[r.brand] = r.profile; });
  const dnaPieces = Object.entries(dnaByBrand).map(([b, p]) => ({
    brand: b, source: "brand_dna", communication_intent: "Brand Hero", channel: "Digital (web)",
    text: clean(`Claim: ${p?.claim?.hero || p?.claim || ""} · Positioning: ${p?.positioning || ""} · Role expressed: ${p?.role?.expressed || ""}`).slice(0, 200),
  }));
  const allPieces = pieces.concat(dnaPieces);

  const topFor = (section, pool, n = 24) => pool
    .map((p) => ({ p, w: pieceWeight(p, { section, mode: "brand_signal", refYear }) }))
    .filter((x) => x.w > 0).sort((a, b) => b.w - a.w).slice(0, n);
  const ctx = (sel) => sel.map(({ p, w }) => `- ${p.id ? `[#${p.id}] ` : ""}[${p.brand}] (${p.communication_intent || "?"} · ${p.source || p.channel || "?"}${p.territory ? " · " + p.territory : ""}) w${w}: ${p.text || p.slogan || ""}`).join("\n");

  const subjPool = (pool) => scope === "brand" ? pool.filter((p) => p.brand === subject) : pool;
  // head is built lazily below, once the filters exist — naming every project brand here
  // while the evidence was filtered made the model write about brands the analyst excluded.
  const rules = `Use the weighted EVIDENCE (higher wN = stronger brand signal — weight it accordingly; never treat high-volume tactical posts as strategic). CRITICAL: this is a finished, client-facing deliverable — do NOT mention weights, "wN" values, evidence counts, "brand_dna", or your methodology/how-you-analyzed. Write the polished section only. Cite brands by name. No fabrication beyond the evidence.
- When you ENUMERATE elements (axes, territories, opportunities, brands, examples), use a Markdown bullet or numbered list — never a long comma-separated sentence.
- BACK CLAIMS WITH EXAMPLES: when you reference a specific captured piece, link it inline as [a short descriptive name](cite:ID) using the #ID shown for that piece in the evidence. Cite real examples liberally. Do NOT cite the web profile entries (those have no #ID).
No emojis. Write in ${lang}. Markdown with a short ## header.`;

  const ALL_DEFS = {
    landscape: { title: "Category landscape", pool: allPieces, task: `Map how the category communicates: the territories occupied and who owns what. 2-3 tight paragraphs + a short bullet list of territory ownership.` },
    positioning: { title: "Positioning x-ray", pool: subjPool(allPieces), task: `Contrast EXPRESSED (what the brand says — Brand DNA / web, the brand_dna evidence) vs VALIDATED (what its content actually does) ${scope === "brand" ? `for ${subject}` : "for each main brand"}. Surface the gap between the two — that gap is the key insight.` },
    hero: { title: "Hero & message consistency", pool: subjPool(allPieces), task: `Assess whether the hero/brand message is stable over time and coherent across channels (only hero-level signals are included here). Flag drift or inconsistency vs the declared positioning.` },
    whitespace: { title: "White space & opportunity", pool: allPieces, task: `Identify territories and angles nobody clearly owns, then name 3-5 concrete opportunity territories for ${client}.

AFTER the prose, append a fenced \`\`\`json block listing the white spaces you just identified, so they can be charted. One object per space:
[{"name":"short label, max 5 words","supply":1-5,"demand":1-5,"closest":"brand nearest to it, or null"}]
supply = how covered the space already is (1 = nobody, 5 = crowded). demand = how much pull it has with the audience (1 = little, 5 = strong). Judge both from the evidence and your analysis. Include ONLY spaces you discussed in the prose, in the same order.` },
  };
  const titleFor = { exec: "Executive read", recommendations: "Strategic recommendations" };
  const DEFAULT_ORDER = ["exec", "landscape", "positioning", "hero", "whitespace", "recommendations"];
  // Section CONFIG from the client: ordered [{key, on, prompt}]. Falls back to all-on default.
  const cfg = (Array.isArray(cfgIn) && cfgIn.length ? cfgIn : DEFAULT_ORDER.map((key) => ({ key, on: true, prompt: "" })))
    .filter((s) => s && s.on !== false && (ALL_DEFS[s.key] || s.key === "exec" || s.key === "recommendations"));
  const cfgMap = Object.fromEntries(cfg.map((s) => [s.key, s]));
  const lensInstr = ICP_LENS[icp] || ICP_LENS.brand;
  const ci = (customInstructions || "").trim();

  // GLOBAL data filters — one lens applied to the whole report (brands / intents / year window / weight mode).
  const fl = filtersIn || {};
  const mode = fl.mode || "brand_signal";
  const passFilter = (p) => {
    if (Array.isArray(fl.brands) && fl.brands.length && !fl.brands.includes(p.brand)) return false;
    if (Array.isArray(fl.intents) && fl.intents.length && p.source !== "brand_dna" && !(p.communication_intent || "").split(",").map((s) => s.trim()).some((it) => fl.intents.includes(it))) return false;
    if (fl.yearFrom && p.year && Number(p.year) < Number(fl.yearFrom)) return false;
    if (fl.yearTo && p.year && Number(p.year) > Number(fl.yearTo)) return false;
    return true;
  };
  // Brands actually in scope after filtering — this is what the prompt must name.
  const scopedBrands = [...new Set(pieces.filter(passFilter).map((p) => p.brand))].filter((b) => b && b !== "—");
  const head = `Category: ${category}. Brands in study: ${(scopedBrands.length ? scopedBrands : brands).join(", ")}. Scope: ${scope === "brand" ? `single brand — ${subject}` : "whole category"}.${scopedBrands.length && scopedBrands.length < brands.length ? " Analyse ONLY these brands; any other brand in the project is deliberately out of scope and must not be discussed." : ""}`;

  // Territory stats for the visual blocks: how covered a territory is (supply) and how it
  // performs (pull, from the analyst/AI rating). Computed from the filtered set only.
  const inScope = pieces.filter(passFilter);
  const terrMap = {};
  inScope.forEach((p) => {
    String(p.territory || "").split(",").map((t) => t.trim()).filter(Boolean).forEach((t) => {
      const v = (terrMap[t] ||= { name: t, count: 0, brands: new Set(), ratings: [] });
      v.count++; v.brands.add(p.brand);
      if (Number(p.rating)) v.ratings.push(Number(p.rating));
    });
  });
  const territories = Object.values(terrMap)
    .map((t) => ({ name: t.name, count: t.count, brands: t.brands.size, pull: t.ratings.length ? t.ratings.reduce((a, b) => a + b, 0) / t.ratings.length : null }))
    .sort((a, b) => b.count - a.count);
  const visualStats = { territories, brandCount: (scopedBrands.length ? scopedBrands : brands).length, totalPieces: pieces.length, inRange: inScope.length };
  const withVisuals = (sec) => sec ? { ...sec, visuals: flagshipVisuals(sec.key, { ...visualStats, gaps: sec.data }) } : sec;

  const selFor = (key) => ALL_DEFS[key].pool.filter(passFilter)
    .map((p) => ({ p, w: pieceWeight(p, { section: key, mode, refYear }) }))
    .filter((x) => x.w > 0).sort((a, b) => b.w - a.w).slice(0, 24);

  const genAnalytical = async (key) => {
    const sd = ALL_DEFS[key]; const custom = (cfgMap[key]?.prompt || "").trim();
    const dir = [custom, ci].filter(Boolean).join(" · ");
    const prompt = `You are a senior brand strategist writing the "${sd.title}" section of a Strategic Positioning Report.\n${head}\n\nTASK: ${sd.task}${dir ? `\nADDITIONAL ANALYST DIRECTION — weave this in: ${dir}` : ""}\n${rules}${findingsBlock}\n\nEVIDENCE (re-weighted for this section):\n${ctx(selFor(key)).slice(0, 7000)}`;
    const raw = await claude(apiKey, prompt, 4000);
    const { markdown, data } = extractSectionData(raw);
    return { key, title: sd.title, markdown, data };
  };
  const genExec = async (body) => {
    const dir = [(cfgMap.exec?.prompt || "").trim(), ci].filter(Boolean).join(" · ");
    return { key: "exec", title: titleFor.exec, markdown: await claude(apiKey, `Write the EXECUTIVE READ (the strategic headline) of this Strategic Positioning Report for ${client} in ${category}. 3-4 sentences synthesizing the sections below: where the category is saturated, where it is open, and the single biggest strategic move. ${lensInstr}${dir ? ` Analyst direction: ${dir}.` : ""} Do NOT mention methodology or how you analyzed — finished client-facing prose only. No emojis. Write in ${lang}. Markdown.\n\nSECTIONS:\n${body}`, 700) };
  };
  const genRecs = async (body) => {
    const dir = [(cfgMap.recommendations?.prompt || "").trim(), ci].filter(Boolean).join(" · ");
    return { key: "recommendations", title: titleFor.recommendations, markdown: await claude(apiKey, `Write STRATEGIC RECOMMENDATIONS for ${client}: 4-6 prioritized, concrete, one-sentence actions grounded in the sections below. ${lensInstr}${dir ? ` Analyst direction: ${dir}.` : ""}${findingsBlock} Do NOT mention methodology. No emojis. Write in ${lang}. Markdown numbered list.\n\nSECTIONS:\n${body}`, 2200) };
  };
  const inRange = pieces.filter(passFilter).length;
  const meta = { scope, subject: scope === "brand" ? subject : null, icp, brands: brands.length, pieces: pieces.length, inRange, brandDna: dnaPieces.length };

  try {
    // SINGLE-SECTION regeneration — generate just one section (fast iteration).
    if (regenKey) {
      if (ALL_DEFS[regenKey]) return Response.json({ section: withVisuals(await genAnalytical(regenKey)), meta });
      const body = (Array.isArray(priorSections) ? priorSections : []).filter((s) => s && ALL_DEFS[s.key]).map((s) => `### ${s.title}\n${s.markdown}`).join("\n\n").slice(0, 9000);
      if (regenKey === "exec") return Response.json({ section: withVisuals(await genExec(body)), meta });
      if (regenKey === "recommendations") return Response.json({ section: withVisuals(await genRecs(body)), meta });
      return Response.json({ error: "Unknown section: " + regenKey }, { status: 400 });
    }

    // FULL report
    const analyticalKeys = cfg.map((s) => s.key).filter((k) => ALL_DEFS[k]);
    const analytical = await Promise.all(analyticalKeys.map(genAnalytical));
    let exec = null, recs = null;
    if (cfgMap.exec || cfgMap.recommendations) {
      const body = analytical.map((s) => `### ${s.title}\n${s.markdown}`).join("\n\n").slice(0, 9000);
      [exec, recs] = await Promise.all([cfgMap.exec ? genExec(body) : Promise.resolve(null), cfgMap.recommendations ? genRecs(body) : Promise.resolve(null)]);
    }
    const byKey = Object.fromEntries(analytical.map((a) => [a.key, a]));
    if (exec) byKey.exec = exec;
    if (recs) byKey.recommendations = recs;
    const sections = cfg.map((s) => byKey[s.key]).filter(Boolean).map(withVisuals);
    return Response.json({ sections, meta });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
