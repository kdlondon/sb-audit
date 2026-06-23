import { createClient } from "@supabase/supabase-js";
import { loadFramework } from "@/lib/framework-loader";
import { pieceWeight } from "@/lib/weights";

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
  const { project_id, scope = "category", brand = "", icp = "brand" } = await request.json();
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
  const head = `Category: ${category}. Brands in study: ${brands.join(", ")}. Scope: ${scope === "brand" ? `single brand — ${subject}` : "whole category"}.`;
  const rules = `Use the weighted EVIDENCE (higher wN = stronger brand signal — weight it accordingly; never treat high-volume tactical posts as strategic). CRITICAL: this is a finished, client-facing deliverable — do NOT mention weights, "wN" values, evidence counts, "brand_dna", or your methodology/how-you-analyzed. Write the polished section only. Cite brands by name. No fabrication beyond the evidence.
- When you ENUMERATE elements (axes, territories, opportunities, brands, examples), use a Markdown bullet or numbered list — never a long comma-separated sentence.
- BACK CLAIMS WITH EXAMPLES: when you reference a specific captured piece, link it inline as [a short descriptive name](cite:ID) using the #ID shown for that piece in the evidence. Cite real examples liberally. Do NOT cite the web profile entries (those have no #ID).
No emojis. Write in ${lang}. Markdown with a short ## header.`;

  const sectionDefs = [
    { key: "landscape", title: "Category landscape", pool: allPieces, task: `Map how the category communicates: the territories occupied and who owns what. 2-3 tight paragraphs + a short bullet list of territory ownership.` },
    { key: "positioning", title: "Positioning x-ray", pool: subjPool(allPieces), task: `Contrast EXPRESSED (what the brand says — Brand DNA / web, the brand_dna evidence) vs VALIDATED (what its content actually does) ${scope === "brand" ? `for ${subject}` : "for each main brand"}. Surface the gap between the two — that gap is the key insight.` },
    { key: "hero", title: "Hero & message consistency", pool: subjPool(allPieces), task: `Assess whether the hero/brand message is stable over time and coherent across channels (only hero-level signals are included here). Flag drift or inconsistency vs the declared positioning.` },
    { key: "whitespace", title: "White space & opportunity", pool: allPieces, task: `Identify territories and angles nobody clearly owns, then name 3-5 concrete opportunity territories for ${client}.` },
  ];

  try {
    const analytical = await Promise.all(sectionDefs.map(async (sd) => {
      const sel = topFor(sd.key, sd.pool);
      const prompt = `You are a senior brand strategist writing the "${sd.title}" section of a Strategic Positioning Report.\n${head}\n\nTASK: ${sd.task}\n${rules}\n\nEVIDENCE (re-weighted for this section):\n${ctx(sel).slice(0, 7000)}`;
      return { key: sd.key, title: sd.title, markdown: await claude(apiKey, prompt, 2000) };
    }));

    const body = analytical.map((s) => `### ${s.title}\n${s.markdown}`).join("\n\n").slice(0, 9000);
    const lens = ICP_LENS[icp] || ICP_LENS.brand;
    const [exec, recs] = await Promise.all([
      claude(apiKey, `Write the EXECUTIVE READ (the strategic headline) of this Strategic Positioning Report for ${client} in ${category}. 3-4 sentences synthesizing the sections below: where the category is saturated, where it is open, and the single biggest strategic move. ${lens} Do NOT mention methodology or how you analyzed — finished client-facing prose only. No emojis. Write in ${lang}. Markdown.\n\nSECTIONS:\n${body}`, 700),
      claude(apiKey, `Write STRATEGIC RECOMMENDATIONS for ${client}: 4-6 prioritized, concrete, one-sentence actions grounded in the sections below. ${lens} Do NOT mention methodology. No emojis. Write in ${lang}. Markdown numbered list.\n\nSECTIONS:\n${body}`, 1100),
    ]);

    const sections = [
      { key: "exec", title: "Executive read", markdown: exec },
      ...analytical,
      { key: "recommendations", title: "Strategic recommendations", markdown: recs },
    ];
    return Response.json({ sections, meta: { scope, subject: scope === "brand" ? subject : null, icp, brands: brands.length, pieces: pieces.length, brandDna: dnaPieces.length } });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
