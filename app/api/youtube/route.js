export async function POST(request) {
  const { url } = await request.json();
  if (!url) return Response.json({ error: "No URL" }, { status: 400 });

  const match = url.match(/(?:youtube\.com\/watch\?.*v=|youtu\.be\/)([^&\s]+)/);
  if (!match) return Response.json({ error: "Not a YouTube URL" }, { status: 400 });

  const videoId = match[1];
  const apiKey = process.env.YOUTUBE_API_KEY;
  const result = { videoId };

  // Fetch metadata via YouTube Data API
  if (apiKey) {
    try {
      const apiUrl = `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&key=${apiKey}&part=snippet,contentDetails`;
      const res = await fetch(apiUrl);
      const data = await res.json();
      if (data.items && data.items.length > 0) {
        const snippet = data.items[0].snippet;
        result.title = snippet.title || "";
        result.channel = snippet.channelTitle || "";
        result.description = (snippet.description || "").slice(0, 500);
        result.thumbnail = snippet.thumbnails?.high?.url || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
        result.year = snippet.publishedAt ? snippet.publishedAt.substring(0, 4) : "";
        result.tags = (snippet.tags || []).slice(0, 10);
      }
    } catch {}
  } else {
    // Fallback to oEmbed
    try {
      const res = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
      const data = await res.json();
      result.title = data.title || "";
      result.channel = data.author_name || "";
      result.thumbnail = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
    } catch {}
  }

  // Fetch transcript via YouTube timedtext
  try {
    // First get the video page to find caption tracks
    const pageRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: { "User-Agent": "Mozilla/5.0", "Accept-Language": "en" }
    });
    const pageHtml = await pageRes.text();

    // Extract captions URL from page
    const captionMatch = pageHtml.match(/"captions":\s*(\{.*?"playerCaptionsTracklistRenderer".*?\})\s*,\s*"/s);
    if (captionMatch) {
      try {
        // Find the caption track URL
        const captionData = captionMatch[1];
        const urlMatch = captionData.match(/"baseUrl"\s*:\s*"(https?:[^"]+)"/);
        if (urlMatch) {
          let captionUrl = urlMatch[1].replace(/\\u0026/g, "&");
          // Fetch the XML captions
          const captionRes = await fetch(captionUrl);
          const captionXml = await captionRes.text();
          // Extract text from XML
          const textMatches = captionXml.match(/<text[^>]*>([^<]*)<\/text>/g);
          if (textMatches) {
            const transcript = textMatches
              .map(t => t.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;/g, "'").replace(/&quot;/g, '"'))
              .join(" ")
              .replace(/\s+/g, " ")
              .trim()
              .slice(0, 2000);
            result.transcript = transcript;
          }
        }
      } catch {}
    }
  } catch {}

  return Response.json(result);
}
