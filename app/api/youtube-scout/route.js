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
    if (data.error) throw new Error(data.error.message);
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

  // ─── SEARCH (channel-first approach) ───
  if (action === "search") {
    const { query, maxResults = 15, finalLimit, publishedAfter, publishedBefore, regionCode, pageToken, videoDuration, minSeconds, maxSeconds } = body;
    const outputLimit = finalLimit || maxResults;
    if (!query) return Response.json({ error: "No query" }, { status: 400 });

    // Extract brand name — remove quotes, country names, and ad keywords
    const cleanQuery = query.replace(/"/g, "");
    const brandName = cleanQuery.split(/\s+(ad|commercial|campaign|banking|business|small|sme|official|canada|united|kingdom|states|australia|spain|france|uk|mexico)/i)[0].trim();

    try {
      let allVideos = [];
      let officialChannelId = null;
      let officialChannelName = null;

      // ─── PHASE 1: Find brand's YouTube channel and list its videos ───
      if (brandName) { try {
        // Search for channel with full context (brand + keywords from query)
        const channelSearchTerms = [brandName];
        // Add non-generic words from query for context
        cleanQuery.split(/\s+/).forEach(w => {
          if (w.length > 3 && w.toLowerCase() !== brandName.toLowerCase() && !/^(ad|commercial|campaign|official)$/i.test(w))
            channelSearchTerms.push(w);
        });

        const channelParams = new URLSearchParams({
          part: "snippet",
          q: channelSearchTerms.slice(0, 3).join(" "),
          type: "channel",
          maxResults: "15",
          key: apiKey,
        });
        const channelRes = await fetch(`https://www.googleapis.com/youtube/v3/search?${channelParams}`);
        const channelData = await channelRes.json();
        const channels = channelData.items || [];

        // Find best matching channel — strict matching
        const brandLower = brandName.toLowerCase().replace(/[^a-z0-9]/g, "");
        const bestChannel = channels.find(ch => {
          const chName = (ch.snippet.channelTitle || "").toLowerCase().replace(/[^a-z0-9]/g, "");
          // Exact match or brand is significant part of channel name
          return chName === brandLower || chName.startsWith(brandLower) || (brandLower.length > 3 && chName.includes(brandLower));
        });

        if (bestChannel) {
          officialChannelId = bestChannel.id.channelId;
          officialChannelName = bestChannel.snippet.channelTitle;

          // Get ALL recent videos from official channel — paginate to get up to 100
          let channelPageToken = undefined;
          const channelTarget = Math.max(outputLimit * 3, 50);
          let channelFetched = 0;
          while (channelFetched < channelTarget) {
            const batchSize = Math.min(50, channelTarget - channelFetched);
            const channelSearchParams = new URLSearchParams({
              part: "snippet",
              channelId: officialChannelId,
              type: "video",
              maxResults: String(batchSize),
              key: apiKey,
              order: "date",
            });
            if (publishedAfter) channelSearchParams.set("publishedAfter", publishedAfter);
            if (channelPageToken) channelSearchParams.set("pageToken", channelPageToken);

            const res = await fetch(`https://www.googleapis.com/youtube/v3/search?${channelSearchParams}`);
            const data = await res.json();
            if (data.error) break;
            const vids = (data.items || []).filter(item => item.id?.videoId).map(item => ({
              videoId: item.id.videoId,
              title: item.snippet.title,
              channel: item.snippet.channelTitle,
              channelId: item.snippet.channelId,
              description: item.snippet.description,
              thumbnail: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.medium?.url,
              publishedAt: item.snippet.publishedAt,
              year: item.snippet.publishedAt?.substring(0, 4),
            }));
            vids.forEach(v => { v.isOfficial = true; v.source = "official"; });
            allVideos.push(...vids);
            channelFetched += vids.length;
            channelPageToken = data.nextPageToken;
            if (!channelPageToken || vids.length === 0) break;
          }
        }
      } catch(e) { console.error("Phase 1 failed:", e.message); } }

      // ─── Pre-filter by duration before Phase 2 decision ───
      let phase1Filtered = [...allVideos];
      if (minSeconds || maxSeconds) {
        // Enrich phase 1 videos to check duration
        phase1Filtered = await enrichWithStats(phase1Filtered);
        const min = minSeconds || 0;
        const max = maxSeconds || 999999;
        phase1Filtered = phase1Filtered.filter(v => v.durationSeconds >= min && v.durationSeconds <= max);
      }

      // ─── PHASE 2: If channel not found, few results, or not enough after duration filter ───
      if (allVideos.length < 3 || phase1Filtered.length < outputLimit) {
        // Use the full original query — this is the fallback
        const generalParams = new URLSearchParams({
          part: "snippet",
          q: cleanQuery,
          type: "video",
          maxResults: String(Math.min(outputLimit, 50)),
          key: apiKey,
          order: "relevance",
        });
        if (publishedAfter) generalParams.set("publishedAfter", publishedAfter);
        if (publishedBefore) generalParams.set("publishedBefore", publishedBefore);
        if (regionCode) generalParams.set("regionCode", regionCode);
        if (videoDuration) generalParams.set("videoDuration", videoDuration);

        const generalVids = await ytSearch(generalParams);
        generalVids.forEach(v => {
          if (officialChannelId && v.channelId === officialChannelId) {
            v.isOfficial = true; v.source = "official";
          } else {
            v.isOfficial = false; v.source = "general";
          }
        });
        allVideos.push(...generalVids);
      }

      // ─── DEDUPLICATE by videoId ───
      const seen = new Set();
      let videos = [];
      allVideos.forEach(v => {
        if (!seen.has(v.videoId)) { seen.add(v.videoId); videos.push(v); }
      });

      // ─── ENRICH with stats ───
      videos = await enrichWithStats(videos);

      // ─── FILTER by duration ───
      if (minSeconds || maxSeconds) {
        const min = minSeconds || 0;
        const max = maxSeconds || 999999;
        videos = videos.filter(v => v.durationSeconds >= min && v.durationSeconds <= max);
      }

      // ─── SORT: official first, then by views ───
      videos.sort((a, b) => {
        if (a.isOfficial && !b.isOfficial) return -1;
        if (!a.isOfficial && b.isOfficial) return 1;
        return (b.viewCount || 0) - (a.viewCount || 0);
      });

      // Trim to output limit
      videos = videos.slice(0, outputLimit);

      return Response.json({
        videos,
        officialChannel: officialChannelName ? { name: officialChannelName, id: officialChannelId } : null,
        totalResults: videos.length,
      });
    } catch (err) {
      const msg = err.message || "";
      if (msg.includes("quota") && apiKeys.length > 1 && apiKey === apiKeys[0]) {
        // Retry with backup key
        apiKey = apiKeys[1];
        try {
          const retryParams = new URLSearchParams({
            part: "snippet", q: query, type: "video",
            maxResults: String(Math.min(maxResults, 50)),
            key: apiKey, order: "relevance",
          });
          if (publishedAfter) retryParams.set("publishedAfter", publishedAfter);
          if (regionCode) retryParams.set("regionCode", regionCode);
          if (videoDuration) retryParams.set("videoDuration", videoDuration);
          let videos = await ytSearch(retryParams);
          videos = await enrichWithStats(videos);
          if (minSeconds || maxSeconds) videos = videos.filter(v => v.durationSeconds >= (minSeconds||0) && v.durationSeconds <= (maxSeconds||999999));
          videos = videos.slice(0, maxResults);
          return Response.json({ videos, totalResults: videos.length });
        } catch(e2) {
          return Response.json({ error: "YouTube API daily limit reached on all keys." }, { status: 429 });
        }
      }
      if (msg.includes("quota")) return Response.json({ error: "YouTube API daily limit reached." }, { status: 429 });
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
