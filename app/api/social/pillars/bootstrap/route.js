import { createClient } from "@supabase/supabase-js";

// Derive a CANONICAL set of content pillars for a project from its existing social
// posts, and store them in dropdown_options (category "content_pillar"). This seeds the
// controlled vocabulary so per-post analysis aligns to a stable taxonomy instead of
// inventing a new pillar each time. Safe to re-run (skips pillars that already exist).
export async function POST(request) {
  const { project_id, sample = 80 } = await request.json();
  if (!project_id) return Response.json({ error: "project_id required" }, { status: 400 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  const sUrl = process.env.NEXT_PUBLIC_SUPABASE_URL, sKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!apiKey || !sUrl || !sKey) return Response.json({ error: "Server not configured" }, { status: 500 });

  const admin = createClient(sUrl, sKey, { auth: { persistSession: false } });

  // Pull captions/synopses from this project's social posts
  const { data: rows } = await admin
    .from("creative_source")
    .select("brand_name, competitor, brand, synopsis, description")
    .eq("project_id", project_id)
    .eq("type", "Social post")
    .limit(sample);
  if (!rows || rows.length === 0) return Response.json({ error: "No social posts found for this project" }, { status: 404 });

  const corpus = rows
    .map((r) => `- [${r.brand_name || r.competitor || r.brand || "?"}] ${(r.synopsis || r.description || "").replace(/\s+/g, " ").slice(0, 200)}`)
    .join("\n")
    .slice(0, 12000);

  const prompt = `You are a brand strategist building a content-pillar taxonomy for a competitive social-media study.
Below are captions from ${rows.length} social posts across several competitor brands in the same category.

Identify the 6–9 RECURRING CONTENT PILLARS (content territories) that best describe how these brands organize their social content. Pillars must be:
- mutually distinct (no near-duplicates like "Culture" vs "Corporate culture" — merge them),
- concise (1–3 words, Title Case),
- reusable across brands.

Return ONLY a raw JSON array of pillar names, e.g. ["Brand Purpose","Product & Network","Customer Experience"].

POSTS:
${corpus}`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 500, messages: [{ role: "user", content: prompt }] }),
    });
    const data = await res.json();
    if (data.error) return Response.json({ error: data.error.message }, { status: 500 });
    const text = data.content?.map((c) => c.text || "").join("") || "[]";
    let pillars = [];
    try { pillars = JSON.parse(text.match(/\[[\s\S]*\]/)?.[0] || "[]"); } catch {}
    pillars = [...new Set(pillars.map((p) => String(p).trim()).filter(Boolean))];
    if (!pillars.length) return Response.json({ error: "Could not derive pillars" }, { status: 500 });

    // Upsert, skipping ones that already exist for this project
    const { data: existing } = await admin
      .from("dropdown_options")
      .select("value")
      .eq("project_id", project_id)
      .eq("category", "content_pillar");
    const have = new Set((existing || []).map((e) => e.value.toLowerCase()));
    const toAdd = pillars.filter((p) => !have.has(p.toLowerCase()));
    if (toAdd.length) {
      await admin.from("dropdown_options").insert(
        toAdd.map((value, i) => ({ project_id, category: "content_pillar", value, sort_order: i }))
      );
    }
    return Response.json({ pillars, added: toAdd, total: pillars.length });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
