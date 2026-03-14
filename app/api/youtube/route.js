export async function POST(request) {
  const { url } = await request.json();
  if (!url) return Response.json({ error: "No URL" }, { status: 400 });

  const match = url.match(/(?:youtube\.com\/watch\?.*v=|youtu\.be\/)([^&\s]+)/);
  if (!match) return Response.json({ error: "Not a YouTube URL" }, { status: 400 });

  const videoId = match[1];

  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
    const res = await fetch(oembedUrl);
    if (!res.ok) return Response.json({ error: "Could not fetch metadata" }, { status: 500 });
    const data = await res.json();

    return Response.json({
      videoId,
      title: data.title || "",
      author: data.author_name || "",
      thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
