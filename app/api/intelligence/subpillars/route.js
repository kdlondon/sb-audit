import { createClient } from "@supabase/supabase-js";
import { loadFramework } from "@/lib/framework-loader";

export const maxDuration = 60;

// Cluster the posts of ONE content pillar into 3-6 sub-pillars (more specific recurring
// themes), and tag each post. Powers the Explore drill-down: pillar → subpillars → content.
const cdOf = (e) => { try { return typeof e.custom_dimensions === "string" ? JSON.parse(e.custom_dimensions) : (e.custom_dimensions || {}); } catch { return {}; } };
const num = (v) => (typeof v === "number" ? v : Number(v) || 0);
const clean = (s) => String(s || "").replace(/[\uD800-\uDFFF]/g, "").replace(/\s+/g, " ").trim();

export async function POST(request) {
  const { project_id, pillar, brand } = await request.json();
  if (!project_id || !pillar) return Response.json({ error: "project_id + pillar required" }, { status: 400 });
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const sUrl = process.env.NEXT_PUBLIC_SUPABASE_URL, sKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!apiKey || !sUrl || !sKey) return Response.json({ error: "Server not configured" }, { status: 500 });

  const admin = createClient(sUrl, sKey, { auth: { persistSession: false } });
  let q = admin.from("creative_source").select("competitor,brand,brand_name,url,image_url,synopsis,custom_dimensions").eq("project_id", project_id).eq("type", "Social post");
  const { data: all } = await q;
  let posts = (all || []).map((e) => {
    const cd = cdOf(e), s = cd._social || {}, m = cd._meta || {};
    return { brand: e.competitor || e.brand || e.brand_name || "—", pillar: s.content_pillar || "", url: e.url || "", image_url: e.image_url || "", likes: num(m.likes), comments: num(m.comments), caption: clean(m.caption || e.synopsis).slice(0, 160) };
  }).filter((p) => p.pillar === pillar);
  if (brand) posts = posts.filter((p) => p.brand === brand);
  if (posts.length === 0) return Response.json({ subpillars: [], posts: [] });

  let framework = null; try { framework = await loadFramework(project_id); } catch {}
  const lang = framework?.language || "English";
  const client = framework?.brandName || "the brand";
  const category = framework?.industry || "the category";

  const list = posts.map((p, i) => `${i}: [${p.brand}] ${p.caption}`).join("\n");
  const prompt = `These ${posts.length} social posts all belong to the content pillar "${pillar}" for ${client} (${category}).
Cluster them into 3-6 SUB-PILLARS — more specific recurring themes within this pillar (e.g. within "Destination Inspiration": Beaches, City breaks, Nature, Culture).
Return ONLY raw JSON: {"subpillars":["Name1","Name2",...],"assign":["SubpillarForPost0","SubpillarForPost1",...]} where assign[i] is the sub-pillar NAME for post i (exactly one of subpillars). Concise names (1-3 words). Write names in ${lang}.

POSTS:
${list}`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST", headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 2000, messages: [{ role: "user", content: prompt }] }),
    });
    const data = await res.json();
    if (data.error) return Response.json({ error: data.error.message }, { status: 500 });
    const text = data.content?.map((c) => c.text || "").join("") || "{}";
    let parsed = {}; try { parsed = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] || "{}"); } catch {}
    const names = Array.isArray(parsed.subpillars) ? parsed.subpillars : [];
    const assign = Array.isArray(parsed.assign) ? parsed.assign : [];
    posts.forEach((p, i) => { p.subpillar = assign[i] || names[0] || "Otros"; });
    const counts = {}; posts.forEach((p) => (counts[p.subpillar] = (counts[p.subpillar] || 0) + 1));
    const subpillars = (names.length ? names : Object.keys(counts)).map((n) => ({ name: n, count: counts[n] || 0 })).filter((s) => s.count > 0).sort((a, b) => b.count - a.count);
    return Response.json({ subpillars, posts });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
