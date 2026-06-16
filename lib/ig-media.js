import { createClient } from "@supabase/supabase-js";

// IG CDN image URLs are hotlink-restricted/expiring, so re-host the thumbnail in our
// own storage ("media" bucket) and return that stable URL. Falls back to the original
// URL on any failure. Server-side only (needs the service-role key).
export async function rehost(imgUrl) {
  try {
    const sUrl = process.env.NEXT_PUBLIC_SUPABASE_URL, sKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!sUrl || !sKey || !imgUrl) return imgUrl;
    const admin = createClient(sUrl, sKey, { auth: { persistSession: false } });
    const headers = { "User-Agent": "Mozilla/5.0", Referer: /tiktok|byteimg/i.test(imgUrl) ? "https://www.tiktok.com/" : "https://www.instagram.com/" };
    let r = await fetch(imgUrl, { headers });
    if (!r.ok) { await new Promise((res) => setTimeout(res, 600)); r = await fetch(imgUrl, { headers }); } // transient CDN 403 under concurrency
    if (!r.ok) return imgUrl;
    const buf = Buffer.from(await r.arrayBuffer());
    const path = `ig_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.jpg`;
    const { error } = await admin.storage.from("media").upload(path, buf, { contentType: "image/jpeg", upsert: false });
    if (error) return imgUrl;
    const { data } = admin.storage.from("media").getPublicUrl(path);
    return data?.publicUrl || imgUrl;
  } catch { return imgUrl; }
}
