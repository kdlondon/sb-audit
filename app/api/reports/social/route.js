import { createClient } from "@supabase/supabase-js";
import { loadFramework } from "@/lib/framework-loader";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 7 sections in 2 passes; give Vercel headroom

// Social Content Benchmark (Core 2). Answers "how are competitors using social & what works?".
// Performance family: engagement is the primary driver (does NOT down-weight tactical). Sections
// are fed precomputed STATS (pillar landscape, engagement, cadence) + a cited evidence sample.
const cdOf = (e) => { try { return typeof e.custom_dimensions === "string" ? JSON.parse(e.custom_dimensions) : (e.custom_dimensions || {}); } catch { return {}; } };
const clean = (s) => String(s || "").replace(/[\uD800-\uDFFF]/g, "").replace(/\s+/g, " ").trim();
const num = (v) => Number(v) || 0;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

async function claude(apiKey, prompt, maxTokens = 1600) {
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
  brand: "Frame for the CLIENT BRAND: which territories to own on social, what to fix, where to invest.",
  agency: "Frame for an AGENCY: the social territory worth selling and the diagnostic that justifies a content engagement.",
  vc: "Frame through a VC / startup lens: is the social presence distinct and efficient vs the category, and where is the wedge.",
};

export async function POST(request) {
  const { project_id, scope = "category", brand = "", icp = "brand", sections: cfgIn, section: regenKey, priorSections, filters: filtersIn, customInstructions = "", findings } = await request.json();
  const findingsBlock = (Array.isArray(findings) && findings.length)
    ? `\n\nANALYST FINDINGS — the analyst's saved conclusions. Treat as PRIORITY signals: weave them into the relevant sections and honor them in the takeaways.\n${findings.map((f) => `- ${f.title || f.summary || "Finding"}${f.stat ? ` (${f.stat})` : ""}${f.summary && f.title ? `: ${f.summary}` : ""}`).join("\n")}`
    : "";
  if (!project_id) return Response.json({ error: "project_id required" }, { status: 400 });
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const sUrl = process.env.NEXT_PUBLIC_SUPABASE_URL, sKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!apiKey || !sUrl || !sKey) return Response.json({ error: "Server not configured" }, { status: 500 });

  const admin = createClient(sUrl, sKey, { auth: { persistSession: false } });
  const { data: rows } = await admin.from("creative_source")
    .select("id,competitor,brand,brand_name,communication_intent,channel,year,rating,primary_territory,brand_archetype,tone_of_voice,main_slogan,synopsis,description,custom_dimensions")
    .eq("project_id", project_id);
  if (!rows || rows.length === 0) return Response.json({ error: "No entries found for this project" }, { status: 404 });

  let framework = null; try { framework = await loadFramework(project_id); } catch {}
  const lang = framework?.language || "English";
  const category = framework?.industry || "the category";
  const refYear = new Date().getFullYear();

  // Build social pieces
  const pieces = rows.map((e) => {
    const cd = cdOf(e), s = cd._social || {}, m = cd._meta || {};
    const posted = m.posted_at || "";
    const y = e.year || (posted ? Number(String(posted).slice(0, 4)) : null);
    let weekday = null, ym = null;
    if (posted) { const d = new Date(posted); if (!isNaN(d)) { weekday = WEEKDAYS[d.getDay()]; ym = posted.slice(0, 7); } }
    return {
      id: e.id, brand: e.competitor || e.brand || e.brand_name || "—",
      pillar: s.content_pillar || "Unclassified", platform: s.platform || e.channel || "",
      format: s.format || "", intent: e.communication_intent || "",
      territory: e.primary_territory || "", archetype: e.brand_archetype || "", tone: e.tone_of_voice || "",
      slogan: clean(e.main_slogan), rating: e.rating, year: y, weekday, ym, posted,
      likes: num(m.likes), comments: num(m.comments), eng: num(m.likes) + 3 * num(m.comments),
      text: clean(m.caption || e.synopsis || e.description).slice(0, 180),
    };
  });

  const brands = [...new Set(pieces.map((p) => p.brand))].filter((b) => b && b !== "—");
  const subject = brand || brands[0] || "the subject brand";
  const client = framework?.brandName || (scope === "brand" ? subject : "the client");

  // Brand DNA (declared / "expressed" source)
  const { data: dnaRows } = await admin.from("brand_dna").select("brand,profile,created_at").eq("project_id", project_id).order("created_at", { ascending: false });
  const dnaByBrand = {}; (dnaRows || []).forEach((r) => { if (!dnaByBrand[r.brand]) dnaByBrand[r.brand] = r.profile; });
  const dnaText = (b) => { const p = dnaByBrand[b]; if (!p) return ""; return clean(`Claim: ${p?.claim?.hero || p?.claim || ""} · Positioning: ${p?.positioning || ""} · Voice: ${(p?.voice?.tone || p?.tone_of_voice || "")} · Archetype: ${p?.archetype || ""}`).slice(0, 240); };

  // GLOBAL filters
  const fl = filtersIn || {};
  const passFilter = (p) => {
    if (Array.isArray(fl.brands) && fl.brands.length && !fl.brands.includes(p.brand)) return false;
    if (Array.isArray(fl.pillars) && fl.pillars.length && !fl.pillars.includes(p.pillar)) return false;
    if (Array.isArray(fl.platforms) && fl.platforms.length && !fl.platforms.includes(p.platform)) return false;
    if (fl.yearFrom && p.year && Number(p.year) < Number(fl.yearFrom)) return false;
    if (fl.yearTo && p.year && Number(p.year) > Number(fl.yearTo)) return false;
    return true;
  };
  const pool = pieces.filter(passFilter);
  const subjOf = (arr) => scope === "brand" ? arr.filter((p) => p.brand === subject) : arr;

  // ── Precomputed STATS ──────────────────────────────────────────────────────
  const round = (n) => Math.round(n);
  const topByEng = (arr, n) => arr.slice().sort((a, b) => b.eng - a.eng).slice(0, n);
  const sampleByPillar = (arr, perPillar, cap) => {
    const byP = {}; arr.forEach((p) => (byP[p.pillar] ||= []).push(p));
    const out = []; Object.values(byP).forEach((ps) => topByEng(ps, perPillar).forEach((p) => out.push(p)));
    return topByEng(out, cap);
  };
  const tally = (arr, key) => { const t = {}; arr.forEach((p) => { const v = p[key]; if (v) v.split(",").map((x) => x.trim()).filter(Boolean).forEach((x) => (t[x] = (t[x] || 0) + 1)); }); return Object.entries(t).sort((a, b) => b[1] - a[1]); };

  const pillarStats = {}; pool.forEach((p) => { const v = (pillarStats[p.pillar] ||= { posts: 0, brands: new Set(), eng: 0 }); v.posts++; v.brands.add(p.brand); v.eng += p.eng; });
  const pillarLandscape = Object.entries(pillarStats).map(([pillar, v]) => ({ pillar, posts: v.posts, brands: v.brands.size, avgEng: round(v.eng / v.posts) })).sort((a, b) => b.posts - a.posts);

  const perBrand = brands.map((b) => {
    const bi = pool.filter((p) => p.brand === b); if (!bi.length) return null;
    const pc = {}; bi.forEach((p) => (pc[p.pillar] = (pc[p.pillar] || 0) + 1));
    const topPillars = Object.entries(pc).sort((a, b2) => b2[1] - a[1]).slice(0, 3).map(([k]) => k);
    const wk = {}; bi.forEach((p) => { if (p.weekday) wk[p.weekday] = (wk[p.weekday] || 0) + 1; });
    const topDay = Object.entries(wk).sort((a, b2) => b2[1] - a[1])[0]?.[0] || "—";
    const fmt = tally(bi, "format").slice(0, 3).map(([k, n]) => `${k} ${n}`);
    const plt = tally(bi, "platform").slice(0, 3).map(([k, n]) => `${k} ${n}`);
    return { brand: b, posts: bi.length, avgEng: round(bi.reduce((s, p) => s + p.eng, 0) / bi.length), topPillars, topDay, fmt, plt, tone: tally(bi, "tone").slice(0, 2).map(([k]) => k), arch: tally(bi, "archetype").slice(0, 1).map(([k]) => k)[0] || "—" };
  }).filter(Boolean);

  const formatMix = tally(pool, "format").map(([k, n]) => `${k}: ${n}`);
  const platformMix = tally(pool, "platform").map(([k, n]) => `${k}: ${n}`);
  const months = [...new Set(pool.map((p) => p.ym).filter(Boolean))].sort();
  const dateRange = months.length ? `${months[0]} → ${months[months.length - 1]}` : "n/a";

  const statBrands = perBrand.map((b) => `- ${b.brand}: ${b.posts} posts · avg eng ${b.avgEng} · pillars [${b.topPillars.join(", ")}] · busiest ${b.topDay} · formats [${b.fmt.join(", ")}] · platforms [${b.plt.join(", ")}] · tone [${b.tone.join("/")}] · archetype ${b.arch}`).join("\n");
  const statPillars = pillarLandscape.map((p) => `- ${p.pillar}: ${p.posts} posts, ${p.brands}/${brands.length} brands, avg eng ${p.avgEng}`).join("\n");
  const statHeader = `Category: ${category}. Brands: ${brands.join(", ")}. ${pool.length} social posts, ${dateRange}. Scope: ${scope === "brand" ? `single brand — ${subject}` : "whole category"}.`;

  const ctx = (list) => list.map((p) => `- [#${p.id}] [${p.brand}] (${p.pillar} · ${p.platform || "?"} · ${p.format || "?"}) eng ${p.likes}L/${p.comments}C${p.year ? " · " + p.year : ""}: ${p.text}`).join("\n");

  const rules = `This is a finished, client-facing deliverable. Do NOT mention engagement formulas, weights, "eng", evidence counts, "brand_dna", or your methodology. Write the polished section only.
- When you ENUMERATE (territories, angles, brands, formats), use a Markdown bullet or numbered list — never a long comma-separated sentence.
- BACK CLAIMS WITH EXAMPLES: when you reference a specific post, link it inline as [a short descriptive name](cite:ID) using the #ID shown for that post. Cite real posts liberally. Do NOT cite declared-positioning lines (those have no #ID).
- Use ONLY the STATS and EVIDENCE provided; never invent numbers, brands or posts.
No emojis. Write in ${lang}. Markdown with a short ## header.`;

  // ── Section definitions ────────────────────────────────────────────────────
  const SECTIONS = {
    snapshot: { title: "Snapshot", build: () => `STATS — per brand:\n${statBrands}\n\nCONTENT PILLARS:\n${statPillars}\n\nPLATFORM MIX: ${platformMix.join(" · ")}\nFORMAT MIX: ${formatMix.join(" · ")}`,
      task: `Open with a tight snapshot of the competitive social set: how many brands and posts, the time window, who posts most and who earns most engagement, and the dominant content pillars and platforms. 2 short paragraphs + a compact bullet list of the key numbers.` },
    territories: { title: "Territories & angles", build: () => `CONTENT PILLARS (territories):\n${statPillars}\n\nEVIDENCE (sample across territories):\n${ctx(sampleByPillar(pool, 3, 28))}`,
      task: `This is the CORE of the report. Map the content TERRITORIES (pillars) the category competes in, then go a level deeper: within each shared territory, what ANGLE / subtheme does each brand take? Identify (a) crowded territories, (b) territories where ${client} has a default or ownable role, and (c) the concrete RE-ANGLE / reframe opportunity for ${client}. Use bullets per territory and cite real posts.` },
    voice: { title: "Personality & voice", build: () => `VOICE & ARCHETYPE per brand:\n${perBrand.map((b) => `- ${b.brand}: tone [${b.tone.join("/") || "—"}], archetype ${b.arch}`).join("\n")}\n\nEVIDENCE (sample captions):\n${ctx(topByEng(pool, 24))}`,
      task: `Compare the PERSONALITY & VOICE of each brand as expressed in its social content: tone of voice and archetype, and how it actually reads in captions. Contrast the brands — who is warm/playful/institutional/aspirational. A short paragraph per brand or a tight comparison. Cite example posts.` },
    declared_deployed: { title: "Declared vs deployed", build: () => {
        const bs = scope === "brand" ? [subject] : brands;
        const declared = bs.map((b) => `- ${b} (declared): ${dnaText(b) || "no declared profile on file"}`).join("\n");
        const deployed = ctx(subjOf(topByEng(pool, 40)).slice(0, 24));
        return `DECLARED positioning (web / brand profile):\n${declared}\n\nDEPLOYED on social (sample):\n${deployed}`;
      },
      task: `Compare DECLARED positioning (the brand's web / brand profile — claim, positioning, voice) against what it actually DEPLOYS on social. Surface consistency and gaps — social-scoped only (not a full multichannel audit). Name the gap where it exists. ${scope === "brand" ? `Focus on ${subject}.` : "Cover each main brand briefly."}` },
    working: { title: "What's working", build: () => `ENGAGEMENT by pillar:\n${pillarLandscape.map((p) => `- ${p.pillar}: avg eng ${p.avgEng} (${p.posts} posts)`).join("\n")}\n\nTOP POSTS by engagement:\n${ctx(topByEng(pool, 20))}`,
      task: `Analyse WHAT'S WORKING: which pillars, formats and specific posts earn the most engagement, and the patterns behind them (hook, format, timing, subject). Cite the standout posts. Do not present raw metrics as strategy — explain the WHY.` },
    cadence: { title: "Cadence, format & platform", build: () => `POSTING per brand (cadence/format/platform):\n${perBrand.map((b) => `- ${b.brand}: ${b.posts} posts · busiest ${b.topDay} · formats [${b.fmt.join(", ")}] · platforms [${b.plt.join(", ")}]`).join("\n")}\n\nCATEGORY FORMAT MIX: ${formatMix.join(" · ")}\nCATEGORY PLATFORM MIX: ${platformMix.join(" · ")}\nACTIVE WINDOW: ${dateRange}`,
      task: `Describe the operational rhythm: posting CADENCE (frequency, busiest days), FORMAT mix (reel/carousel/static/video/story) and PLATFORM mix per brand. Where is the category over- or under-investing? Short bullets + one paragraph of read.` },
  };
  const SYNTH = { takeaways: "Takeaways" };
  const titleOf = (k) => SECTIONS[k]?.title || SYNTH[k] || k;

  const DEFAULT_ORDER = ["snapshot", "territories", "voice", "declared_deployed", "working", "cadence", "takeaways"];
  const cfg = (Array.isArray(cfgIn) && cfgIn.length ? cfgIn : DEFAULT_ORDER.map((key) => ({ key, on: true, prompt: "" })))
    .filter((s) => s && s.on !== false && (SECTIONS[s.key] || SYNTH[s.key]));
  const cfgMap = Object.fromEntries(cfg.map((s) => [s.key, s]));
  const lensInstr = ICP_LENS[icp] || ICP_LENS.brand;
  const ci = (customInstructions || "").trim();
  const dirOf = (key) => [(cfgMap[key]?.prompt || "").trim(), ci].filter(Boolean).join(" · ");

  const genSection = async (key) => {
    const sd = SECTIONS[key]; const dir = dirOf(key);
    const prompt = `You are a senior social strategist writing the "${sd.title}" section of a Social Content Benchmark.\n${statHeader}\n\nTASK: ${sd.task}${dir ? `\nADDITIONAL ANALYST DIRECTION — weave this in: ${dir}` : ""}\n${rules}${findingsBlock}\n\n${sd.build()}`.slice(0, 12000);
    return { key, title: sd.title, markdown: await claude(apiKey, prompt, 1800) };
  };
  const genTakeaways = async (body) => {
    const dir = dirOf("takeaways");
    return { key: "takeaways", title: "Takeaways", markdown: await claude(apiKey, `Write the TAKEAWAYS of this Social Content Benchmark for ${client} in ${category}: 4-6 prioritized, concrete social recommendations grounded in the sections below. ${lensInstr}${dir ? ` Analyst direction: ${dir}.` : ""}${findingsBlock} Do NOT mention methodology. No emojis. Write in ${lang}. Markdown numbered list.\n\nSECTIONS:\n${body}`, 1100) };
  };
  const meta = { scope, subject: scope === "brand" ? subject : null, icp, brands: brands.length, posts: pool.length, pillars: pillarLandscape.length, dateRange };

  try {
    // SINGLE-SECTION regeneration
    if (regenKey) {
      if (SECTIONS[regenKey]) return Response.json({ section: await genSection(regenKey), meta });
      if (regenKey === "takeaways") {
        const body = (Array.isArray(priorSections) ? priorSections : []).filter((s) => s && SECTIONS[s.key]).map((s) => `### ${s.title}\n${s.markdown}`).join("\n\n").slice(0, 9000);
        return Response.json({ section: await genTakeaways(body), meta });
      }
      return Response.json({ error: "Unknown section: " + regenKey }, { status: 400 });
    }

    // FULL report
    const analyticalKeys = cfg.map((s) => s.key).filter((k) => SECTIONS[k]);
    const analytical = await Promise.all(analyticalKeys.map(genSection));
    let takeaways = null;
    if (cfgMap.takeaways) {
      const body = analytical.map((s) => `### ${s.title}\n${s.markdown}`).join("\n\n").slice(0, 9000);
      takeaways = await genTakeaways(body);
    }
    const byKey = Object.fromEntries(analytical.map((a) => [a.key, a]));
    if (takeaways) byKey.takeaways = takeaways;
    const sections = cfg.map((s) => byKey[s.key]).filter(Boolean);
    return Response.json({ sections, meta });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
