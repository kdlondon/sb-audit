import { fetchTranscriptFor } from "@/lib/transcript-provider";
import { rehost } from "@/lib/ig-media";

// Enrich a single feed item for import WITHOUT a second Apify scrape (the feed already
// gave us caption/thumbnail/kind): re-host the thumbnail to stable storage and (for
// video kinds) fetch the transcript via Supadata (universal: IG reels, TikTok).
// Fallback: the IG/TikTok profile listing intermittently omits the thumbnail for some
// posts, so if it's missing we re-scrape just that one post (which reliably has it).
const VIDEO_KINDS = new Set(["reel", "video"]);

async function fetchSingleThumb(platform, url) {
  const token = process.env.APIFY_TOKEN;
  if (!token || !url) return "";
  try {
    let actor, body;
    if (platform === "tiktok") {
      actor = "clockworks~tiktok-scraper";
      body = { postURLs: [url], resultsPerPage: 1, shouldDownloadCovers: false };
    } else {
      actor = "apify~instagram-scraper";
      body = { directUrls: [url], resultsType: "posts", resultsLimit: 1, addParentData: false };
    }
    const res = await fetch(`https://api.apify.com/v2/acts/${actor}/run-sync-get-dataset-items?token=${token}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    const items = await res.json();
    const x = Array.isArray(items) ? items[0] : null;
    if (!x) return "";
    return x.displayUrl || (x.images && x.images[0]) || x.videoMeta?.coverUrl || x.videoMeta?.originalCoverUrl || "";
  } catch { return ""; }
}

export async function POST(request) {
  const { platform = "instagram", url, thumbnail, kind } = await request.json();
  if (!url) return Response.json({ error: "No URL" }, { status: 400 });

  let rawThumb = thumbnail;
  if (!rawThumb) rawThumb = await fetchSingleThumb(platform, url); // feed dropped it → recover

  const out = { thumbnail: "", transcript: "" };
  try {
    if (rawThumb) out.thumbnail = await rehost(rawThumb);
  } catch {}

  if (VIDEO_KINDS.has(kind)) {
    try {
      const t = await fetchTranscriptFor(url);
      if (t.transcript) out.transcript = t.transcript;
    } catch {}
  }

  return Response.json(out);
}
