import { FRAMEWORK_CONTEXT } from "@/lib/framework";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function POST(request) {
  const body = await request.json();
  const { action } = body;
  const apiKeys = [process.env.YOUTUBE_API_KEY, process.env.YOUTUBE_API_KEY_2].filter(Boolean);
  let apiKey = apiKeys[0];
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) return Response.json({ error: "YouTube API key not configured" }, { status: 500 });

  // ─── HELPER: fetch video stats (views, duration) ───
  async function enrichWithStats(videos) {
    if (videos.length === 0) return videos;
    const ids = videos.map(v => v.videoId).join(",");
    const statsRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=statistics,contentDetails&id=${ids}&key=${apiKey}`);
    const statsData = await statsRes.json();
    const statsMap = {};
    (statsData.items || []).forEach(item => {
      statsMap[item.id] = {
        viewCount: parseInt(item.statistics?.viewCount || "0"),
        duration: item.contentDetails?.duration || "",
      };
    });
    videos.forEach(v => {
      const stats = statsMap[v.videoId];
      if (stats) {
        v.viewCount = stats.viewCount;
        v.duration = stats.duration;
        const dm = stats.duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
        v.durationSeconds = dm ? (parseInt(dm[1]||0)*3600 + parseInt(dm[2]||0)*60 + parseInt(dm[3]||0)) : 0;
      }
    });
    return videos;
  }

  // ─── HELPER: YouTube search call ───
  async function ytSearch(params) {
    const res = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`);
    const data = await res.json();
    if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
    return (data.items || []).filter(item => item.id?.videoId).map(item => ({
      videoId: item.id.videoId,
      title: item.snippet.title,
      channel: item.snippet.channelTitle,
      channelId: item.snippet.channelId,
      description: item.snippet.description,
      thumbnail: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.medium?.url,
      publishedAt: item.snippet.publishedAt,
      year: item.snippet.publishedAt?.substring(0, 4),
    }));
  }

  // ─── SEARCH (single-phase, quota-efficient) ───
  if (action === "search") {
    const { query, maxResults = 15, publishedAfter, publishedBefore, regionCode, videoDuration, minSeconds, maxSeconds } = body;
    if (!query) return Response.json({ error: "No query" }, { status: 400 });

    try {
      // Single search call — saves quota (was using 4 calls before, now just 2: search + stats)
      const params = new URLSearchParams({
        part: "snippet",
        q: query,
        type: "video",
        maxResults: String(Math.min(maxResults * 2, 50)), // fetch extra to filter by duration
        key: apiKey,
        order: "relevance",
      });
      if (publishedAfter) params.set("publishedAfter", publishedAfter);
      if (publishedBefore) params.set("publishedBefore", publishedBefore);
      if (regionCode) params.set("regionCode", regionCode);
      if (videoDuration) params.set("videoDuration", videoDuration);

      let videos = await ytSearch(params);

      // Detect official channel — match brand name against channel names
      const brandName = query.split(/\s/)[0].toLowerCase().replace(/[^a-z0-9]/g, "");
      videos.forEach(v => {
        const chName = (v.channel || "").toLowerCase().replace(/[^a-z0-9]/g, "");
        v.isOfficial = chName.includes(brandName) || brandName.includes(chName);
        v.source = v.isOfficial ? "official" : "general";
      });

      // Enrich with stats (1 API call for batch)
      videos = await enrichWithStats(videos);

      // Filter by duration
      if (minSeconds || maxSeconds) {
        const min = minSeconds || 0;
        const max = maxSeconds || 999999;
        videos = videos.filter(v => v.durationSeconds >= min && v.durationSeconds <= max);
      }

      // Sort: official first, then by views
      videos.sort((a, b) => {
        if (a.isOfficial && !b.isOfficial) return -1;
        if (!a.isOfficial && b.isOfficial) return 1;
        return (b.viewCount || 0) - (a.viewCount || 0);
      });

      // Trim to requested max
      videos = videos.slice(0, maxResults);

      return Response.json({ videos, totalResults: videos.length });
    } catch (err) {
      const msg = err.message || "";
      // If quota exceeded and we have a backup key, retry with it
      if (msg.includes("quota") && apiKeys.length > 1 && apiKey === apiKeys[0]) {
        apiKey = apiKeys[1];
        try {
          let videos = await ytSearch(new URLSearchParams({
            part: "snippet", q: query, type: "video",
            maxResults: String(Math.min(maxResults * 2, 50)),
            key: apiKey, order: "relevance",
            ...(publishedAfter ? { publishedAfter } : {}),
            ...(regionCode ? { regionCode } : {}),
            ...(videoDuration ? { videoDuration } : {}),
          }));
          const brandName2 = query.split(/\s/)[0].toLowerCase().replace(/[^a-z0-9]/g, "");
          videos.forEach(v => {
            const chName = (v.channel || "").toLowerCase().replace(/[^a-z0-9]/g, "");
            v.isOfficial = chName.includes(brandName2) || brandName2.includes(chName);
            v.source = v.isOfficial ? "official" : "general";
          });
          videos = await enrichWithStats(videos);
          if (minSeconds || maxSeconds) {
            videos = videos.filter(v => v.durationSeconds >= (minSeconds||0) && v.durationSeconds <= (maxSeconds||999999));
          }
          videos.sort((a, b) => a.isOfficial && !b.isOfficial ? -1 : !a.isOfficial && b.isOfficial ? 1 : (b.viewCount||0)-(a.viewCount||0));
          videos = videos.slice(0, maxResults);
          return Response.json({ videos, totalResults: videos.length });
        } catch (err2) {
          return Response.json({ error: "YouTube API daily limit reached on all keys." }, { status: 429 });
        }
      }
      if (msg.includes("quota")) {
        return Response.json({ error: "YouTube API daily limit reached." }, { status: 429 });
      }
      return Response.json({ error: msg }, { status: 500 });
    }
  }

  // ─── RANK (AI relevance scoring) ───
  if (action === "rank") {
    const { brand, keywords, market, videos } = body;
    if (!videos?.length) return Response.json({ rankings: [] });
    if (!anthropicKey) return Response.json({ error: "Anthropic key not configured" }, { status: 500 });

    const videoList = videos.map((v, i) => `${i + 1}. "${v.title}" by ${v.channel} (${v.viewCount?.toLocaleString() || "?"} views, ${v.year}) — ${v.description?.slice(0, 150)}`).join("\n");

    const system = `You are a competitive intelligence analyst scoring YouTube videos for relevance to brand advertising and marketing analysis.

BRAND: ${brand}
${keywords ? `KEYWORDS: ${keywords}` : ""}
${market ? `MARKET: ${market}` : ""}

Score each video 1-10 for competitive intelligence relevance. We are looking for OFFICIAL BRAND COMMUNICATIONS — ads, campaigns, branded content, product launches.

SCORING GUIDE:
- 9-10: Official brand advertisement or campaign (aired on TV, YouTube pre-roll, official channel)
- 7-8: Official brand content (product explainer, brand film, press conference, official launch)
- 5-6: News coverage or industry analysis OF the brand's marketing/campaigns
- 3-4: Tangentially related (industry overview, fintech roundup mentioning the brand)
- 1-2: NOT relevant — influencer tutorials, user reviews, reaction videos, "how to use" guides, unrelated content

HEAVILY PENALIZE:
- Influencer/creator content that is NOT official brand advertising
- Tutorial or "how to" videos
- User-generated reviews or reaction videos
- Content from channels that are clearly not the brand or media outlets
- Videos where the brand is just mentioned in passing

BOOST:
- Videos from the brand's official YouTube channel
- Videos that are clearly produced advertisements or campaigns
- Content from advertising industry channels (e.g., Ads of the World, The Drum)

Return ONLY valid JSON: {"rankings":[{"index":1,"score":9,"reason":"Official TV campaign from brand channel"},...]}"
Do not include markdown or explanation.`;

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": anthropicKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 2000,
          system,
          messages: [{ role: "user", content: `Score these ${videos.length} videos:\n\n${videoList}` }],
        }),
      });
      const data = await res.json();
      const text = data.content?.[0]?.text || "";
      let parsed;
      try { parsed = JSON.parse(text); } catch {
        const m = text.match(/\{[\s\S]*\}/);
        if (m) parsed = JSON.parse(m[0]); else parsed = { rankings: [] };
      }
      return Response.json(parsed);
    } catch (err) {
      return Response.json({ rankings: [] });
    }
  }

  // ─── TRANSCRIPT ───
  if (action === "transcript") {
    const { videoId } = body;
    if (!videoId) return Response.json({ error: "No videoId" }, { status: 400 });

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
        headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36", "Accept-Language": "en-US,en;q=0.9" },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const html = await res.text();

      // Extract caption tracks
      const captionMatch = html.match(/"captionTracks":\s*(\[.*?\])/);
      if (!captionMatch) return Response.json({ transcript: "" });

      const tracks = JSON.parse(captionMatch[1].replace(/\\u0026/g, "&").replace(/\\"/g, '"'));
      const enTrack = tracks.find(t => t.languageCode === "en") || tracks[0];
      if (!enTrack?.baseUrl) return Response.json({ transcript: "" });

      const captionUrl = enTrack.baseUrl.replace(/\\u0026/g, "&");
      const capRes = await fetch(captionUrl);
      const xml = await capRes.text();

      // Parse XML captions
      const lines = [];
      const regex = /<text[^>]*>(.*?)<\/text>/g;
      let match;
      while ((match = regex.exec(xml)) !== null) {
        const text = match[1]
          .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\n/g, " ").trim();
        if (text) lines.push(text);
      }

      return Response.json({ transcript: lines.join(" ") });
    } catch (err) {
      return Response.json({ transcript: "" });
    }
  }

  return Response.json({ error: "Unknown action" }, { status: 400 });
}
