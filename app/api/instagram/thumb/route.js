// Lightweight image proxy for Instagram CDN thumbnails. IG image URLs are
// hotlink-restricted, so they 403 when loaded directly in an <img>. We stream
// them server-side for grid previews only (permanent re-hosting happens at import).

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const u = searchParams.get("u");
  const allowed = u && /^https:\/\/[^/]*(cdninstagram\.com|fbcdn\.net)\//i.test(u);
  if (!allowed) return new Response("Bad image url", { status: 400 });
  try {
    const r = await fetch(u, { headers: { "User-Agent": "Mozilla/5.0", Referer: "https://www.instagram.com/" } });
    if (!r.ok) return new Response("Upstream error", { status: 502 });
    const buf = Buffer.from(await r.arrayBuffer());
    return new Response(buf, {
      status: 200,
      headers: {
        "Content-Type": r.headers.get("content-type") || "image/jpeg",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch {
    return new Response("Fetch failed", { status: 502 });
  }
}
