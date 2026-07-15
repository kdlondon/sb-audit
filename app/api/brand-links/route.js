// Identify + VERIFY each brand's official website and YouTube channel.
// (Instagram/TikTok were removed: their pages can't be validated server-side — bot walls
// return the same status for real and fake handles — so the analyst fills them manually.)
//
// Website strategy: the AI proposes up to 3 candidate domains per brand; we take the
// first that (a) resolves, and (b) when HTML is readable, whose title/og metadata
// actually mentions the brand — catching wrong-but-existing domains, not just invented
// ones. YouTube: verified against the YouTube Data API channel search (2 query variants).
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml",
  "Accept-Language": "en;q=0.9,es;q=0.8",
};

const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");

function nameAffinity(text, brandName) {
  const t = norm(text), b = norm(brandName);
  if (!t || !b) return false;
  if (t.includes(b) || b.includes(t)) return true;
  const words = String(brandName).toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 4);
  return words.length > 0 && words.some((w) => t.includes(norm(w)));
}

// Fetch a page: returns { status, html } — status 0 on DNS/network failure.
async function probe(url, ms = 6000) {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), ms);
    const res = await fetch(url, { headers: BROWSER_HEADERS, redirect: "follow", signal: controller.signal });
    clearTimeout(t);
    let html = "";
    if ((res.headers.get("content-type") || "").includes("text/html")) {
      try { html = (await res.text()).slice(0, 20000); } catch {}
    }
    return { status: res.status, html };
  } catch { return { status: 0, html: "" }; }
}

// Validate a website candidate for a brand. Levels:
//  2 = resolves AND page metadata mentions the brand (confirmed)
//  1 = resolves but content unreadable/bot-blocked (plausible)
//  0 = 404 / 5xx / DNS failure (invented or wrong)
async function scoreWebsite(url, brandName) {
  if (!/^https?:\/\/.+\..+/.test(url)) return 0;
  const { status, html } = await probe(url);
  if (status === 0 || status === 404 || status >= 500) return 0;
  if (html) {
    const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "");
    const og = (html.match(/property=["']og:site_name["'][^>]*content=["']([^"']+)/i)?.[1] || "") + " " + (html.match(/content=["']([^"']+)["'][^>]*property=["']og:site_name["']/i)?.[1] || "");
    const domain = url.replace(/^https?:\/\/(www\.)?/, "").split("/")[0];
    if (nameAffinity(title + " " + og + " " + domain, brandName)) return 2;
    return 0; // readable page that never mentions the brand → wrong site
  }
  // Bot-blocked (403/429…): can't read content — accept if the domain itself carries the name
  const domain = url.replace(/^https?:\/\/(www\.)?/, "").split("/")[0];
  return nameAffinity(domain, brandName) ? 2 : 1;
}

// YouTube via Data API: try two query variants, take the first channel whose title
// matches the brand (either direction).
async function youtubeFor(brandName, industry, ytKey) {
  if (!ytKey) return "";
  const queries = [brandName, `${brandName} ${industry || ""}`.trim()];
  for (const q of queries) {
    try {
      const r = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&maxResults=5&q=${encodeURIComponent(q)}&key=${ytKey}`);
      const d = await r.json();
      const hit = (d.items || []).find((it) => {
        const title = it.snippet?.channelTitle || "";
        return nameAffinity(title, brandName) || nameAffinity(brandName, title);
      });
      const id = hit?.id?.channelId || hit?.snippet?.channelId;
      if (id) return `https://www.youtube.com/channel/${id}`;
    } catch {}
  }
  return "";
}

export async function POST(request) {
  const { brands = [], market = "", industry = "" } = await request.json();
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const ytKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) return Response.json({ error: "API key not configured" }, { status: 500 });
  const list = (Array.isArray(brands) ? brands : []).map((b) => (typeof b === "string" ? { name: b } : b)).filter((b) => b?.name);
  if (!list.length) return Response.json({ links: [] });

  const prompt = `For each of these ${industry || ""} brands${market ? ` (primary market: ${market})` : ""}, list up to 3 CANDIDATE official website URLs, most likely first.

BRANDS:
${list.map((b) => `- ${b.name}`).join("\n")}

Rules:
- Candidates = the brand's official main site. Prefer the market-specific domain when the market is given, but include the global .com as another candidate.
- Only real domains you have seen for this exact brand. Do NOT construct plausible-looking domains.
- Return ONLY a raw JSON array, same order, no markdown:
[{"name":"Brand","websites":["https://…","https://…"]}]`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 2000, messages: [{ role: "user", content: prompt }] }),
    });
    const data = await res.json();
    if (data.error) return Response.json({ error: data.error.message }, { status: 500 });
    const text = data.content?.map((c) => c.text || "").join("") || "";
    let parsed = [];
    try { parsed = JSON.parse(text); } catch { const m = text.match(/\[[\s\S]*\]/); if (m) { try { parsed = JSON.parse(m[0]); } catch {} } }
    const byName = {}; (Array.isArray(parsed) ? parsed : []).forEach((p) => { if (p?.name) byName[String(p.name).toLowerCase()] = p; });

    const links = await Promise.all(list.map(async (b) => {
      const p = byName[String(b.name).toLowerCase()] || {};
      const candidates = (Array.isArray(p.websites) ? p.websites : [p.website].filter(Boolean)).map((u) => String(u).trim()).filter(Boolean).slice(0, 3);
      // Score all candidates in parallel; pick the best (confirmed > plausible).
      const scores = await Promise.all(candidates.map((u) => scoreWebsite(u, b.name)));
      let website = ""; let best = 0;
      candidates.forEach((u, i) => { if (scores[i] > best) { best = scores[i]; website = u; } });
      const youtube = await youtubeFor(b.name, industry, ytKey);
      return { name: b.name, website, youtube, instagram: "", tiktok: "", verified: { website: best === 2, youtube: !!youtube } };
    }));
    return Response.json({ links });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
