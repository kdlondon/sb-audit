import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function POST(request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return Response.json({ error: "Server configuration error" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { id, content, title } = await request.json();
  if (!id) return Response.json({ error: "Report ID required" }, { status: 400 });

  const updateFields = {};
  if (content !== undefined) updateFields.content = content;
  if (title !== undefined) updateFields.title = title;

  const { error } = await supabase.from("saved_reports").update(updateFields).eq("id", id);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ success: true });
}
