import { createClient } from "@supabase/supabase-js";
import { requireAuth } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function POST(request) {
  const denied = await requireAuth(request);
  if (denied) return denied;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return Response.json({ error: "Server configuration error" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const body = await request.json();

  // ─── ASSIGN PROJECT ACCESS ───
  if (body.action === "assign_project") {
    const { user_id, email, project_id } = body;
    if (!user_id || !project_id) return Response.json({ error: "user_id and project_id required" }, { status: 400 });
    const { error } = await supabase.from("project_access").upsert({ user_id, email: email || "", project_id }, { onConflict: "user_id,project_id" });
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ success: true });
  }

  // ─── LIST PROJECTS ───
  if (body.action === "list_projects") {
    const { data, error } = await supabase.from("projects").select("id,name,client_name").order("created_at", { ascending: false });
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ projects: data });
  }

  // ─── SAVE SHOWCASE COMMENTS ───
  if (body.action === "save_showcase_comments") {
    const { showcase_id, comments } = body;
    const { error } = await supabase.from("saved_showcases").update({ slide_comments: comments }).eq("id", showcase_id);
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ success: true });
  }

  // ─── SAVE REPORT ───
  const { id, content, title } = body;
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
