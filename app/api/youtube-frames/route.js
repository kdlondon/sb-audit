import { requireAuth } from "@/lib/api-auth";

export async function POST(request) {
  // const denied = await requireAuth(request); // TODO: fix auth with Supabase SSR
  // if (denied) return denied;

  const { videoId } = await request.json();
  if (!videoId) return Response.json({ error: "No videoId" }, { status: 400 });

  try {
    // Fetch the YouTube watch page to extract storyboard spec
    const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    const html = await res.text();

    // Extract storyboard spec from ytInitialPlayerResponse
    const specMatch = html.match(/"playerStoryboardSpecRenderer"\s*:\s*\{\s*"spec"\s*:\s*"([^"]+)"/);
    if (!specMatch) {
      // Try alternative pattern
      const altMatch = html.match(/storyboards.*?spec.*?"(https?:\/\/[^"]+)"/);
      if (!altMatch) {
        return Response.json({ error: "Could not find storyboard data", frames: [] });
      }
    }

    const specStr = specMatch ? specMatch[1] : "";
    // Spec format: baseUrl|...more levels separated by |
    // Each level: url#width#height#count#cols#rows#...#sigh
    const levels = specStr.split("|");

    // Use the highest quality level (last one, typically L2)
    // But L1 has more frames at smaller size, which is good for our use case
    const storyboards = [];

    for (let li = 0; li < levels.length; li++) {
      const parts = levels[li].split("#");
      if (parts.length < 6) continue;

      let baseUrl = parts[0];
      const width = parseInt(parts[1]) || 160;
      const height = parseInt(parts[2]) || 90;
      const count = parseInt(parts[3]) || 0;
      const cols = parseInt(parts[4]) || 10;
      const rows = parseInt(parts[5]) || 10;
      const sigh = parts[7] || "";

      // Fix URL encoding
      baseUrl = baseUrl.replace(/\\u0026/g, "&");

      // Calculate number of sprite sheets
      const framesPerSheet = cols * rows;
      const sheetCount = Math.ceil(count / framesPerSheet);

      storyboards.push({
        level: li,
        width,
        height,
        count,
        cols,
        rows,
        framesPerSheet,
        sheetCount,
        baseUrl,
        sigh,
      });
    }

    // Pick the best level — prefer higher resolution but not too many frames
    // Level 0 is usually 48x27, Level 1 is 80x45, Level 2 is 160x90
    const best = storyboards.length > 0 ? storyboards[storyboards.length - 1] : null;

    if (!best) {
      return Response.json({ error: "No storyboard levels found", frames: [] });
    }

    // Generate sprite sheet URLs
    const spriteUrls = [];
    for (let i = 0; i < Math.min(best.sheetCount, 5); i++) {
      let url = best.baseUrl.replace("$M", String(i));
      if (best.sigh) url = url.replace(/&sigh=[^&]*/, `&sigh=${best.sigh}`);
      // Fix escaped characters
      url = url.replace(/\\u0026/g, "&");
      spriteUrls.push(url);
    }

    return Response.json({
      storyboard: {
        width: best.width,
        height: best.height,
        cols: best.cols,
        rows: best.rows,
        count: best.count,
        framesPerSheet: best.framesPerSheet,
        spriteUrls,
      },
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
