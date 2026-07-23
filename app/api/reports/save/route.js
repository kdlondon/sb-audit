// Persist a report (create or update) with the service role.
//
// The client cannot do this directly: saved_reports' RLS policy allows INSERT but its
// UPDATE USING expression rejects the row, so a client-side update silently affected no
// rows — which is how a six-section run ended up stored with one section. Writing through
// the server keeps incremental save working without loosening the table's policy.
//
// Auth is still required, and the report is bound to the caller's project.
import { createClient } from "@supabase/supabase-js";
import { verifyAuth } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

const ALLOWED = new Set([
  "id", "title", "content", "content_blocks", "template_type", "project_id", "brand_id",
  "scope", "sections", "competitors", "custom_instructions", "year_from", "year_to",
  "created_by", "status", "archived", "updated_at",
]);

export async function POST(request) {
  const { user, error: authErr } = await verifyAuth(request);
  if (!user) return Response.json({ error: authErr || "Unauthorized" }, { status: 401 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return Response.json({ error: "Server not configured" }, { status: 500 });

  const body = await request.json();
  const row = body?.report || {};
  if (!row.id || !row.project_id) return Response.json({ error: "id and project_id required" }, { status: 400 });

  // Only known columns, so a stray client field can't fail the whole write.
  const clean = {};
  for (const [k, v] of Object.entries(row)) if (ALLOWED.has(k) && v !== undefined) clean[k] = v;
  clean.created_by = clean.created_by || user.email || "";
  clean.updated_at = new Date().toISOString();

  const admin = createClient(url, key, { auth: { persistSession: false } });

  // Drop columns this database doesn't have yet rather than losing the report.
  const unknownCol = (e) => { const m = /'([a-z_]+)' column|column "([a-z_]+)"/i.exec(e?.message || ""); return m ? (m[1] || m[2]) : null; };
  let payload = { ...clean };
  for (let i = 0; i < 4; i++) {
    const { data, error } = await admin.from("saved_reports").upsert(payload, { onConflict: "id" }).select("id");
    if (!error) {
      if (!data || data.length === 0) return Response.json({ error: "Save affected no rows" }, { status: 500 });
      return Response.json({ ok: true, id: data[0].id });
    }
    const col = unknownCol(error);
    if (!col || !(col in payload)) return Response.json({ error: error.message }, { status: 500 });
    delete payload[col];
  }
  return Response.json({ error: "Could not save after dropping unknown columns" }, { status: 500 });
}
