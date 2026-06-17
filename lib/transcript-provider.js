// Provider-agnostic transcript fetcher. Default: Supadata (supadata.ai).
// Configure via env: TRANSCRIPT_PROVIDER (default "supadata") + TRANSCRIPT_API_KEY.
// Supadata also supports TikTok / Instagram / X / Facebook via the same key (see fetchTranscriptFor).

function toPlainText(data) {
  if (!data) return "";
  if (typeof data.content === "string") return data.content.trim();
  if (Array.isArray(data.content)) return data.content.map(c => c.text || "").join(" ").trim();
  return "";
}

async function supadata(endpoint, key, lang) {
  const sep = endpoint.includes("?") ? "&" : "?";
  const url = `${endpoint}${sep}text=true${lang ? `&lang=${encodeURIComponent(lang)}` : ""}`;
  // Supadata 500s are frequently transient (esp. IG reels / TikTok) — retry a few times.
  let res = await fetch(url, { headers: { "x-api-key": key } });
  for (let attempt = 0; attempt < 3 && res.status === 500; attempt++) {
    await new Promise(r => setTimeout(r, 1500 * (attempt + 1)));
    res = await fetch(url, { headers: { "x-api-key": key } });
  }

  // Async job (rare) — poll briefly.
  if (res.status === 202) {
    const { jobId } = await res.json().catch(() => ({}));
    if (!jobId) return { transcript: "", error: "processing" };
    for (let i = 0; i < 8; i++) {
      await new Promise(r => setTimeout(r, 1500));
      const jr = await fetch(`https://api.supadata.ai/v1/transcript/${jobId}`, { headers: { "x-api-key": key } });
      if (jr.ok) {
        const jd = await jr.json().catch(() => ({}));
        if (jd.status === "completed" || jd.content) return { transcript: toPlainText(jd), language: jd.lang || "" };
        if (jd.status === "failed") return { transcript: "", error: "job_failed" };
      }
    }
    return { transcript: "", error: "job_timeout" };
  }

  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    return { transcript: "", error: e.error || e.message || `http_${res.status}` };
  }
  const data = await res.json();
  return { transcript: toPlainText(data), language: data.lang || "" };
}

// YouTube transcript by url or videoId.
export async function fetchTranscript(urlOrId, { lang } = {}) {
  const provider = process.env.TRANSCRIPT_PROVIDER || "supadata";
  const key = process.env.TRANSCRIPT_API_KEY;
  if (!key) return { transcript: "", error: "no_api_key" };
  const param = /^https?:\/\//.test(urlOrId) ? `url=${encodeURIComponent(urlOrId)}` : `videoId=${encodeURIComponent(urlOrId)}`;
  if (provider === "supadata") return supadata(`https://api.supadata.ai/v1/youtube/transcript?${param}`, key, lang);
  return { transcript: "", error: "unknown_provider" };
}

// Universal transcript (YouTube, TikTok, Instagram, X, Facebook) — for future RRSS use.
export async function fetchTranscriptFor(url, { lang } = {}) {
  const provider = process.env.TRANSCRIPT_PROVIDER || "supadata";
  const key = process.env.TRANSCRIPT_API_KEY;
  if (!key) return { transcript: "", error: "no_api_key" };
  if (provider === "supadata") return supadata(`https://api.supadata.ai/v1/transcript?url=${encodeURIComponent(url)}`, key, lang);
  return { transcript: "", error: "unknown_provider" };
}
