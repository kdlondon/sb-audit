// Identify + VERIFY each brand's official website and YouTube channel, USING THE STUDY
// CONTEXT (category + market). Three stages:
//   1. PROPOSE — the AI lists up to 3 candidate domains per brand.
//   2. PROBE — we fetch every candidate and extract real evidence (title, og, text
//      snippet); YouTube candidates come from the Data API (title + description).
//   3. VERIFY — one AI call judges the evidence: "is this page really {brand}, a
//      {category} company in {market}?" — killing same-name/other-business domains
//      (e.g. INSUR real-estate vs insur.es insurance) and unrelated YT channels.
// Instagram/TikTok are NOT auto-suggested (unverifiable server-side) — analyst fills them.
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml",
  "Accept-Language": "es;q=0.9,en;q=0.8",
};

async function claude(apiKey, prompt, maxTokens = 2000) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: maxTokens, messages: [{ role: "user", content: prompt }] }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return (data.content?.map((c) => c.text || "").join("") || "").trim();
}

const parseJson = (text) => {
  try { return JSON.parse(text); } catch {}
  const m = text.match(/[\[{][\s\S]*[\]}]/);
  if (m) { try { return JSON.parse(m[0]); } catch {} }
  return null;
};

// Fetch a candidate page and extract evidence. status 0 = DNS/network failure (invented domain).
async function probe(url, ms = 6000) {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), ms);
    const res = await fetch(url, { headers: BROWSER_HEADERS, redirect: "follow", signal: controller.signal });
    clearTimeout(t);
    let title = "", og = "", snippet = "";
    if ((res.headers.get("content-type") || "").includes("text/html")) {
      try {
        const html = (await res.text()).slice(0, 60000);
        title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "").replace(/\s+/g, " ").trim().slice(0, 150);
        og = (html.match(/property=["']og:(?:site_name|description)["'][^>]*content=["']([^"']+)/i)?.[1] || "").slice(0, 200);
        snippet = html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 400);
      } catch {}
    }
    return { ok: res.status > 0 && res.status !== 404 && res.status < 500, status: res.status, title, og, snippet };
  } catch { return { ok: false, status: 0, title: "", og: "", snippet: "" }; }
}

export async function POST(request) {
  const { brands = [], market = "", industry = "" } = await request.json();
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const ytKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) return Response.json({ error: "API key not configured" }, { status: 500 });
  const list = (Array.isArray(brands) ? brands : []).map((b) => (typeof b === "string" ? { name: b } : b)).filter((b) => b?.name);
  if (!list.length) return Response.json({ links: [] });

  try {
    // ── 1. PROPOSE website candidates ─────────────────────────────────────────
    const proposeText = await claude(apiKey, `For each of these ${industry || ""} brands (primary market: ${market || "n/a"}), list up to 3 CANDIDATE official website URLs, most likely first.
BRANDS:
${list.map((b) => `- ${b.name}`).join("\n")}
Rules: only real domains you have seen for this exact brand — never construct plausible-looking ones. Prefer market-specific domains, include the global .com as another candidate.
Return ONLY a raw JSON array, same order, no markdown: [{"name":"Brand","websites":["https://…"]}]`);
    const proposed = parseJson(proposeText) || [];
    const byName = {}; proposed.forEach((p) => { if (p?.name) byName[String(p.name).toLowerCase()] = p; });

    // ── 2. PROBE websites + YouTube candidates (all in parallel) ──────────────
    const evidence = await Promise.all(list.map(async (b) => {
      const p = byName[String(b.name).toLowerCase()] || {};
      const candidates = (Array.isArray(p.websites) ? p.websites : []).map((u) => String(u).trim()).filter((u) => /^https?:\/\/.+\..+/.test(u)).slice(0, 3);
      const probes = await Promise.all(candidates.map((u) => probe(u)));
      const sites = candidates.map((u, i) => ({ url: u, ...probes[i] })).filter((s) => s.ok);
      let channels = [];
      if (ytKey) {
        try {
          const r = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&maxResults=4&q=${encodeURIComponent(`${b.name} ${industry || ""}`.trim())}&key=${ytKey}`);
          const d = await r.json();
          channels = (d.items || []).map((it) => ({ id: it.id?.channelId || it.snippet?.channelId, title: it.snippet?.channelTitle || "", description: (it.snippet?.description || "").slice(0, 200) })).filter((c) => c.id);
        } catch {}
      }
      return { name: b.name, sites, channels };
    }));

    // ── 3. VERIFY with the study context — one judging call for everything ────
    const dossier = evidence.map((e, i) => `BRAND ${i}: ${e.name}
  WEBSITE CANDIDATES:${e.sites.length ? "" : " none reachable"}
${e.sites.map((s, j) => `    [w${j}] ${s.url} — title: "${s.title}" · og: "${s.og}" · content: "${s.snippet.slice(0, 250)}"`).join("\n")}
  YOUTUBE CANDIDATES:${e.channels.length ? "" : " none"}
${e.channels.map((c, j) => `    [y${j}] "${c.title}" — ${c.description}`).join("\n")}`).join("\n\n");

    const verifyText = await claude(apiKey, `You are verifying the official digital presence of brands in a competitive study.
STUDY CONTEXT: category = ${industry || "unknown"} · primary market = ${market || "unknown"}.

For each brand below, decide from the ACTUAL PAGE EVIDENCE which website candidate (if any) is truly the official site of THAT brand — a ${industry || ""} company — and which YouTube channel (if any) is its official channel.
CRITICAL: a domain or channel that merely shares the name but belongs to a DIFFERENT business (different sector, different country, homonym) must be REJECTED. When no candidate clearly matches the brand + category, answer -1. Be strict: a wrong link is worse than none.

${dossier}

Return ONLY a raw JSON array, one item per brand in order: [{"brand":0,"website":0,"youtube":-1}] where website/youtube are the chosen candidate indexes or -1 for none.`, 1500);
    const verdicts = parseJson(verifyText) || [];

    const links = list.map((b, i) => {
      const e = evidence[i];
      const v = verdicts.find((x) => Number(x?.brand) === i) || verdicts[i] || {};
      const wIdx = Number.isInteger(v.website) ? v.website : -1;
      const yIdx = Number.isInteger(v.youtube) ? v.youtube : -1;
      const website = wIdx >= 0 && e.sites[wIdx] ? e.sites[wIdx].url : "";
      const youtube = yIdx >= 0 && e.channels[yIdx] ? `https://www.youtube.com/channel/${e.channels[yIdx].id}` : "";
      return { name: b.name, website, youtube, instagram: "", tiktok: "", verified: { website: !!website, youtube: !!youtube } };
    });
    return Response.json({ links });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
