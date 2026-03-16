import { FRAMEWORK_CONTEXT } from "@/lib/framework";

export async function POST(request) {
  const body = await request.json();
  const { action } = body;
  const apiKey = process.env.YOUTUBE_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) return Response.json({ error: "YouTube API key not configured" }, { status: 500 });

  // ─── SEARCH ───
  if (action === "search") {
    const { query, maxResults = 15, publishedAfter, publishedBefore, regionCode, pageToken } = body;
    if (!query) return Response.json({ error: "No query" }, { status: 400 });

    const params = new URLSearchParams({
      part: "snippet",
      q: query,
      type: "video",
      maxResults: String(Math.min(maxResults, 50)),
      key: apiKey,
      order: "relevance",
    });
    if (publishedAfter) params.set("publishedAfter", publishedAfter);
    if (publishedBefore) params.set("publishedBefore", publishedBefore);
    if (regionCode) params.set("regionCode", regionCode);
    if (pageToken) params.set("pageToken", pageToken);

    try {
      const res = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`);
      const data = await res.json();

      if (data.error) return Response.json({ error: data.error.message }, { status: 400 });

      const videos = (data.items || []).map(item => ({
        videoId: item.id.videoId,
        title: item.snippet.title,
        channel: item.snippet.channelTitle,
        description: item.snippet.description,
        thumbnail: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.medium?.url,
        publishedAt: item.snippet.publishedAt,
        year: item.snippet.publishedAt?.substring(0, 4),
      }));

      // Get view counts in batch
      if (videos.length > 0) {
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
          if (stats) { v.viewCount = stats.viewCount; v.duration = stats.duration; }
        });
      }

      return Response.json({
        videos,
        nextPageToken: data.nextPageToken || null,
        totalResults: data.pageInfo?.totalResults || 0,
        quotaUsed: 100 + 1, // search + one details call
      });
    } catch (err) {
      return Response.json({ error: err.message }, { status: 500 });
    }
  }

  // ─── RANK (AI relevance scoring) ───
  if (action === "rank") {
    const { brand, keywords, market, videos } = body;
    if (!videos?.length) return Response.json({ rankings: [] });
    if (!anthropicKey) return Response.json({ error: "Anthropic key not configured" }, { status: 500 });

    const videoList = videos.map((v, i) => `${i + 1}. "${v.title}" by ${v.channel} (${v.viewCount?.toLocaleString() || "?"} views, ${v.year}) — ${v.description?.slice(0, 150)}`).join("\n");

    const system = `You are a competitive intelligence analyst scoring YouTube videos for relevance.

BRAND: ${brand}
${keywords ? `KEYWORDS: ${keywords}` : ""}
${market ? `MARKET: ${market}` : ""}

Score each video 1-10 for competitive intelligence relevance:
- 8-10: Directly relevant (official brand ad/campaign, product launch, competitive comparison)
- 5-7: Moderately relevant (industry commentary, related brand content, news coverage)
- 1-4: Low relevance (unrelated content, user-generated, noise)

Return ONLY valid JSON: {"rankings":[{"index":1,"score":8,"reason":"Official campaign ad"},...]}"
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
