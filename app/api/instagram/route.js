import { fetchTranscriptFor } from "@/lib/transcript-provider";

// Fetch a single Instagram post/reel via the Apify Instagram Scraper, and (for reels)
// its transcript via Supadata. Returns normalized fields for the audit autofill.
// Needs env: APIFY_TOKEN (+ TRANSCRIPT_API_KEY for reel transcription).
export async function POST(request) {
  const { url } = await request.json();
  if (!url) return Response.json({ error: "No URL" }, { status: 400 });
  if (!/instagram\.com/i.test(url)) return Response.json({ error: "Not an Instagram URL" }, { status: 400 });

  const token = process.env.APIFY_TOKEN;
  if (!token) return Response.json({ error: "Instagram capture not configured (missing APIFY_TOKEN)" }, { status: 500 });

  try {
    const res = await fetch(`https://api.apify.com/v2/acts/apify~instagram-scraper/run-sync-get-dataset-items?token=${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ directUrls: [url], resultsType: "posts", resultsLimit: 1, addParentData: false }),
    });
    const items = await res.json();
    if (!res.ok) return Response.json({ error: items?.error?.message || `Apify error ${res.status}` }, { status: 500 });
    const item = Array.isArray(items) ? items[0] : null;
    if (!item) return Response.json({ error: "No data found for that URL" }, { status: 404 });

    const isReel = item.type === "Video" || item.productType === "clips" || !!item.videoUrl;
    const result = {
      platform: "instagram",
      kind: isReel ? "reel" : "post",
      caption: item.caption || "",
      thumbnail: item.displayUrl || (item.images && item.images[0]) || "",
      videoUrl: item.videoUrl || "",
      owner: item.ownerUsername || item.ownerFullName || "",
      likes: item.likesCount ?? null,
      comments: item.commentsCount ?? null,
      views: item.videoViewCount ?? item.videoPlayCount ?? null,
      year: item.timestamp ? String(item.timestamp).slice(0, 4) : "",
      url,
    };

    // Reels → transcript via Supadata (universal endpoint supports Instagram)
    if (isReel) {
      try {
        const t = await fetchTranscriptFor(url);
        if (t.transcript) result.transcript = t.transcript;
      } catch {}
    }

    return Response.json(result);
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
