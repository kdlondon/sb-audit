// List recent posts/reels from an Instagram profile via the Apify Instagram Scraper.
// Used by the shared <InstagramFeedPicker> (Scout + Audit) to browse a competitor's
// feed and bulk-select pieces to import as entries.
// Needs env: APIFY_TOKEN.

function normalizeHandle(input) {
  if (!input) return "";
  let h = String(input).trim();
  // Accept a full profile URL or a bare @handle / handle
  const m = h.match(/instagram\.com\/([^/?#]+)/i);
  if (m) h = m[1];
  h = h.replace(/^@/, "").replace(/\/+$/, "");
  return h;
}

function kindOf(item) {
  if (item.type === "Video" || item.productType === "clips" || !!item.videoUrl) return "reel";
  if (item.type === "Sidecar" || (Array.isArray(item.childPosts) && item.childPosts.length > 1)) return "carousel";
  return "post";
}

export async function POST(request) {
  const { handle, limit = 12 } = await request.json();
  const username = normalizeHandle(handle);
  if (!username) return Response.json({ error: "Enter an Instagram @handle or profile URL" }, { status: 400 });

  const token = process.env.APIFY_TOKEN;
  if (!token) return Response.json({ error: "Instagram capture not configured (missing APIFY_TOKEN)" }, { status: 500 });

  const resultsLimit = Math.min(Math.max(parseInt(limit, 10) || 12, 1), 48);

  try {
    const res = await fetch(`https://api.apify.com/v2/acts/apify~instagram-scraper/run-sync-get-dataset-items?token=${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        directUrls: [`https://www.instagram.com/${username}/`],
        resultsType: "posts",
        resultsLimit,
        addParentData: false,
      }),
    });
    const items = await res.json();
    if (!res.ok) return Response.json({ error: items?.error?.message || `Apify error ${res.status}` }, { status: 500 });
    if (!Array.isArray(items)) return Response.json({ error: "Unexpected response from Instagram" }, { status: 500 });

    const posts = items
      .filter((x) => x && x.url)
      .map((x) => ({
        url: x.url,
        shortCode: x.shortCode || "",
        kind: kindOf(x),
        caption: x.caption || "",
        thumbnail: x.displayUrl || (x.images && x.images[0]) || "",
        owner: x.ownerUsername || username,
        likes: x.likesCount ?? null,
        comments: x.commentsCount ?? null,
        timestamp: x.timestamp || "",
        year: x.timestamp ? String(x.timestamp).slice(0, 4) : "",
      }));

    return Response.json({ handle: username, count: posts.length, posts });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
