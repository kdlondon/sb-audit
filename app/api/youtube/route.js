export async function POST(request) {
  const { url } = await request.json();
  if (!url) return Response.json({ error: "No URL" }, { status: 400 });

  const match = url.match(/(?:youtube\.com\/watch\?.*v=|youtu\.be\/)([^&\s]+)/);
  if (!match) return Response.json({ error: "Not a YouTube URL" }, { status: 400 });

  const videoId = match[1];
  const apiKey = process.env.YOUTUBE_API_KEY;

  if (!apiKey) {
    // Fallback to oEmbed if no API key
    try {
      const res = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
      const data = await res.json();
      return Response.json({
        videoId,
        title: data.title || "",
        channel: data.author_name || "",
        thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      });
    } catch (err) {
      return Response.json({ error: err.message }, { status: 500 });
    }
  }

  try {
    const apiUrl = `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&key=${apiKey}&part=snippet,contentDetails`;
    const res = await fetch(apiUrl);
    const data = await res.json();

    if (!data.items || data.items.length === 0) {
      return Response.json({ error: "Video not found" }, { status: 404 });
    }

    const snippet = data.items[0].snippet;
    const publishDate = snippet.publishedAt || "";
    const year = publishDate ? publishDate.substring(0, 4) : "";

    return Response.json({
      videoId,
      title: snippet.title || "",
      channel: snippet.channelTitle || "",
      description: snippet.description || "",
      thumbnail: snippet.thumbnails?.high?.url || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      year,
      publishDate,
      tags: (snippet.tags || []).slice(0, 10),
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
