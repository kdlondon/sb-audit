// DB-backed "Findings" shelf — the persistent bridge between Intelligence (where
// conclusions are formed) and Report (where they become the deliverable). Replaces the
// ephemeral localStorage "Analyst Picks". Uses the anon supabase client (RLS permissive,
// app-gated). See MIGRATION_findings.sql for the table.
import { createClient } from "@/lib/supabase";

export async function listFindings(projectId) {
  if (!projectId) return [];
  try {
    const supabase = createClient();
    const { data } = await supabase.from("findings").select("*").eq("project_id", projectId).order("created_at", { ascending: false });
    return data || [];
  } catch { return []; }
}

// Save an Intelligence insight (or any object) as a finding. Keeps the full object in payload.
export async function saveFinding(projectId, ins = {}, extra = {}) {
  const supabase = createClient();
  const id = String(Date.now()) + Math.random().toString(36).slice(2, 6);
  const row = {
    id, project_id: projectId,
    title: ins.headline || ins.title || "",
    summary: ins.body || ins.summary || "",
    stat: ins.stat || "", stat_label: ins.stat_label || "",
    type: ins.type || "insight",
    section_affinity: extra.section_affinity || ins.pillar || "",
    source_type: extra.source_type || "insight",
    payload: ins,
  };
  const { error } = await supabase.from("findings").insert(row);
  if (error) throw new Error(error.message);
  return row;
}

export async function deleteFinding(id) {
  try { const supabase = createClient(); await supabase.from("findings").delete().eq("id", id); } catch {}
}

// One-line rendering used to inject findings into report prompts.
export function findingLine(f) {
  return `- ${f.title || f.summary || "Finding"}${f.stat ? ` (${f.stat}${f.stat_label ? " " + f.stat_label : ""})` : ""}${f.summary && f.title ? `: ${f.summary}` : ""}`.trim();
}
