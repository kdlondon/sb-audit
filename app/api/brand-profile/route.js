import { requireAuth } from "@/lib/api-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request) {
  // const denied = await requireAuth(request); // TODO: fix auth with Supabase SSR
  // if (denied) return denied;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) return Response.json({ error: "API key not configured" }, { status: 500 });

  const { url, extraUrls, instructions, brandName, projectId, brand_id } = await request.json();
  if (!url) return Response.json({ error: "URL required" }, { status: 400 });
  const allInputUrls = [url, ...(extraUrls || [])].filter(u => u && u.trim());

  try {
    // ─── PHASE 1: Crawl the site ───
    const pages = [];
    const visited = new Set();
    const baseUrl = new URL(url).origin;

    // Fetch a page and extract text + links
    async function fetchPage(pageUrl, label) {
      if (visited.has(pageUrl) || pages.length >= 12) return;
      visited.add(pageUrl);

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        const res = await fetch(pageUrl, {
          headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" },
          signal: controller.signal,
          redirect: "follow",
        });
        clearTimeout(timeout);

        if (!res.ok) return;
        const html = await res.text();

        // Extract text content (strip tags)
        const textContent = html
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
          .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
          .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "")
          .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "")
          .replace(/<[^>]+>/g, " ")
          .replace(/&nbsp;/g, " ")
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&#\d+;/g, "")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 8000);

        // Extract internal links
        const linkRegex = /href="([^"]+)"/gi;
        const links = [];
        let match;
        while ((match = linkRegex.exec(html)) !== null) {
          let href = match[1];
          if (href.startsWith("/")) href = baseUrl + href;
          if (href.startsWith(baseUrl) && !visited.has(href) && !href.match(/\.(pdf|jpg|png|svg|css|js|woff|woff2|ttf|eot|ico|gif|webp|mp4|zip)/i) && !href.includes("/assets/") && !href.includes("/fonts/") && !href.includes("/static/")) {
            links.push(href);
          }
        }

        // Extract meta description and title
        const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
        const metaDescMatch = html.match(/<meta[^>]*name="description"[^>]*content="([^"]*)"[^>]*>/i);

        pages.push({
          url: pageUrl,
          label: label || pageUrl.replace(baseUrl, "") || "/",
          title: titleMatch?.[1]?.trim() || "",
          metaDescription: metaDescMatch?.[1]?.trim() || "",
          text: textContent,
          links: links.slice(0, 20),
        });
      } catch (err) {
        // Skip failed pages
      }
    }

    // Start with all provided URLs
    for (const inputUrl of allInputUrls) {
      const label = inputUrl === url ? "Main page" : inputUrl.replace(baseUrl, "") || inputUrl;
      await fetchPage(inputUrl, label);
    }

    // Find and crawl key pages
    const mainLinks = pages[0]?.links || [];
    const keyPatterns = [
      { pattern: /\/(about|who-we-are|our-story|company)/i, label: "About" },
      { pattern: /\/(products?|services?|solutions?|offerings?)/i, label: "Products & Services" },
      { pattern: /\/(business|small-business|sme|commercial|enterprise)/i, label: "Business" },
      { pattern: /\/(pricing|plans?|rates?)/i, label: "Pricing" },
      { pattern: /\/(features?|benefits?|why)/i, label: "Features" },
    ];

    for (const { pattern, label } of keyPatterns) {
      const found = mainLinks.find(link => pattern.test(link));
      if (found) await fetchPage(found, label);
    }

    // If we have few pages, grab a couple more links
    if (pages.length < 4) {
      for (const link of mainLinks.slice(0, 5)) {
        if (pages.length >= 5) break;
        if (!visited.has(link) && !link.includes("#") && !link.match(/\.(pdf|jpg|png|svg|css|js|woff|woff2|ttf|eot|ico|gif|webp|mp4|mp3|zip)/i) && !link.includes("/assets/") && !link.includes("/fonts/") && !link.includes("/static/")) {
          await fetchPage(link, link.replace(baseUrl, ""));
        }
      }
    }

    if (pages.length === 0) {
      return Response.json({ error: "Could not fetch any content from this URL" }, { status: 400 });
    }

    // ─── PHASE 2: Analyze with Claude ───
    const siteContent = pages.map(p =>
      `--- PAGE: ${p.label} (${p.url}) ---\nTitle: ${p.title}\nMeta: ${p.metaDescription}\n\n${p.text}`
    ).join("\n\n");

    const system = `You are a senior brand strategist analyzing a competitor's website to build a comprehensive brand profile.

${instructions ? `SPECIFIC INSTRUCTIONS FROM ANALYST: ${instructions}\n` : ""}
${brandName ? `BRAND NAME: ${brandName}\n` : ""}

Analyze the website content and extract a structured brand profile. Return ONLY valid JSON with these fields:

{
  "brand_name": "Official brand name",
  "tagline": "Main tagline or slogan",
  "description": "2-3 sentence description of what the brand does",
  "category": "Industry category (e.g., Traditional Banking, Fintech, Neobank, etc.)",
  "target_audience": "Who they target — demographics, psychographics",
  "value_proposition": "Main value proposition in 1-2 sentences",
  "key_products": ["Product/service 1", "Product/service 2", ...],
  "key_messages": ["Core message 1", "Core message 2", ...],
  "brand_personality": "Brand personality traits (3-5 words)",
  "tone_of_voice": "How they communicate (e.g., Professional, Friendly, Bold)",
  "brand_archetype": "Primary brand archetype (e.g., Hero, Sage, Explorer)",
  "positioning": "How they position themselves vs competitors",
  "differentiators": ["What makes them different 1", "What makes them different 2", ...],
  "brand_territory": "Primary brand territory/theme",
  "emotional_benefit": "The emotional benefit they promise",
  "rational_benefit": "The rational/functional benefit they deliver",
  "visual_identity": "Description of visual style, colors, imagery approach",
  "content_themes": ["Recurring content theme 1", "Theme 2", ...],
  "strengths": ["Strength 1", "Strength 2", ...],
  "weaknesses": ["Weakness/gap 1", "Gap 2", ...],
  "summary": "Strategic summary paragraph — what this brand is doing well and where opportunities exist"
}`;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4000,
        system,
        messages: [{ role: "user", content: `Analyze this website content (${pages.length} pages crawled):\n\n${siteContent.slice(0, 30000)}` }],
      }),
    });

    const data = await res.json();
    const text = data.content?.[0]?.text || "";

    let profile;
    try {
      profile = JSON.parse(text);
    } catch {
      const m = text.match(/\{[\s\S]*\}/);
      if (m) profile = JSON.parse(m[0]);
      else return Response.json({ error: "Could not parse AI response" }, { status: 500 });
    }

    return Response.json({
      success: true,
      profile,
      pagesCrawled: pages.map(p => ({ url: p.url, label: p.label, title: p.title })),
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
