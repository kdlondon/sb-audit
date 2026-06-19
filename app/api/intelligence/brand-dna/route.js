import { createClient } from "@supabase/supabase-js";
import { loadFramework } from "@/lib/framework-loader";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Brand DNA: crawl a brand's own website (what it SAYS — expressed) and cross it with the
// brand's already-captured content (what it DOES — validated) to produce a structured
// profile: purpose, claim, positioning, segments, personality/tone/archetype, role
// (expressed vs validated), discourse and a semantic cloud.
const cdOf = (e) => { try { return typeof e.custom_dimensions === "string" ? JSON.parse(e.custom_dimensions) : (e.custom_dimensions || {}); } catch { return {}; } };
const clean = (s) => String(s || "").replace(/[\uD800-\uDFFF]/g, "").replace(/\s+/g, " ").trim();

const KEY_PATTERNS = [
  /\/(about|who-we-are|our-story|company|mission|purpose|values|brand)/i,
  /\/(nosotros|quienes-somos|sobre|empresa|mision|proposito|valores|marca|compromiso)/i,
  /\/(sustainab|sostenib|responsab|esg|impact)/i,
  /\/(experience|onboard|product|services|fleet|destinations|rutas|destinos|experiencia)/i,
  /\/(careers|talent|people|empleo|trabaja|cultura)/i,
];

async function crawl(url) {
  const pages = [], visited = new Set();
  const baseUrl = new URL(url).origin;
  async function fetchPage(pageUrl, label) {
    if (visited.has(pageUrl) || pages.length >= 10) return;
    visited.add(pageUrl);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 9000);
      const res = await fetch(pageUrl, { headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" }, signal: controller.signal, redirect: "follow" });
      clearTimeout(timeout);
      if (!res.ok) return;
      const html = await res.text();
      const text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "").replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "").replace(/<(nav|footer|header)[^>]*>[\s\S]*?<\/\1>/gi, "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#\d+;/g, "").replace(/\s+/g, " ").trim().slice(0, 7000);
      const links = [];
      let m; const re = /href="([^"]+)"/gi;
      while ((m = re.exec(html)) !== null) {
        let href = m[1];
        if (href.startsWith("/")) href = baseUrl + href;
        if (href.startsWith(baseUrl) && !visited.has(href) && !/\.(pdf|jpg|jpeg|png|svg|css|js|woff2?|ttf|eot|ico|gif|webp|mp4|zip)/i.test(href) && !/\/(assets|fonts|static)\//.test(href)) links.push(href);
      }
      const title = html.match(/<title[^>]*>(.*?)<\/title>/i)?.[1]?.trim() || "";
      const meta = html.match(/<meta[^>]*name="description"[^>]*content="([^"]*)"/i)?.[1]?.trim() || "";
      pages.push({ url: pageUrl, label: label || pageUrl.replace(baseUrl, "") || "/", title, meta, text, links: links.slice(0, 30) });
    } catch {}
  }
  await fetchPage(url, "Home");
  const mainLinks = pages[0]?.links || [];
  for (const pat of KEY_PATTERNS) { const found = mainLinks.find((l) => pat.test(l)); if (found) await fetchPage(found); }
  if (pages.length < 4) for (const l of mainLinks.slice(0, 6)) { if (pages.length >= 5) break; if (!visited.has(l) && !l.includes("#")) await fetchPage(l); }
  return pages;
}

export async function POST(request) {
  const { project_id, brand, url } = await request.json();
  if (!project_id || !brand || !url) return Response.json({ error: "project_id, brand and url required" }, { status: 400 });
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const sUrl = process.env.NEXT_PUBLIC_SUPABASE_URL, sKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!apiKey || !sUrl || !sKey) return Response.json({ error: "Server not configured" }, { status: 500 });

  let framework = null; try { framework = await loadFramework(project_id); } catch {}
  const lang = framework?.language || "English";
  const category = framework?.industry || "the category";

  // EXPRESSED — crawl the brand's site
  let pages = [];
  try { pages = await crawl(url.startsWith("http") ? url : `https://${url}`); } catch (e) { return Response.json({ error: "Crawl failed: " + e.message }, { status: 400 }); }
  if (pages.length === 0) return Response.json({ error: "Could not fetch the website" }, { status: 400 });
  const siteContent = pages.map((p) => `--- ${p.label} (${p.url}) ---\nTitle: ${p.title}\nMeta: ${p.meta}\n${p.text}`).join("\n\n").slice(0, 26000);

  // VALIDATED — the brand's already-captured content
  const admin = createClient(sUrl, sKey, { auth: { persistSession: false } });
  const { data: rows } = await admin.from("creative_source").select("competitor,brand,brand_name,synopsis,tone_of_voice,brand_archetype,primary_territory,communication_intent,custom_dimensions").eq("project_id", project_id).or(`competitor.eq.${brand},brand.eq.${brand},brand_name.eq.${brand}`);
  const content = (rows || []).map((e) => ({ tone: e.tone_of_voice || "", arch: e.brand_archetype || "", terr: e.primary_territory || "", hero: /hero/i.test(e.communication_intent || ""), pillar: cdOf(e)._social?.content_pillar || "", caption: clean(e.synopsis).slice(0, 140) }));
  const tally = (key) => { const m = {}; content.forEach((c) => { if (c[key]) m[c[key]] = (m[c[key]] || 0) + 1; }); return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, n]) => `${k} (${n})`); };
  const validated = content.length
    ? `From ${content.length} captured posts:\n- Tones: ${tally("tone").join(", ") || "n/a"}\n- Archetypes: ${tally("arch").join(", ") || "n/a"}\n- Territories: ${tally("terr").join(", ") || "n/a"}\n- Pillars: ${tally("pillar").join(", ") || "n/a"}\n- Hero/brand content: ${Math.round(100 * content.filter((c) => c.hero).length / content.length)}%\n- Sample captions: ${content.slice(0, 25).map((c) => c.caption).filter(Boolean).join(" | ").slice(0, 1800)}`
    : "(no captured content for this brand yet)";

  const prompt = `You are a senior brand strategist building a BRAND DNA profile for "${brand}" in ${category}.
You have TWO sources:
A) EXPRESSED — the brand's own website (what it SAYS about itself).
B) VALIDATED — the brand's actual published content (what it DOES).
Contrast them: the gap between expressed and validated is the key strategic insight.

Return ONLY raw JSON:
{
 "purpose": "the brand's purpose / reason for being (1-2 sentences)",
 "claim": "the brand's main claim/tagline (exact if found, else inferred)",
 "positioning": "expressed positioning / description (2-3 sentences)",
 "segments": ["customer segment served, e.g. Business traveler", "International tourist", ...],
 "personality": "3-5 personality traits",
 "tone": "tone of voice (e.g. Aspirational, Warm, Authoritative)",
 "archetype": "primary brand archetype",
 "role": {"expressed": "the role the brand CLAIMS to play (from the website)", "validated": "the role it ACTUALLY plays in its content", "gap": "1 sentence on the tension/alignment between them"},
 "discourse": "the brand's core discourse / narrative thread (2-3 sentences)",
 "semantic_cloud": [{"term":"recurring concept","weight":1-10}, ...12-18 terms from BOTH sources]
}

No emojis. Write everything in ${lang}.

=== A) WEBSITE (EXPRESSED) — ${pages.length} pages ===
${siteContent}

=== B) CAPTURED CONTENT (VALIDATED) ===
${validated}`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST", headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 2500, messages: [{ role: "user", content: prompt.replace(/[\uD800-\uDFFF]/g, "") }] }),
    });
    const data = await res.json();
    if (data.error) return Response.json({ error: data.error.message }, { status: 500 });
    const text = data.content?.map((c) => c.text || "").join("") || "{}";
    let profile = {}; try { profile = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] || "{}"); } catch {}
    const meta = { pagesCrawled: pages.map((p) => p.label), postsAnalyzed: content.length };
    // Save a new version (resilient — works once MIGRATION_brand_profiles.sql is applied)
    let saved = null;
    try { const { data: ins } = await admin.from("brand_profiles").insert({ project_id, brand, url, profile, meta, created_by: "" }).select("id, created_at").single(); saved = ins; } catch {}
    return Response.json({ profile, id: saved?.id, created_at: saved?.created_at, meta });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
