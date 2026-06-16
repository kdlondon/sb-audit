// Image proxy for social CDN thumbnails (Instagram + TikTok). Their image URLs are
// hotlink-restricted/signed, so they 403 when loaded directly in an <img>. We stream
// them server-side for grid previews only (permanent re-hosting happens at import).

const ALLOWED = /^https:\/\/[^/]*(cdninstagram\.com|fbcdn\.net|tiktokcdn\.com|tiktokcdn-us\.com|ibyteimg\.com|byteimg\.com)\//i;

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const u = searchParams.get("u");
  if (!u || !ALLOWED.test(u)) return new Response("Bad image url", { status: 400 });
  const referer = /tiktok|byteimg|ibyteimg/i.test(u) ? "https://www.tiktok.com/" : "https://www.instagram.com/";
  try {
    const r = await fetch(u, { headers: { "User-Agent": "Mozilla/5.0", Referer: referer } });
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
