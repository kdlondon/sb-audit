import { fetchTranscriptFor } from "@/lib/transcript-provider";
import { rehost } from "@/lib/ig-media";

// Enrich a single feed item for import WITHOUT a second Apify scrape: the feed already
// gave us caption/thumbnail/kind, so we only re-host the thumbnail to stable storage
// and (for video kinds) fetch the transcript via Supadata (universal: IG reels, TikTok).
const VIDEO_KINDS = new Set(["reel", "video"]);

export async function POST(request) {
  const { url, thumbnail, kind } = await request.json();
  if (!url) return Response.json({ error: "No URL" }, { status: 400 });

  const out = { thumbnail: "", transcript: "" };
  try {
    if (thumbnail) out.thumbnail = await rehost(thumbnail);
  } catch {}

  if (VIDEO_KINDS.has(kind)) {
    try {
      const t = await fetchTranscriptFor(url);
      if (t.transcript) out.transcript = t.transcript;
    } catch {}
  }

  return Response.json(out);
}
