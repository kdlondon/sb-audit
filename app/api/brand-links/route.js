// Identify + VERIFY each brand's official website and YouTube channel, USING THE STUDY
// CONTEXT (category + market). Three stages:
//   1. PROPOSE — the AI lists up to 3 candidate domains per brand.
//   2. PROBE — we fetch every candidate and extract real evidence (title, og, text
//      snippet); YouTube candidates come from the Data API (title + description).
//   3. VERIFY — graduated:
//      a. Candidates WITH readable page content go to an AI judge with the study
//         context — killing same-name/other-business domains (INSUR real-estate vs
//         insur.es insurance) and unrelated channels.
//      b. Candidates whose site EXISTS but is bot-walled (403/empty — big corporate
//         sites block datacenter IPs) fall back to STRICT domain↔brand-name affinity
//         (taylorwimpey.co.uk ↔ "Taylor Wimpey"), marked unverified. Without this,
//         every bot-walled brand came back empty.
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

const parseJson = (raw) => {
  const text = String(raw).replace(/```(?:json)?/gi, "").trim(); // models often fence their JSON
  try { return JSON.parse(text); } catch {}
  // The reply may carry prose (which can itself contain brackets like "[w0]") before the
  // payload — extract the ARRAY-OF-OBJECTS block specifically, else any object.
  const arr = text.match(/\[\s*\{[\s\S]*\}\s*\]/);
  if (arr) { try { return JSON.parse(arr[0]); } catch {} }
  const obj = text.match(/\{[\s\S]*\}/);
  if (obj) { try { return JSON.parse(obj[0]); } catch {} }
  return null;
};

const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");

// STRICT domain ↔ brand-name affinity for the bot-walled fallback: the domain core must
// equal the full brand name, or equal/contain the joined significant words. Deliberately
// tighter than a fuzzy match — the AI judge handles nuance when content is readable.
function domainAffinity(url, brandName) {
  const host = String(url).replace(/^https?:\/\/(www\.)?/, "").split("/")[0];
  const core = norm(host.split(".").slice(0, -1).join(".")); // drop TLD(s) crudely
  const b = norm(brandName);
  if (!core || !b) return false;
  if (core === b) return true;
  if (b.length >= 4 && core.includes(b)) return true;   // domain contains the full brand name
  if (core.length >= 3 && b.includes(core)) return true; // brand contains the domain core (mrv.com.br ↔ MRV Engenharia)
  const words = String(brandName).toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 3);
  return words.length > 1 && words.every((w) => core.includes(norm(w)));
}

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
    const exists = res.status > 0 && res.status !== 404 && res.status < 500;
    const readable = exists && (title.length > 3 || og.length > 10 || snippet.length > 60);
    return { exists, readable, status: res.status, title, og, snippet };
  } catch { return { exists: false, readable: false, status: 0, title: "", og: "", snippet: "" }; }
}

export async function POST(request) {
  const { brands = [], market = "", industry = "", debug = false } = await request.json();
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const ytKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) return Response.json({ error: "API key not configured" }, { status: 500 });
  const list = (Array.isArray(brands) ? brands : []).map((b) => (typeof b === "string" ? { name: b } : b)).filter((b) => b?.name);
  if (!list.length) return Response.json({ links: [] });
  const label = (b) => `${b.name}${b.country ? ` (${b.country})` : ""}${b.hint ? ` — ${String(b.hint).slice(0, 140)}` : ""}`;

  try {
    // ── 1. PROPOSE website candidates ─────────────────────────────────────────
    const proposeText = await claude(apiKey, `For each of these ${industry || ""} brands (study's primary market: ${market || "n/a"}; a brand's own country is shown in parentheses), list up to 3 CANDIDATE official website URLs, most likely first.
BRANDS:
${list.map((b) => `- ${label(b)}`).join("\n")}
Rules: prefer real domains you have seen for this exact brand; prefer the brand's own-country domain and include the global .com as another candidate. For SHORT or AMBIGUOUS names, ALSO include likely corporate-group variants (e.g. grupo{name}.com, {name}group.com, {name}inmobiliaria.com) — every candidate is fetched and verified afterwards, so plausible guesses are acceptable here.
Return ONLY a raw JSON array, same order, no markdown: [{"name":"Brand","websites":["https://…"]}]`);
    const proposed = parseJson(proposeText) || [];
    const byName = {}; proposed.forEach((p) => { if (p?.name) byName[String(p.name).toLowerCase()] = p; });

    // ── 2. PROBE websites + YouTube candidates (all in parallel) ──────────────
    const evidence = await Promise.all(list.map(async (b) => {
      const p = byName[String(b.name).toLowerCase()] || {};
      let candidates = (Array.isArray(p.websites) ? p.websites : []).map((u) => String(u).trim()).filter((u) => /^https?:\/\/.+\..+/.test(u)).slice(0, 3);
      // Synthetic corporate-group variants for short/ambiguous names (grupoinsur.com ↔
      // "Insur"). Safe to guess: every candidate is probed and judged before acceptance.
      const core = norm(b.name);
      if (core && core.length <= 12) {
        const variants = [`https://www.grupo${core}.com`, `https://www.grupo${core}.es`, `https://www.${core}group.com`];
        const have = new Set(candidates.map((u) => u.replace(/^https?:\/\/(www\.)?/, "").split("/")[0]));
        variants.forEach((v) => { const h = v.replace(/^https?:\/\/(www\.)?/, "").split("/")[0]; if (!have.has(h) && candidates.length < 6) candidates.push(v); });
      }
      const probes = await Promise.all(candidates.map((u) => probe(u)));
      const sites = candidates.map((u, i) => ({ url: u, ...probes[i] })).filter((s) => s.exists);
      let channels = [];
      if (ytKey) {
        // ONE search per brand (plain name finds official channels best) — YouTube search
        // costs 100 quota units/call and the daily quota is shared with Scout.
        try {
          const r = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&maxResults=5&q=${encodeURIComponent(b.name)}&key=${ytKey}`);
          const d = await r.json();
          channels = (d.items || []).map((it) => ({ id: it.id?.channelId || it.snippet?.channelId, title: it.snippet?.channelTitle || "", description: (it.snippet?.description || "").slice(0, 200) })).filter((c) => c.id);
        } catch {}
      }
      return { name: b.name, country: b.country || "", sites, channels };
    }));

    // ── 3a. AI VERIFY — only candidates with READABLE content can be judged ───
    const judgeable = evidence.map((e, i) => ({ ...e, i, readableSites: e.sites.filter((s) => s.readable) }))
      .filter((e) => e.readableSites.length || e.channels.length);
    let verdicts = [];
    let verifyRaw = "";
    if (judgeable.length) {
      const dossier = judgeable.map((e) => `BRAND ${e.i}: ${label(list[e.i])}
  WEBSITE CANDIDATES:${e.readableSites.length ? "" : " none readable"}
${e.readableSites.map((s, j) => `    [w${j}] ${s.url} — title: "${s.title}" · og: "${s.og}" · content: "${s.snippet.slice(0, 250)}"`).join("\n")}
  YOUTUBE CANDIDATES:${e.channels.length ? "" : " none"}
${e.channels.map((c, j) => `    [y${j}] "${c.title}" — ${c.description}`).join("\n")}`).join("\n\n");

      const verifyText = await claude(apiKey, `Reply with ONLY a raw JSON array — your ENTIRE response must be the JSON, no analysis, no explanations, no markdown.

You are verifying the official digital presence of brands in a competitive study.
STUDY CONTEXT: category = ${industry || "unknown"} · primary market = ${market || "unknown"} (each brand may be from another country, shown in parentheses).

For each brand below, decide from the ACTUAL PAGE EVIDENCE which website candidate (if any) is truly the official site of THAT brand — a ${industry || ""} company — and which YouTube channel (if any) is its official channel.
CRITICAL: a domain or channel that merely shares the name but belongs to a DIFFERENT business (different sector, homonym) must be REJECTED. When no candidate clearly matches, answer -1. A wrong link is worse than none.
YOUTUBE NUANCE: channel descriptions are often empty — that is NOT evidence against. ACCEPT a channel whose title is the brand name or an obvious variant of it ("Grupo X", "X de España", "X Official"), and only reject titles that signal a different business (another sector or country than the brand's).

${dossier}

Return ONLY the raw JSON array — no analysis, no prose: [{"brand":0,"website":0,"youtube":-1}] where "brand" is the BRAND index shown above and website/youtube are chosen candidate indexes or -1.`, 2500);
      verifyRaw = verifyText;
      verdicts = parseJson(verifyText) || [];
    }

    // ── 3b. ASSEMBLE with graduated fallbacks ──────────────────────────────────
    const links = list.map((b, i) => {
      const e = evidence[i];
      const readableSites = e.sites.filter((s) => s.readable);
      const v = verdicts.find((x) => Number(x?.brand) === i) || {};
      let website = "", webVerified = false, youtube = "", ytVerified = false;

      // Website: judge verdict over readable candidates…
      const wIdx = Number.isInteger(v.website) ? v.website : -1;
      if (wIdx >= 0 && readableSites[wIdx]) { website = readableSites[wIdx].url; webVerified = true; }
      // …else strict-affinity fallback over EXISTING but UNREADABLE candidates only
      // (readable ones the judge already rejected stay rejected — the INSUR case).
      if (!website) {
        const walled = e.sites.filter((s) => !s.readable);
        const hit = walled.find((s) => domainAffinity(s.url, b.name));
        if (hit) website = hit.url;
      }

      // YouTube: judge verdict…
      const yIdx = Number.isInteger(v.youtube) ? v.youtube : -1;
      if (yIdx >= 0 && e.channels[yIdx]) { youtube = `https://www.youtube.com/channel/${e.channels[yIdx].id}`; ytVerified = true; }
      // …else name fallback: exact match, or the brand name contained in the title
      // (picking the SHORTEST such title — "Grupo Insur" over "Seguros InSur Argentina").
      if (!youtube) {
        const bn = norm(b.name);
        const matches = e.channels.filter((c) => { const t = norm(c.title); return t === bn || (bn.length >= 5 && t.includes(bn)); });
        const pick = matches.sort((a, z) => a.title.length - z.title.length)[0];
        if (pick) youtube = `https://www.youtube.com/channel/${pick.id}`;
      }

      return { name: b.name, website, youtube, instagram: "", tiktok: "", verified: { website: webVerified, youtube: ytVerified } };
    });
    if (debug) return Response.json({ links, verifyRaw: verifyRaw.slice(0, 800), debug: evidence.map((e, i) => ({ name: e.name, sites: e.sites.map((s) => ({ url: s.url, status: s.status, readable: s.readable, title: s.title.slice(0, 60) })), channels: e.channels.map((c) => c.title), verdict: verdicts.find((x) => Number(x?.brand) === i) || null })) });
    return Response.json({ links });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
