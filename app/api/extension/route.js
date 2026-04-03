import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function POST(request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Use service role if available, otherwise anon key
  const supabase = createClient(supabaseUrl, serviceRoleKey || anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const body = await request.json();
  const { action } = body;

  // ─── UPLOAD IMAGE ───
  if (action === "upload") {
    const { imageBase64, filename } = body;
    if (!imageBase64) return Response.json({ error: "No image data" }, { status: 400 });

    try {
      // Convert base64 to buffer
      const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");
      const path = `extension/${filename || `${Date.now()}_${Math.random().toString(36).slice(2, 6)}.jpg`}`;

      const { error: uploadError } = await supabase.storage
        .from("media")
        .upload(path, buffer, { contentType: "image/jpeg", upsert: true });

      if (uploadError) return Response.json({ error: uploadError.message }, { status: 400 });

      const { data: { publicUrl } } = supabase.storage.from("media").getPublicUrl(path);
      return Response.json({ success: true, url: publicUrl });
    } catch (err) {
      return Response.json({ error: err.message }, { status: 500 });
    }
  }

  // ─── SAVE ENTRY ───
  if (action === "save") {
    const { entry } = body;
    if (!entry || !entry.project_id) return Response.json({ error: "Missing entry or project_id" }, { status: 400 });

    try {
      const entryData = {
        id: entry.id || String(Date.now()),
        project_id: entry.project_id,
        competitor: entry.competitor || "",
        brand_name: entry.competitor || entry.brand_name || "",
        scope: entry.scope || "local",
        description: entry.description || "",
        image_url: entry.image_url || "",
        url: entry.url || "",
        type: entry.type || "",
        synopsis: entry.synopsis || "",
        insight: entry.insight || "",
        idea: entry.idea || "",
        primary_territory: entry.primary_territory || "",
        tone_of_voice: entry.tone_of_voice || "",
        brand_archetype: entry.brand_archetype || "",
        communication_intent: entry.communication_intent || "",
        main_slogan: entry.main_slogan || "",
        main_vp: entry.main_vp || "",
        transcript: entry.transcript || "",
        analyst_comment: entry.analyst_comment || "",
        created_by: entry.created_by || "chrome-extension",
        year: entry.year || new Date().getFullYear().toString(),
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from("creative_source").insert(entryData);
      if (error) return Response.json({ error: error.message }, { status: 400 });

      return Response.json({ success: true, id: entryData.id });
    } catch (err) {
      return Response.json({ error: err.message }, { status: 500 });
    }
  }

  return Response.json({ error: "Unknown action" }, { status: 400 });
}
