import { createClient } from "@supabase/supabase-js";
import { innovationVisuals } from "@/lib/report-visuals";
import { extractSectionData, extractLead, dataInstruction, LEAD_RULE } from "@/lib/report-section-data";
import { resolveSource } from "@/lib/report-source";
import { loadFramework } from "@/lib/framework-loader";
import { pieceWeight } from "@/lib/weights";
import { MODELS } from "@/lib/models";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Innovation Report. Studies how brands COMMUNICATE innovations and disruptive
// propositions — the message, not whether the content is novel in form. Distinct from
// Global Creative Inspiration (which is about craft/execution). Brand-signal family,
// focused on innovation-intent evidence.
const cdOf = (e) => { try { return typeof e.custom_dimensions === "string" ? JSON.parse(e.custom_dimensions) : (e.custom_dimensions || {}); } catch { return {}; } };
const clean = (s) => String(s || "").replace(/[\uD800-\uDFFF]/g, "").replace(/\s+/g, " ").trim();

async function claude(apiKey, prompt, maxTokens = 1600) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: MODELS.report, max_tokens: maxTokens, messages: [{ role: "user", content: prompt.replace(/[\uD800-\uDFFF]/g, "") }] }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return (data.content?.map((c) => c.text || "").join("") || "").trim();
}

const ICP_LENS = {
  brand: "Frame for the CLIENT BRAND: which innovation narrative to claim or defend.",
  agency: "Frame for an AGENCY: the innovation territory worth selling and the case for it.",
  vc: "Frame through a VC / startup lens: which innovation claim is defensible and distinct.",
};

// Does this piece COMMUNICATE an innovation / disruptive proposition?
const INNOV_RE = /innovation|innovador|disrupt|lanzamiento|new (app|platform|service|product)|nueva? (app|plataforma|servicio|propuesta)|beyond|ecosystem|first-of|pioneer|reinvent/i;
const isInnovationSignal = (p) =>
  /innovation|disrupt/i.test(p.communication_intent || "") || INNOV_RE.test(p.text || "") || INNOV_RE.test(p.slogan || "");

export async function POST(request) {
  const { project_id, scope = "category", brand = "", icp = "brand", sections: cfgIn, section: regenKey, priorSections, filters: filtersIn, source: sourceSel, customInstructions = "", findings } = await request.json();
  const findingsBlock = (Array.isArray(findings) && findings.length)
    ? `\n\nANALYST FINDINGS — treat as PRIORITY signals: weave them into the relevant sections and honor them in recommendations.\n${findings.map((f) => `- ${f.title || f.summary || "Finding"}${f.stat ? ` (${f.stat})` : ""}${f.summary && f.title ? `: ${f.summary}` : ""}`).join("\n")}`
    : "";
  if (!project_id) return Response.json({ error: "project_id required" }, { status: 400 });
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const sUrl = process.env.NEXT_PUBLIC_SUPABASE_URL, sKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!apiKey || !sUrl || !sKey) return Response.json({ error: "Server not configured" }, { status: 500 });

  const admin = createClient(sUrl, sKey, { auth: { persistSession: false } });
  // The Configure step's source selection — local / global / both, a set of brands, or a
  // collection — is resolved HERE. It used to be ignored: the route read every entry in the
  // project, so a report configured as "local audit only" silently included global
  // benchmarks. The configurator counted the selection correctly all along, which made the
  // mismatch invisible until the report came out wrong.
  let rows = [];
  try {
    const resolved = await resolveSource(admin, project_id, sourceSel || { mode: "audit", value: "both" });
    rows = resolved.entries;
  } catch (e) {
    return Response.json({ error: `Could not load entries: ${e.message}` }, { status: 503 });
  }
  if (!rows.length) return Response.json({ error: "No entries match this configuration" }, { status: 404 });

  let framework = null; try { framework = await loadFramework(project_id); } catch {}
  const lang = framework?.language || "English";
  const category = framework?.industry || "the category";
  const refYear = new Date().getFullYear();

  const pieces = rows.map((e) => { const cd = cdOf(e), s = cd._social || {}; return {
    id: e.id, brand: e.competitor || e.brand || e.brand_name || "—",
    channel: e.channel || "", format: s.format || "",
    communication_intent: e.communication_intent || "", rating: e.rating, year: e.year,
    territory: e.primary_territory || "", archetype: e.brand_archetype || "", tone: e.tone_of_voice || "",
    slogan: clean(e.main_slogan), text: clean(e.description || e.synopsis).slice(0, 180),
  }; });

  const brands = [...new Set(pieces.map((p) => p.brand))].filter((b) => b && b !== "—");
  const subject = brand || brands[0] || "the subject brand";
  const client = framework?.brandName || (scope === "brand" ? subject : "the client");

  // Focus the pool on innovation communication; fall back to the whole set if too thin.
  const innov = pieces.filter(isInnovationSignal);
  const pool = innov.length >= 6 ? innov : pieces;
  const focusNote = innov.length >= 6 ? `${innov.length} innovation-communicating pieces identified.` : `Few explicit innovation signals — reading the whole set for innovation cues.`;

  const fl = filtersIn || {};
  const passFilter = (p) => {
    if (Array.isArray(fl.brands) && fl.brands.length && !fl.brands.includes(p.brand)) return false;
    // Communication intents are offered in the Configure step but were only ever applied by
    // the flagship; here the choice was silently discarded.
    if (Array.isArray(fl.intents) && fl.intents.length &&
        !(p.communication_intent || "").split(",").map((x) => x.trim()).some((x) => fl.intents.includes(x))) return false;
    if (fl.yearFrom && p.year && Number(p.year) < Number(fl.yearFrom)) return false;
    if (fl.yearTo && p.year && Number(p.year) > Number(fl.yearTo)) return false;
    return true;
  };
  const selFor = (n = 24) => pool.filter(passFilter)
    .map((p) => ({ p, w: pieceWeight(p, { section: "landscape", mode: "brand_signal", refYear }) + (isInnovationSignal(p) ? 3 : 0) }))
    .filter((x) => x.w > 0).sort((a, b) => b.w - a.w).slice(0, n);
  const ctx = (sel) => sel.map(({ p, w }) => `- ${p.id ? `[#${p.id}] ` : ""}[${p.brand}] (${p.communication_intent || "?"} · ${p.channel || "?"}${p.territory ? " · " + p.territory : ""}): ${p.text || p.slogan || ""}`).join("\n");

  const scopedBrands = [...new Set(pool.filter(passFilter).map((p) => p.brand))].filter((b) => b && b !== "—");
  const head = `Category: ${category}. Brands: ${(scopedBrands.length ? scopedBrands : brands).join(", ")}. ${focusNote}${scopedBrands.length && scopedBrands.length < brands.length ? " Analyse ONLY these brands; others are out of scope." : ""}`;
  const rules = `CRITICAL DISTINCTION — this report is about the MESSAGE, not the craft. You are studying how brands COMMUNICATE innovations and disruptive PROPOSITIONS: a new service, platform, ecosystem, business model or capability the brand is putting into the world (e.g. a brand launching a geolocated community app for small businesses). You are NOT judging whether the content is creatively novel or well-executed — that is a different report. A beautifully-made ad with no innovation message does NOT belong here; a plain post announcing a genuinely new proposition DOES.
- Enumerate with Markdown bullet/numbered lists, never long comma sentences.
- Back claims with examples: link a captured piece inline as [short name](cite:ID) using its id. Use the ID ONLY — never carry the "#" into the link, and never write a bare "(#id)": that is a page anchor, not a citation. Cite liberally.
- This is a finished client-facing deliverable — do NOT mention methodology, weights or evidence counts. No emojis. Write in ${lang}. Markdown with a short ## header.`;

  const ALL_DEFS = {
    innovation_map: { title: "Innovation map", task: `Map WHICH innovations and disruptive propositions brands are communicating, and in what territories. Group by type of proposition (new service / platform / ecosystem / business model / capability). 2-3 paragraphs + a bullet list of the propositions seen and who is making them.` },
    who_moves: { title: "Who's moving", task: `Assess WHICH brands are claiming the innovation space and how CREDIBLY — is the innovation message backed by a real proposition or is it just innovation-flavoured language? Contrast the leaders vs the followers.` },
    innovation_gaps: { title: "Gaps & open ground", task: `Identify innovation angles and propositions that NOBODY in the category is communicating yet — open ground for ${client} to claim an innovation narrative. Name 3-5 concrete opportunities.` + dataInstruction(
      `[{"name":"short label, max 5 words","supply":1-5,"demand":1-5,"closest":"nearest brand, or null"}]`,
      `supply = how claimed the angle already is (1 = nobody, 5 = crowded). demand = its strategic value (1 = marginal, 5 = high). Judge both from the evidence. ONLY the gaps you discussed, in the same order.`) },
  };
  const titleFor = { exec: "Executive read", recommendations: "Recommendations" };
  const DEFAULT_ORDER = ["exec", "innovation_map", "who_moves", "innovation_gaps", "recommendations"];
  const cfg = (Array.isArray(cfgIn) && cfgIn.length ? cfgIn : DEFAULT_ORDER.map((key) => ({ key, on: true, prompt: "" })))
    .filter((s) => s && s.on !== false && (ALL_DEFS[s.key] || s.key === "exec" || s.key === "recommendations"));
  const cfgMap = Object.fromEntries(cfg.map((s) => [s.key, s]));
  const lensInstr = ICP_LENS[icp] || ICP_LENS.brand;
  const ci = (customInstructions || "").trim();

  const genAnalytical = async (key) => {
    const sd = ALL_DEFS[key]; const dir = [(cfgMap[key]?.prompt || "").trim(), ci].filter(Boolean).join(" · ");
    const prompt = `You are a senior innovation strategist writing the "${sd.title}" section of an Innovation Report.\n${head}\n\nTASK: ${sd.task}${dir ? `\nADDITIONAL ANALYST DIRECTION — weave this in: ${dir}` : ""}\n${rules}${findingsBlock}\n\nEVIDENCE:\n${ctx(selFor()).slice(0, 7000)}`;
    const { markdown: noLead, lead } = extractLead(await claude(apiKey, prompt + LEAD_RULE, 3200));
    const { markdown, data } = extractSectionData(noLead);
    return { key, title: sd.title, markdown, data, lead };
  };
  const genExec = async (body) => {
    const dir = [(cfgMap.exec?.prompt || "").trim(), ci].filter(Boolean).join(" · ");
    const raw = await claude(apiKey, `Write the EXECUTIVE READ of this Innovation Report for ${client} in ${category}: 3-4 sentences on who owns the innovation narrative, where it is thin, and the single biggest move. ${lensInstr}${dir ? ` Analyst direction: ${dir}.` : ""} No methodology, no emojis. Write in ${lang}. Markdown.\n\nSECTIONS:\n${body}` + LEAD_RULE, 700);
    const { markdown, lead } = extractLead(raw);
    return { key: "exec", title: titleFor.exec, markdown, lead };
  };
  const genRecs = async (body) => {
    const dir = [(cfgMap.recommendations?.prompt || "").trim(), ci].filter(Boolean).join(" · ");
    const raw = await claude(apiKey, `Write RECOMMENDATIONS for ${client} on the innovation narrative: 4-6 prioritized, concrete, one-sentence actions grounded in the sections below. ${lensInstr}${dir ? ` Analyst direction: ${dir}.` : ""}${findingsBlock} No methodology, no emojis. Write in ${lang}. Markdown numbered list.\n\nSECTIONS:\n${body}` + LEAD_RULE + dataInstruction(`[{"name":"the action, 3-6 words","move":"what to do, one sentence","impact":"High|Medium|Low","effort":"High|Medium|Low"}]`, `One object per action, in the same order as the prose. Only include impact/effort when you can genuinely judge them; omit both fields otherwise rather than guessing.`), 2200);
    const { markdown: noLead, lead } = extractLead(raw);
    const { markdown, data } = extractSectionData(noLead);
    return { key: "recommendations", title: titleFor.recommendations, markdown, lead, data };
  };
  // Computed from the innovation pool the prompts already use — never asked of the model.
  // Only the gaps arrive as the analysis's own data, for the same reason white space does.
  const terrTally = {};
  pool.forEach((p) => (p.territory || "").split(",").map((t) => t.trim()).filter(Boolean).forEach((t) => {
    if (!terrTally[t]) terrTally[t] = { name: t, count: 0, brands: new Set() };
    terrTally[t].count++; terrTally[t].brands.add(p.brand);
  }));
  const brandTally = {};
  pool.forEach((p) => { if (p.brand && p.brand !== "—") brandTally[p.brand] = (brandTally[p.brand] || 0) + 1; });
  const visualStats = {
    pieceCount: pool.length, brandCount: brands.length,
    territories: Object.values(terrTally).map((t) => ({ name: t.name, count: t.count, brands: t.brands.size })).sort((a, b) => b.count - a.count),
    perBrand: Object.entries(brandTally).map(([brand, count]) => ({ brand, count })).sort((a, b) => b.count - a.count),
  };
  const withVisuals = (sec) => sec ? { ...sec, visuals: innovationVisuals(sec.key, { ...visualStats, gaps: sec.data, plays: sec.data }) } : sec;

  const meta = { scope, subject: scope === "brand" ? subject : null, icp, brands: brands.length, pieces: pieces.length, innovationSignals: innov.length };

  try {
    if (regenKey) {
      if (ALL_DEFS[regenKey]) return Response.json({ section: withVisuals(await genAnalytical(regenKey)), meta });
      const body = (Array.isArray(priorSections) ? priorSections : []).filter((s) => s && ALL_DEFS[s.key]).map((s) => `### ${s.title}\n${s.markdown}`).join("\n\n").slice(0, 9000);
      if (regenKey === "exec") return Response.json({ section: withVisuals(await genExec(body)), meta });
      if (regenKey === "recommendations") return Response.json({ section: withVisuals(await genRecs(body)), meta });
      return Response.json({ error: "Unknown section: " + regenKey }, { status: 400 });
    }
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
