// Meta Ad Library connector. Discovery lives in Scout (a "Meta Ads" tab), but a paid ad is
// a distinct kind of evidence, not a social post with extra metadata — so it enters tagged
// source_type='paid' / source_platform='meta_ads', with an observed `_ads` block (facts from
// Apify) kept separate from anything the AI will later infer. See Orden 140726 · D1/D4.
//
// Two actions (mirrors the social feed → import split, so the Apify run happens ONCE per
// search, not again on import):
//   action:"search"  → run the actor for a brand's Ad Library URL, return normalized ads.
//   action:"import"  → insert the selected (already-normalized) ads, deduped by source_ref.
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const maxDuration = 120; // the actor run is the slow part (~45s for 30 ads)

const APIFY_ACTOR = "apify~facebook-ads-scraper";

// unix seconds OR ms → ms
const toMs = (n) => (n ? (Number(n) < 1e12 ? Number(n) * 1000 : Number(n)) : null);
const isTemplate = (t) => typeof t === "string" && /\{\{.*\}\}/.test(t);
const clean = (s) => String(s || "").replace(/\s+/g, " ").trim();

// One Apify record → our normalized ad shape (the `_ads` fields + display fields).
function normalizeAd(rec, fallbackCountry) {
  const s = rec.snapshot || {};
  const cards = Array.isArray(s.cards) ? s.cards : [];
  const videos = Array.isArray(s.videos) ? s.videos : [];
  const images = Array.isArray(s.images) ? s.images : [];
  const c0 = cards[0] || {};

  // DCO ads carry {{template}} placeholders at snapshot level; the real copy lives in cards.
  const bodyText = s.body && typeof s.body === "object" ? s.body.text : s.body;
  const ad_text = clean(!isTemplate(bodyText) && bodyText ? bodyText : (c0.body || c0.title || ""));
  const title = clean(!isTemplate(s.title) && s.title ? s.title : (c0.title || ""));

  const creative_url = videos[0]?.videoHdUrl || videos[0]?.videoSdUrl
    || c0.videoHdUrl || c0.originalImageUrl || c0.resizedImageUrl
    || images[0]?.originalImageUrl || images[0]?.resizedImageUrl || "";
  const thumbnail = videos[0]?.videoPreviewImageUrl || c0.originalImageUrl || c0.resizedImageUrl
    || images[0]?.originalImageUrl || creative_url || "";

  const startMs = toMs(rec.startDate);
  const endMs = toMs(rec.endDate);
  const is_active = !!rec.isActive;
  const days_running = startMs ? Math.max(1, Math.round(((is_active ? Date.now() : (endMs || Date.now())) - startMs) / 86400000)) : null;
  const platforms = Array.isArray(rec.publisherPlatform) ? rec.publisherPlatform : [];
  const library_id = rec.adArchiveID || rec.adArchiveId || "";

  return {
    library_id,
    advertiser_name: clean(s.pageName || rec.pageName || ""),
    ad_text, title,
    cta_text: clean(s.ctaText || c0.ctaText || ""),
    creative_url, thumbnail,
    creative_format: s.displayFormat || "",
    start_date: rec.startDateFormatted || (startMs ? new Date(startMs).toISOString() : null),
    end_date: rec.endDateFormatted || (endMs ? new Date(endMs).toISOString() : null),
    is_active, days_running,
    variant_count: rec.collationCount || 1,
    serving_platforms: platforms,
    countries: (Array.isArray(rec.targetedOrReachedCountries) && rec.targetedOrReachedCountries.length)
      ? rec.targetedOrReachedCountries : (fallbackCountry ? [fallbackCountry] : []),
    link_url: clean(s.linkUrl || c0.linkUrl || ""),
    permalink: library_id ? `https://www.facebook.com/ads/library/?id=${library_id}` : "",
  };
}

// The social surface of an ad, so section 05 still fires for it (D4): pick the primary
// consumer-facing platform from the serving list.
const socialPlatform = (serving) => {
  const set = new Set((serving || []).map((p) => String(p).toUpperCase()));
  if (set.has("INSTAGRAM")) return "Instagram";
  if (set.has("FACEBOOK")) return "Facebook";
  return "";
};

// Normalized ad → creative_source row (matches the SocialFeedPicker convention).
function buildRow(ad, ctx, i) {
  const { projectId, scope, brandId, orgId, createdBy, country } = ctx;
  const year = ad.start_date ? String(ad.start_date).slice(0, 4) : "";
  const owner = ad.advertiser_name || "";
  const row = {
    id: `${Date.now()}_${i}_${Math.random().toString(36).slice(2, 5)}`,
    project_id: projectId,
    scope,
    type: "Paid ad",
    url: ad.permalink,
    brand_name: owner,
    description: ad.title || ad.ad_text.slice(0, 120),
    synopsis: ad.ad_text,
    image_url: ad.thumbnail || "",
    year,
    country: country || (ad.countries[0] || ""),
    created_by: createdBy || "",
    brand_id: brandId || null,
    organization_id: orgId || null,
    source_platform: "meta_ads",
    source_type: "paid",
    source_ref: ad.library_id,
    updated_at: new Date().toISOString(),
    custom_dimensions: {
      _social: { format: ad.creative_format || "", platform: socialPlatform(ad.serving_platforms) },
      _meta: { platform: "meta_ads", caption: ad.ad_text, posted_at: ad.start_date || "" },
      _ads: {
        library_id: ad.library_id,
        advertiser_name: ad.advertiser_name,
        ad_text: ad.ad_text,
        cta_text: ad.cta_text,
        creative_url: ad.creative_url,
        creative_format: ad.creative_format,
        start_date: ad.start_date,
        end_date: ad.end_date,
        is_active: ad.is_active,
        days_running: ad.days_running,
        variant_count: ad.variant_count,
        serving_platforms: ad.serving_platforms,
        countries: ad.countries,
        link_url: ad.link_url,
        captured_at: new Date().toISOString(),
      },
    },
  };
  if (scope === "global") row.brand = owner; else row.competitor = owner;
  return row;
}

export async function POST(request) {
  const body = await request.json();
  const action = body.action || "search";

  if (action === "search") {
    const { url, limit = 30, active_status = "" } = body;
    if (!url) return Response.json({ error: "Ad Library URL required" }, { status: 400 });
    const token = process.env.APIFY_TOKEN;
    if (!token) return Response.json({ error: "APIFY_TOKEN not configured" }, { status: 500 });
    try {
      const resp = await fetch(`https://api.apify.com/v2/acts/${APIFY_ACTOR}/run-sync-get-dataset-items?token=${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startUrls: [{ url }],
          resultsLimit: Math.min(Math.max(parseInt(limit, 10) || 30, 1), 100),
          activeStatus: active_status, // "" = active + inactive
          isDetailsPerAd: true,
        }),
      });
      const items = await resp.json();
      if (!resp.ok || !Array.isArray(items)) {
        const msg = items?.error?.message || items?.error || `Apify returned ${resp.status}`;
        return Response.json({ error: typeof msg === "string" ? msg : "Actor run failed" }, { status: 502 });
      }
      const ads = items.map((r) => normalizeAd(r, body.country)).filter((a) => a.library_id);
      return Response.json({ ads, scanned: items.length });
    } catch (err) {
      console.error("meta ads search error:", err);
      return Response.json({ error: `Could not run the Ad Library scan — ${err.message || "network error"}.` }, { status: 502 });
    }
  }

  if (action === "import") {
    const { project_id, scope = "local", brand_id = null, organization_id = null, created_by = "", country = "", ads } = body;
    if (!project_id || !Array.isArray(ads) || !ads.length) return Response.json({ error: "project_id and ads[] required" }, { status: 400 });
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) return Response.json({ error: "Server configuration error" }, { status: 500 });
    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });

    // Dedup: skip ads already imported into this project (by native library id).
    const refs = ads.map((a) => a.library_id).filter(Boolean);
    const { data: existing } = await admin.from("creative_source")
      .select("source_ref").eq("project_id", project_id).eq("source_platform", "meta_ads").in("source_ref", refs);
    const seen = new Set((existing || []).map((r) => r.source_ref));

    const ctx = { projectId: project_id, scope, brandId: brand_id, orgId: organization_id, createdBy: created_by, country };
    const fresh = ads.filter((a) => a.library_id && !seen.has(a.library_id));
    const rows = fresh.map((a, i) => buildRow(a, ctx, i));
    if (rows.length) {
      const { error } = await admin.from("creative_source").insert(rows);
      if (error) return Response.json({ error: error.message }, { status: 500 });
    }
    return Response.json({ imported: rows.length, skipped: ads.length - rows.length });
  }

  return Response.json({ error: "unknown action" }, { status: 400 });
}
