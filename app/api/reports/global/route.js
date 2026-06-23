import { createClient } from "@supabase/supabase-js";
import { loadFramework } from "@/lib/framework-loader";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Global Creative Inspiration (Core 3). Answers "best / most distinctive global cases as
// inspiration for ours". Scope: the GLOBAL BENCHMARK pool (scope="global"), not local competitors.
// Quality family: rating / distinctiveness is the primary selector (the analyst's curation matters most).
const cdOf = (e) => { try { return typeof e.custom_dimensions === "string" ? JSON.parse(e.custom_dimensions) : (e.custom_dimensions || {}); } catch { return {}; } };
const clean = (s) => String(s || "").replace(/[\uD800-\uDFFF]/g, "").replace(/\s+/g, " ").trim();

async function claude(apiKey, prompt, maxTokens = 1800) {
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
  brand: "Frame for the CLIENT BRAND: which plays to steal and adapt, and where they fit the brand's territory.",
  agency: "Frame for an AGENCY: the inspiration worth presenting to a client and the creative ambition it unlocks.",
  vc: "Frame through a VC / startup lens: the distinctive, efficient creative moves a challenger could run.",
};

export async function POST(request) {
  const { project_id, brand = "", icp = "brand", sections: cfgIn, section: regenKey, priorSections, filters: filtersIn, customInstructions = "", findings } = await request.json();
  const findingsBlock = (Array.isArray(findings) && findings.length)
    ? `\n\nANALYST FINDINGS — the analyst's saved conclusions. Treat as PRIORITY signals: weave them in where relevant and honor them in the transferable plays.\n${findings.map((f) => `- ${f.title || f.summary || "Finding"}${f.stat ? ` (${f.stat})` : ""}${f.summary && f.title ? `: ${f.summary}` : ""}`).join("\n")}`
    : "";
  if (!project_id) return Response.json({ error: "project_id required" }, { status: 400 });
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const sUrl = process.env.NEXT_PUBLIC_SUPABASE_URL, sKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!apiKey || !sUrl || !sKey) return Response.json({ error: "Server not configured" }, { status: 500 });

  const admin = createClient(sUrl, sKey, { auth: { persistSession: false } });
  const { data: rows } = await admin.from("creative_source")
    .select("id,competitor,brand,brand_name,scope,communication_intent,channel,year,rating,primary_territory,brand_archetype,tone_of_voice,execution_style,main_slogan,synopsis,description,analyst_comment,custom_dimensions")
    .eq("project_id", project_id).eq("scope", "global");
  if (!rows || rows.length === 0) return Response.json({ error: "No global benchmark entries found. Capture global cases (scope = global) first." }, { status: 404 });

  let framework = null; try { framework = await loadFramework(project_id); } catch {}
  const lang = framework?.language || "English";
  const category = framework?.industry || "the category";
  const client = framework?.brandName || "the client";
  const refYear = new Date().getFullYear();

  const pieces = rows.map((e) => {
    const cd = cdOf(e), s = cd._social || {};
    return {
      id: e.id, brand: e.competitor || e.brand || e.brand_name || "—",
      rating: Number(e.rating) || 0, territory: e.primary_territory || "", archetype: e.brand_archetype || "",
      tone: e.tone_of_voice || "", execution: e.execution_style || s.format || "", intent: e.communication_intent || "",
      channel: s.platform || e.channel || "", year: e.year,
      slogan: clean(e.main_slogan), comment: clean(e.analyst_comment).slice(0, 200),
      text: clean(e.synopsis || e.description).slice(0, 200),
    };
  });

  const brands = [...new Set(pieces.map((p) => p.brand))].filter((b) => b && b !== "—");
  const subject = brand || ""; // optional single-source focus

  // GLOBAL filters
  const fl = filtersIn || {};
  const minRating = Number(fl.minRating) || 0;
  const passFilter = (p) => {
    if (subject && p.brand !== subject) return false;
    if (Array.isArray(fl.brands) && fl.brands.length && !fl.brands.includes(p.brand)) return false;
    if (Array.isArray(fl.territories) && fl.territories.length && !(p.territory || "").split(",").map((s) => s.trim()).some((t) => fl.territories.includes(t))) return false;
    if (Array.isArray(fl.archetypes) && fl.archetypes.length && !fl.archetypes.includes(p.archetype)) return false;
    if (fl.yearFrom && p.year && Number(p.year) < Number(fl.yearFrom)) return false;
    if (fl.yearTo && p.year && Number(p.year) > Number(fl.yearTo)) return false;
    if (minRating && p.rating < minRating) return false;
    return true;
  };
  const pool = pieces.filter(passFilter);

  // Quality selection: rating first, then recency. If few are rated, fall back to the whole pool.
  const byQuality = (arr) => arr.slice().sort((a, b) => (b.rating - a.rating) || ((b.year || 0) - (a.year || 0)));
  const rated = pool.filter((p) => p.rating >= 4);
  const casePool = rated.length >= 4 ? rated : byQuality(pool);

  const tally = (arr, key) => { const t = {}; arr.forEach((p) => { const v = p[key]; if (v) v.split(",").map((x) => x.trim()).filter(Boolean).forEach((x) => (t[x] = (t[x] || 0) + 1)); }); return Object.entries(t).sort((a, b) => b[1] - a[1]); };
  const territoryTally = tally(pool, "territory").slice(0, 10).map(([k, n]) => `${k}: ${n}`);
  const executionTally = tally(pool, "execution").slice(0, 10).map(([k, n]) => `${k}: ${n}`);
  const archetypeTally = tally(pool, "archetype").slice(0, 8).map(([k, n]) => `${k}: ${n}`);
  const ratingHist = [5, 4, 3, 2, 1].map((r) => `${r}★ ${pool.filter((p) => p.rating === r).length}`).join(" · ");
  const years = [...new Set(pool.map((p) => p.year).filter(Boolean))].sort();
  const yearRange = years.length ? `${years[0]}–${years[years.length - 1]}` : "n/a";

  const ctx = (list) => list.map((p) => `- [#${p.id}] [${p.brand}] (${p.rating ? p.rating + "★ · " : ""}${p.territory || "?"} · ${p.execution || p.channel || "?"}${p.year ? " · " + p.year : ""}): ${p.text}${p.comment ? ` — analyst: ${p.comment}` : ""}`).join("\n");
  const statHeader = `Global benchmark set for ${client} (${category}). ${pool.length} cases, ${brands.length} brands, ${yearRange}. Rating spread: ${ratingHist}.`;

  const rules = `This is a finished, client-facing inspiration deliverable. Do NOT mention ratings as a formula, weights, evidence counts, or your methodology — write the polished section only.
- When you ENUMERATE (cases, patterns, plays), use Markdown bullets or numbered lists.
- For EVERY case you discuss, link it inline as [a short evocative name](cite:ID) using the #ID shown. The reader clicks to see the creative. Cite real cases only — never invent.
- Lead with what is DISTINCTIVE and TRANSFERABLE, not a plot summary.
- Use ONLY the cases provided; never invent brands, cases or numbers.
No emojis. Write in ${lang}. Markdown with a short ## header.`;

  const SECTIONS = {
    rationale: { title: "Curation rationale", build: () => `THE GLOBAL SET:\n- ${pool.length} cases across ${brands.length} brands (${brands.join(", ")})\n- Years: ${yearRange}\n- Top territories: ${territoryTally.join(" · ")}\n- Execution styles: ${executionTally.join(" · ")}\n\nTOP CASES (by craft/distinctiveness):\n${ctx(byQuality(casePool).slice(0, 12))}`,
      task: `Set up the selection: what this global set covers, and the LOGIC of the curation — what makes a case worth including (distinctiveness, craft, strategic clarity, resonance). 2 short paragraphs. Name a few of the standout brands/cases to come.` },
    cases: { title: "The cases", build: () => `STANDOUT CASES:\n${ctx(byQuality(casePool).slice(0, 18))}`,
      task: `The heart of the report — a curated gallery. For each standout case (aim for 8–12, the strongest first): (a) what it is in one line, (b) WHY IT WORKS — the creative/strategic move that makes it land, (c) the TRANSFERABLE IDEA for ${client}. Use a clear sub-bullet structure per case and cite each case.` },
    patterns: { title: "Patterns", build: () => `ACROSS THE SET:\n- Territories: ${territoryTally.join(" · ")}\n- Execution styles: ${executionTally.join(" · ")}\n- Archetypes: ${archetypeTally.join(" · ")}\n\nEVIDENCE (top cases):\n${ctx(byQuality(casePool).slice(0, 16))}`,
      task: `Step back: what RECURS across the best cases? Name the patterns — shared territories, execution devices, archetypes, structural moves — and what they signal about where the category's creative frontier is. Bullets, each grounded in cited cases.` },
  };
  const SYNTH = { plays: "Transferable plays" };
  const DEFAULT_ORDER = ["rationale", "cases", "patterns", "plays"];
  const cfg = (Array.isArray(cfgIn) && cfgIn.length ? cfgIn : DEFAULT_ORDER.map((key) => ({ key, on: true, prompt: "" })))
    .filter((s) => s && s.on !== false && (SECTIONS[s.key] || SYNTH[s.key]));
  const cfgMap = Object.fromEntries(cfg.map((s) => [s.key, s]));
  const lensInstr = ICP_LENS[icp] || ICP_LENS.brand;
  const ci = (customInstructions || "").trim();
  const dirOf = (key) => [(cfgMap[key]?.prompt || "").trim(), ci].filter(Boolean).join(" · ");

  const genSection = async (key) => {
    const sd = SECTIONS[key]; const dir = dirOf(key);
    const prompt = `You are a senior creative strategist writing the "${sd.title}" section of a Global Creative Inspiration report.\n${statHeader}\n\nTASK: ${sd.task}${dir ? `\nADDITIONAL ANALYST DIRECTION — weave this in: ${dir}` : ""}\n${rules}${findingsBlock}\n\n${sd.build()}`.slice(0, 12000);
    return { key, title: sd.title, markdown: await claude(apiKey, prompt, 2000) };
  };
  const genPlays = async (body) => {
    const dir = dirOf("plays");
    return { key: "plays", title: "Transferable plays", markdown: await claude(apiKey, `Write TRANSFERABLE PLAYS for ${client} in ${category}: 4-6 concrete, named creative plays it could run, each grounded in the cases below (reference the inspiration). ${lensInstr}${dir ? ` Analyst direction: ${dir}.` : ""}${findingsBlock} Do NOT mention methodology. No emojis. Write in ${lang}. Markdown numbered list.\n\nSECTIONS:\n${body}`, 1200) };
  };
  const meta = { icp, brands: brands.length, cases: pool.length, rated: rated.length, yearRange, subject: subject || null };

  try {
    if (regenKey) {
      if (SECTIONS[regenKey]) return Response.json({ section: await genSection(regenKey), meta });
      if (regenKey === "plays") {
        const body = (Array.isArray(priorSections) ? priorSections : []).filter((s) => s && SECTIONS[s.key]).map((s) => `### ${s.title}\n${s.markdown}`).join("\n\n").slice(0, 9000);
        return Response.json({ section: await genPlays(body), meta });
      }
      return Response.json({ error: "Unknown section: " + regenKey }, { status: 400 });
    }

    const analyticalKeys = cfg.map((s) => s.key).filter((k) => SECTIONS[k]);
    const analytical = await Promise.all(analyticalKeys.map(genSection));
    let plays = null;
    if (cfgMap.plays) {
      const body = analytical.map((s) => `### ${s.title}\n${s.markdown}`).join("\n\n").slice(0, 9000);
      plays = await genPlays(body);
    }
    const byKey = Object.fromEntries(analytical.map((a) => [a.key, a]));
    if (plays) byKey.plays = plays;
    const sections = cfg.map((s) => byKey[s.key]).filter(Boolean);
    return Response.json({ sections, meta });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
