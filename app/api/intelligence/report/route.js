import { createClient } from "@supabase/supabase-js";
import { loadFramework } from "@/lib/framework-loader";
import { avgEngagementRate, fmtRate } from "@/lib/engagement";

export const maxDuration = 60; // the AI composition can take ~15-25s; avoid the default timeout

// Compose a Social Media Benchmark report: weave the analyst's curated insights (picks)
// and the aggregated competitive data into a title, executive summary and recommendations.
const cdOf = (e) => { try { return typeof e.custom_dimensions === "string" ? JSON.parse(e.custom_dimensions) : (e.custom_dimensions || {}); } catch { return {}; } };
const num = (v) => (typeof v === "number" ? v : Number(v) || 0);

export async function POST(request) {
  const { project_id, picks = [] } = await request.json();
  if (!project_id) return Response.json({ error: "project_id required" }, { status: 400 });
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const sUrl = process.env.NEXT_PUBLIC_SUPABASE_URL, sKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!apiKey || !sUrl || !sKey) return Response.json({ error: "Server not configured" }, { status: 500 });

  const admin = createClient(sUrl, sKey, { auth: { persistSession: false } });
  const { data: rows } = await admin.from("creative_source").select("competitor,brand,brand_name,custom_dimensions").eq("project_id", project_id).eq("type", "Social post");
  if (!rows || rows.length === 0) return Response.json({ error: "No social posts found" }, { status: 404 });

  let framework = null; try { framework = await loadFramework(project_id); } catch {}
  const client = framework?.brandName || "the client brand";
  const category = framework?.industry || "the category";
  const lang = framework?.language || "English";

  const items = rows.map((e) => { const cd = cdOf(e), s = cd._social || {}, m = cd._meta || {}; return { brand: e.competitor || e.brand || e.brand_name || "—", pillar: s.content_pillar || "Unclassified", likes: num(m.likes), comments: num(m.comments), views: num(m.views), followers: num(m.followers) }; });
  const bc = {}; items.forEach((i) => (bc[i.brand] = (bc[i.brand] || 0) + 1));
  const real = items.filter((i) => bc[i.brand] >= 5);
  const brands = [...new Set(real.map((i) => i.brand))];
  const ps = {}; real.forEach((i) => { const p = (ps[i.pillar] ||= { posts: [] }); p.posts.push(i); });
  const landscape = Object.entries(ps).map(([p, v]) => `${p}: ${v.posts.length} posts, avg engagement rate ${fmtRate(avgEngagementRate(v.posts))}`).sort();
  const picksText = picks.length ? picks.map((p, i) => `${i + 1}. [${p.type}] ${p.headline} — ${p.body} (${p.evidence || ""})`).join("\n") : "(none selected — derive from the data)";

  const prompt = `Compose a Social Media Benchmark report for ${client} in ${category}, based on ${real.length} competitor posts across ${brands.length} brands (${brands.join(", ")}).

ANALYST-CURATED INSIGHTS (the spine of the report):
${picksText}

CONTENT LANDSCAPE:
${landscape.join("\n")}

Return ONLY raw JSON:
{"title":"a sharp report title","executive_summary":"3-4 sentences: the headline story for ${client} — where the category is saturated, where it's open, and the single biggest opportunity","recommendations":["4-6 concrete, prioritized actions for ${client}'s social strategy, each one sentence"]}

No emojis. Write everything in ${lang}.`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST", headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 1500, messages: [{ role: "user", content: prompt.replace(/[\uD800-\uDFFF]/g, "") }] }),
    });
    const data = await res.json();
    if (data.error) return Response.json({ error: data.error.message }, { status: 500 });
    const text = data.content?.map((c) => c.text || "").join("") || "{}";
    let report = {}; try { report = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] || "{}"); } catch {}
    return Response.json({ report, meta: { brands: brands.length, posts: real.length } });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
