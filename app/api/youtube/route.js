import { requireAuth } from "@/lib/api-auth";
import { fetchTranscript } from "@/lib/transcript-provider";
import { createClient } from "@supabase/supabase-js";

export async function POST(request) {
  // const denied = await requireAuth(request); // TODO: fix auth with Supabase SSR
  // if (denied) return denied;

  const { url } = await request.json();
  if (!url) return Response.json({ error: "No URL" }, { status: 400 });

  const match = url.match(/(?:youtube\.com\/watch\?.*v=|youtu\.be\/)([^&\s]+)/);
  if (!match) return Response.json({ error: "Not a YouTube URL" }, { status: 400 });

  const videoId = match[1];
  const apiKey = process.env.YOUTUBE_API_KEY;
  const result = { videoId };

  if (apiKey) {
    try {
      const apiUrl = `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&key=${apiKey}&part=snippet,contentDetails`;
      const res = await fetch(apiUrl);
      const data = await res.json();
      if (data.items && data.items.length > 0) {
        const snippet = data.items[0].snippet;
        result.title = snippet.title || "";
        result.channel = snippet.channelTitle || "";
        result.description = snippet.description || "";
        result.thumbnail = snippet.thumbnails?.high?.url || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
        result.year = snippet.publishedAt ? snippet.publishedAt.substring(0, 4) : "";
        result.tags = (snippet.tags || []).slice(0, 10);
      }
    } catch {}
  } else {
    try {
      const res = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
      const data = await res.json();
      result.title = data.title || "";
      result.channel = data.author_name || "";
      result.thumbnail = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
    } catch {}
  }

  // ── Transcript (auto) — cached in youtube_transcripts to avoid re-paying the provider.
  // Non-blocking: any failure (no key, no captions) just leaves transcript empty.
  try {
    const sUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const sKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const admin = (sUrl && sKey) ? createClient(sUrl, sKey, { auth: { persistSession: false } }) : null;

    let transcript = "";
    if (admin) {
      const { data: cached } = await admin.from("youtube_transcripts").select("transcript").eq("video_id", videoId).maybeSingle();
      if (cached?.transcript) transcript = cached.transcript;
    }
    if (!transcript) {
      const r = await fetchTranscript(`https://www.youtube.com/watch?v=${videoId}`);
      if (r.transcript) {
        transcript = r.transcript;
        if (admin) await admin.from("youtube_transcripts").upsert({
          video_id: videoId, transcript, language: r.language || "",
          provider: process.env.TRANSCRIPT_PROVIDER || "supadata", fetched_at: new Date().toISOString(),
        });
      }
    }
    if (transcript) result.transcript = transcript;
  } catch {}

  return Response.json(result);
}
