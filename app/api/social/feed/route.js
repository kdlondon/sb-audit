// List recent posts/videos from a social profile via Apify. Multi-platform: the
// shared <SocialFeedPicker> (Audit + Scout) calls this to browse a competitor's feed
// and bulk-select pieces to import as entries.
// Needs env: APIFY_TOKEN.

function handleFromInput(input, host) {
  if (!input) return "";
  let h = String(input).trim();
  const re = new RegExp(`${host}\\/@?([^/?#]+)`, "i");
  const m = h.match(re);
  if (m) h = m[1];
  return h.replace(/^@/, "").replace(/\/+$/, "");
}

function igKind(x) {
  if (x.type === "Video" || x.productType === "clips" || !!x.videoUrl) return "reel";
  if (x.type === "Sidecar" || (Array.isArray(x.childPosts) && x.childPosts.length > 1)) return "carousel";
  return "post";
}

const PLATFORMS = {
  instagram: {
    actor: "apify~instagram-scraper",
    handle: (input) => handleFromInput(input, "instagram\\.com"),
    // addParentData attaches the profile object to each post → gives us follower count.
    input: (username, limit) => ({ directUrls: [`https://www.instagram.com/${username}/`], resultsType: "posts", resultsLimit: limit, addParentData: true }),
    normalize: (x, username) => (x && x.url ? {
      url: x.url,
      kind: igKind(x),
      caption: x.caption || "",
      thumbnail: x.displayUrl || (x.images && x.images[0]) || "",
      owner: x.ownerUsername || username,
      followers: x.ownerFollowersCount ?? x.followersCount ?? x.parentData?.followersCount ?? null,
      likes: x.likesCount ?? null,
      comments: x.commentsCount ?? null,
      views: x.videoViewCount ?? x.videoPlayCount ?? null,
      hashtags: Array.isArray(x.hashtags) ? x.hashtags : [],
      timestamp: x.timestamp || "",
      year: x.timestamp ? String(x.timestamp).slice(0, 4) : "",
    } : null),
  },
  tiktok: {
    actor: "clockworks~tiktok-scraper",
    handle: (input) => handleFromInput(input, "tiktok\\.com"),
    input: (username, limit) => ({ profiles: [username], resultsPerPage: limit, profileScrapeSections: ["videos"], profileSorting: "latest", excludePinnedPosts: false }),
    normalize: (x, username) => (x && x.webVideoUrl ? {
      url: x.webVideoUrl,
      kind: x.isSlideshow ? "slideshow" : "video",
      caption: x.text || "",
      thumbnail: x.videoMeta?.coverUrl || x.videoMeta?.originalCoverUrl || "",
      owner: x.authorMeta?.name || x.authorMeta?.nickName || username,
      followers: x.authorMeta?.fans ?? x.authorMeta?.followerCount ?? null,
      likes: x.diggCount ?? null,
      comments: x.commentCount ?? null,
      views: x.playCount ?? null,
      hashtags: Array.isArray(x.hashtags) ? x.hashtags.map((h) => (typeof h === "string" ? h : h?.name)).filter(Boolean) : [],
      timestamp: x.createTimeISO || "",
      year: x.createTimeISO ? String(x.createTimeISO).slice(0, 4) : "",
    } : null),
  },
};

export async function POST(request) {
  const { platform = "instagram", handle, limit = 12 } = await request.json();
  const cfg = PLATFORMS[platform];
  if (!cfg) return Response.json({ error: `Unsupported platform: ${platform}` }, { status: 400 });

  const username = cfg.handle(handle);
  if (!username) return Response.json({ error: "Enter a @handle or profile URL" }, { status: 400 });

  const token = process.env.APIFY_TOKEN;
  if (!token) return Response.json({ error: "Social capture not configured (missing APIFY_TOKEN)" }, { status: 500 });

  const resultsLimit = Math.min(Math.max(parseInt(limit, 10) || 12, 1), 48);

  try {
    const res = await fetch(`https://api.apify.com/v2/acts/${cfg.actor}/run-sync-get-dataset-items?token=${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cfg.input(username, resultsLimit)),
    });
    const items = await res.json();
    if (!res.ok) return Response.json({ error: items?.error?.message || `Apify error ${res.status}` }, { status: 500 });
    if (!Array.isArray(items)) return Response.json({ error: "Unexpected response from the scraper" }, { status: 500 });

    // Surface a clean "profile not found" message (some actors return an error item)
    const notFound = items.find((x) => x && (x.errorCode === "NOT_FOUND" || /does not exist/i.test(x.error || "")));
    if (notFound && items.length === 1) return Response.json({ error: `Profile @${username} not found` }, { status: 404 });

    const posts = items.map((x) => cfg.normalize(x, username)).filter(Boolean);
    return Response.json({ platform, handle: username, count: posts.length, posts });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
