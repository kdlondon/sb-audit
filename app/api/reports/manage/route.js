// Report lifecycle API — status, archive/restore, rename, soft delete/restore.
// Library actions live here so the page never writes these fields ad hoc.
import { createClient } from "@supabase/supabase-js";
import { verifyAuth } from "@/lib/api-auth";

const STATUSES = new Set(["in_process", "in_review", "delivered"]);

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

// POST /api/reports/manage  { id, action, value? }
//   action: 'status' (value: in_process|in_review|delivered) | 'archive' | 'restore'
//         | 'rename' (value: title) | 'delete' (soft) | 'undelete'
export async function POST(request) {
  const { user, error } = await verifyAuth(request);
  if (!user) return Response.json({ error: error || "Unauthorized" }, { status: 401 });
  const db = admin();
  if (!db) return Response.json({ error: "Server not configured" }, { status: 500 });

  const { id, action, value } = await request.json();
  if (!id || !action) return Response.json({ error: "id and action required" }, { status: 400 });

  const now = new Date().toISOString();
  let patch;
  switch (action) {
    case "status":
      if (!STATUSES.has(value)) return Response.json({ error: "invalid status" }, { status: 400 });
      patch = { status: value, updated_at: now }; break;
    case "archive":  patch = { archived: true, updated_at: now }; break;
    case "restore":  patch = { archived: false, updated_at: now }; break;
    case "rename":
      if (!value?.trim()) return Response.json({ error: "title required" }, { status: 400 });
      patch = { title: value.trim(), updated_at: now }; break;
    case "delete":   patch = { deleted_at: now }; break;         // soft — restorable ~30d
    case "undelete": patch = { deleted_at: null }; break;
    default: return Response.json({ error: "unknown action" }, { status: 400 });
  }

  const { data, error: e } = await db.from("saved_reports").update(patch).eq("id", id).select().single();
  if (e) return Response.json({ error: e.message }, { status: 500 });
  return Response.json({ report: data });
}
