import { createClient } from "@supabase/supabase-js";
import { loadFramework } from "@/lib/framework-loader";
import { avgEngagementRate, fmtRate } from "@/lib/engagement";

export const maxDuration = 60;

// Generate Social Media Benchmark insights for a project: aggregate the analyzed social
// entries into a compact competitive summary, then ask Claude for conclusive, comparative,
// actionable insights (white space, differential opportunity, timing, engagement, creative).
const cdOf = (e) => { try { return typeof e.custom_dimensions === "string" ? JSON.parse(e.custom_dimensions) : (e.custom_dimensions || {}); } catch { return {}; } };
const num = (v) => (typeof v === "number" ? v : Number(v) || 0);
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export async function POST(request) {
  const { project_id, dimension } = await request.json();
  if (!project_id) return Response.json({ error: "project_id required" }, { status: 400 });
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const sUrl = process.env.NEXT_PUBLIC_SUPABASE_URL, sKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!apiKey || !sUrl || !sKey) return Response.json({ error: "Server not configured" }, { status: 500 });

  const admin = createClient(sUrl, sKey, { auth: { persistSession: false } });
  const { data: rows } = await admin.from("creative_source").select("competitor,brand,brand_name,communication_intent,tone_of_voice,execution_style,primary_territory,custom_dimensions").eq("project_id", project_id).eq("type", "Social post");
  if (!rows || rows.length === 0) return Response.json({ error: "No social posts found" }, { status: 404 });

  let framework = null; try { framework = await loadFramework(project_id); } catch {}
  const client = framework?.brandName || "the client brand";
  const category = framework?.industry || "the category";
  const lang = framework?.language || "English";

  // Aggregate
  const all = rows.map((e) => {
    const cd = cdOf(e), s = cd._social || {}, m = cd._meta || {};
    return {
      brand: e.competitor || e.brand || e.brand_name || "—",
      pillar: s.content_pillar || "Unclassified",
      format: s.format || "—",
      hero: /hero/i.test(e.communication_intent || ""),
      tone: e.tone_of_voice || "", exec: e.execution_style || "",
      likes: num(m.likes), comments: num(m.comments), views: num(m.views), followers: num(m.followers),
      posted: m.posted_at || "",
    };
  });
  // Keep only real competitors (drop one-off noise handles: tagged accounts, commenters)
  const bc = {}; all.forEach((i) => (bc[i.brand] = (bc[i.brand] || 0) + 1));
  const items = all.filter((i) => bc[i.brand] >= 5);
  const brands = [...new Set(items.map((i) => i.brand))];
  const pillarStats = {};
  items.forEach((i) => { const p = (pillarStats[i.pillar] ||= { posts: [], brands: new Set() }); p.posts.push(i); p.brands.add(i.brand); });
  const pillarLandscape = Object.entries(pillarStats).map(([pillar, v]) => ({ pillar, posts: v.posts.length, brands: v.brands.size, avgRate: avgEngagementRate(v.posts) })).sort((a, b) => b.posts - a.posts);

  const perBrand = brands.map((b) => {
    const bi = items.filter((i) => i.brand === b);
    const pc = {}; bi.forEach((i) => (pc[i.pillar] = (pc[i.pillar] || 0) + 1));
    const top = Object.entries(pc).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([p, n]) => `${p} ${Math.round(100 * n / bi.length)}%`);
    const dayc = [0, 0, 0, 0, 0, 0, 0]; bi.forEach((i) => { if (i.posted) { const d = new Date(i.posted).getDay(); if (!isNaN(d)) dayc[d]++; } });
    const topDay = DOW[dayc.indexOf(Math.max(...dayc))];
    return { brand: b, posts: bi.length, heroPct: Math.round(100 * bi.filter((i) => i.hero).length / bi.length), engRate: avgEngagementRate(bi), topPillars: top, topDay };
  });

  const summary = `CLIENT (own brand, NOT in the data below — frame opportunities FOR them): ${client}
CATEGORY: ${category} · ${items.length} competitor posts across ${brands.length} brands.
Engagement is the ENGAGEMENT RATE (interactions ÷ followers, %) — comparable across brands of any size; "—" means no follower data.

PILLAR LANDSCAPE (how crowded each content territory is + avg engagement rate):
${pillarLandscape.map((p) => `- ${p.pillar}: ${p.posts} posts, ${p.brands}/${brands.length} brands, avg eng ${fmtRate(p.avgRate)}`).join("\n")}

PER COMPETITOR:
${perBrand.map((b) => `- ${b.brand}: ${b.posts} posts | top pillars: ${b.topPillars.join(", ")} | Hero ${b.heroPct}% | avg eng ${fmtRate(b.engRate)} | busiest day ${b.topDay}`).join("\n")}`;

  const DIMS = {
    white_space: "white space — content territories nobody or few brands own (opportunity)",
    differential: "differential opportunity — how the client could stand apart",
    engagement: "what drives engagement",
    timing: "timing & cadence — best days/times, frequency",
    creative: "differential creative approaches",
    strategic: "cross-cutting strategic reads",
  };
  const focus = dimension && DIMS[dimension]
    ? `ALL 8 insights MUST be of type "${dimension}" — go deep on ${DIMS[dimension]}, each a distinct angle within it.`
    : `Spread across these types (roughly balanced): ${Object.keys(DIMS).join(", ")}.`;

  const prompt = `You are a senior brand strategist producing a Social Media Benchmark for ${client} in ${category}.
Write 8 punchy, CONCLUSIVE insights from the competitive data below. Each must be a conclusion (not a data dump), comparative, and actionable — frame opportunities FOR ${client}, referencing real brands/numbers.
${focus}

Return ONLY a raw JSON array (no markdown) of 8 objects:
{"type":"white_space|differential|engagement|timing|creative|strategic","headline":"punchy 5-9 words, NO emojis","stat":"the single most striking number, short (e.g. '0/5','x31','11.5K')","stat_label":"what the number measures, 2-4 words","body":"2-3 sentences, the 'so what'","evidence":"one supporting data point","pillar":"the most relevant content pillar name EXACTLY as written in the PILLAR LANDSCAPE list, or empty string"}

No emojis anywhere. Write everything in ${lang}.

DATA:
${summary}`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 3500, messages: [{ role: "user", content: prompt.replace(/[\uD800-\uDFFF]/g, "") }] }),
    });
    const data = await res.json();
    if (data.error) return Response.json({ error: data.error.message }, { status: 500 });
    const text = data.content?.map((c) => c.text || "").join("") || "[]";
    let insights = [];
    try { insights = JSON.parse(text.match(/\[[\s\S]*\]/)?.[0] || "[]"); } catch {}
    return Response.json({ insights, meta: { brands: brands.length, posts: items.length, pillars: pillarLandscape.length } });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
