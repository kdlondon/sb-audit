// Report comments API — CRUD over report_comments, anchored to a content block id (never
// to matched text). Authors carry a role ('kd' | 'client') so the UI can distinguish them.
import { createClient } from "@supabase/supabase-js";
import { verifyAuth } from "@/lib/api-auth";

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

// GET /api/reports/comments?report_id=…  → active comments for a report
export async function GET(request) {
  const { user, error } = await verifyAuth(request);
  if (!user) return Response.json({ error: error || "Unauthorized" }, { status: 401 });
  const db = admin();
  if (!db) return Response.json({ error: "Server not configured" }, { status: 500 });

  const reportId = new URL(request.url).searchParams.get("report_id");
  if (!reportId) return Response.json({ error: "report_id required" }, { status: 400 });

  const { data, error: e } = await db.from("report_comments")
    .select("*").eq("report_id", reportId).is("deleted_at", null)
    .order("created_at", { ascending: true });
  if (e) return Response.json({ error: e.message }, { status: 500 });
  return Response.json({ comments: data || [] });
}

// POST /api/reports/comments  { report_id, project_id, block_id, sel_start, sel_end, snippet, body, author_role }
export async function POST(request) {
  const { user, error } = await verifyAuth(request);
  if (!user) return Response.json({ error: error || "Unauthorized" }, { status: 401 });
  const db = admin();
  if (!db) return Response.json({ error: "Server not configured" }, { status: 500 });

  const b = await request.json();
  if (!b.report_id || !b.project_id || !b.block_id || !b.body?.trim())
    return Response.json({ error: "report_id, project_id, block_id and body required" }, { status: 400 });

  const row = {
    report_id: b.report_id, project_id: b.project_id, block_id: b.block_id,
    sel_start: b.sel_start ?? null, sel_end: b.sel_end ?? null,
    snippet: b.snippet || null, body: b.body.trim(),
    author: user.email || b.author || "Analyst",
    author_role: b.author_role === "client" ? "client" : "kd",
  };
  const { data, error: e } = await db.from("report_comments").insert(row).select().single();
  if (e) return Response.json({ error: e.message }, { status: 500 });
  return Response.json({ comment: data });
}

// PATCH /api/reports/comments  { id, body }  → edit
export async function PATCH(request) {
  const { user, error } = await verifyAuth(request);
  if (!user) return Response.json({ error: error || "Unauthorized" }, { status: 401 });
  const db = admin();
  if (!db) return Response.json({ error: "Server not configured" }, { status: 500 });

  const { id, body } = await request.json();
  if (!id || !body?.trim()) return Response.json({ error: "id and body required" }, { status: 400 });
  const { data, error: e } = await db.from("report_comments")
    .update({ body: body.trim(), edited_at: new Date().toISOString() }).eq("id", id).select().single();
  if (e) return Response.json({ error: e.message }, { status: 500 });
  return Response.json({ comment: data });
}

// DELETE /api/reports/comments?id=…  → soft delete
export async function DELETE(request) {
  const { user, error } = await verifyAuth(request);
  if (!user) return Response.json({ error: error || "Unauthorized" }, { status: 401 });
  const db = admin();
  if (!db) return Response.json({ error: "Server not configured" }, { status: 500 });

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return Response.json({ error: "id required" }, { status: 400 });
  const { error: e } = await db.from("report_comments").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  if (e) return Response.json({ error: e.message }, { status: 500 });
  return Response.json({ ok: true });
}
