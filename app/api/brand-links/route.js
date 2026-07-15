// Identify + VERIFY each brand's official website and social channels (IG, TikTok, YouTube).
// The AI proposes candidates; we then validate against the network and DROP anything we
// can't confirm (an empty field the analyst fills beats a confident-looking wrong link):
//  - website: must resolve via fetch (DNS failure / 5xx / 404 => invented or wrong)
//  - instagram/tiktok: handle must match the brand name (kills similar-name brands) AND
//    the profile URL must not 404
//  - youtube: verified against the YouTube Data API (channel search) when the key exists
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml",
  "Accept-Language": "en;q=0.9,es;q=0.8",
};

const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");

// Does the handle plausibly belong to the brand? Kills "similar name, different brand".
function handleMatchesBrand(handle, brandName) {
  const h = norm(handle), b = norm(brandName);
  if (!h || !b) return false;
  if (h.includes(b) || b.includes(h)) return true;
  // multi-word brands: every significant word present in the handle
  const words = String(brandName).toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 3);
  return words.length > 1 && words.every((w) => h.includes(norm(w)));
}

const handleOf = (url) => {
  const m = String(url).match(/(?:instagram\.com|tiktok\.com)\/@?([A-Za-z0-9._-]+)/) || String(url).match(/youtube\.com\/(?:@|c\/|user\/)?([A-Za-z0-9._-]+)/);
  return m ? m[1] : "";
};

// Fetch with timeout. Returns the HTTP status, or 0 on DNS/network failure.
async function statusOf(url, ms = 6000) {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), ms);
    const res = await fetch(url, { headers: BROWSER_HEADERS, redirect: "follow", signal: controller.signal });
    clearTimeout(t);
    return res.status;
  } catch { return 0; }
}

// Website is valid if the domain resolves and answers with anything but a hard miss.
// 403/429 = bot-blocked but the site exists; 404/5xx/network-error = reject.
async function validWebsite(url) {
  if (!/^https?:\/\/.+\..+/.test(url)) return false;
  const st = await statusOf(url);
  return st > 0 && st !== 404 && st < 500;
}

// Social profile: handle must match the brand AND the page must not 404.
async function validSocial(url, brandName) {
  if (!/^https?:\/\/.+/.test(url)) return false;
  const h = handleOf(url);
  if (!h || !handleMatchesBrand(h, brandName)) return false;
  const st = await statusOf(url);
  return st > 0 && st !== 404 && st < 500;
}

// YouTube: real verification via the Data API — search channels by brand name and keep
// the top result only if its title matches the brand. Falls back to link validation.
async function youtubeFor(brandName, aiUrl, ytKey) {
  if (ytKey) {
    try {
      const r = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&maxResults=3&q=${encodeURIComponent(brandName)}&key=${ytKey}`);
      const d = await r.json();
      const hit = (d.items || []).find((it) => handleMatchesBrand(it.snippet?.channelTitle || "", brandName) || handleMatchesBrand(brandName, it.snippet?.channelTitle || ""));
      if (hit?.snippet?.channelId || hit?.id?.channelId) return `https://www.youtube.com/channel/${hit.id?.channelId || hit.snippet.channelId}`;
    } catch {}
    return ""; // API available but no confident match — leave empty
  }
  return (await validSocial(aiUrl, brandName)) ? aiUrl : "";
}

export async function POST(request) {
  const { brands = [], market = "", industry = "" } = await request.json();
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const ytKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) return Response.json({ error: "API key not configured" }, { status: 500 });
  const list = (Array.isArray(brands) ? brands : []).map((b) => (typeof b === "string" ? { name: b } : b)).filter((b) => b?.name);
  if (!list.length) return Response.json({ links: [] });

  const prompt = `For each of these ${industry || ""} brands${market ? ` (primary market: ${market})` : ""}, give their OFFICIAL digital presence.

BRANDS:
${list.map((b) => `- ${b.name}`).join("\n")}

Rules:
- website: the brand's main official website URL (https://…). Prefer the market-specific domain when the market is given.
- instagram / tiktok: the brand's main official account URL. "" if you are not CERTAIN it exists — a wrong link is worse than an empty one.
- NEVER guess or construct plausible-looking domains/handles. When in doubt: "".
- Return ONLY a raw JSON array, same order as the list, no markdown:
[{"name":"Brand","website":"https://…","instagram":"","tiktok":""}]`;

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

    // VERIFY every candidate against the network (all brands in parallel).
    const links = await Promise.all(list.map(async (b) => {
      const p = byName[String(b.name).toLowerCase()] || {};
      const [webOk, igOk, ttOk, youtube] = await Promise.all([
        p.website ? validWebsite(String(p.website).trim()) : false,
        p.instagram ? validSocial(String(p.instagram).trim(), b.name) : false,
        p.tiktok ? validSocial(String(p.tiktok).trim(), b.name) : false,
        youtubeFor(b.name, String(p.youtube || "").trim(), ytKey),
      ]);
      return {
        name: b.name,
        website: webOk ? String(p.website).trim() : "",
        instagram: igOk ? String(p.instagram).trim() : "",
        tiktok: ttOk ? String(p.tiktok).trim() : "",
        youtube,
        verified: { website: webOk, instagram: igOk, tiktok: ttOk, youtube: !!youtube && !!ytKey },
      };
    }));
    return Response.json({ links });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
