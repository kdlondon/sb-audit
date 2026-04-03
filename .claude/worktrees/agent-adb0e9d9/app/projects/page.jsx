"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { useProject } from "@/lib/project-context";
import { useRole } from "@/lib/role-context";
import AuthGuard from "@/components/AuthGuard";

export default function ProjectsPage() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [newName, setNewName] = useState("");
  const [newClient, setNewClient] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [editName, setEditName] = useState("");
  const [editClient, setEditClient] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const router = useRouter();
  const { selectProject } = useProject();
  const { role, userId } = useRole();
  const supabase = createClient();

  const load = async () => {
    if (role === "full_admin") {
      // Full admins see all projects
      const { data } = await supabase.from("projects").select("*").order("created_at", { ascending: false });
      setProjects(data || []);
    } else {
      // Analysts and Clients only see assigned projects
      const { data: access } = await supabase.from("project_access").select("project_id").eq("user_id", userId);
      const projectIds = (access || []).map(a => a.project_id);
      if (projectIds.length > 0) {
        const { data } = await supabase.from("projects").select("*").in("id", projectIds).order("created_at", { ascending: false });
        setProjects(data || []);
      } else {
        setProjects([]);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    if (role && userId) load();
  }, [role, userId]);

  const createProject = async () => {
    if (!newName.trim()) return;
    const { data: { session } } = await supabase.auth.getSession();
    const id = "proj_" + Date.now();
    await supabase.from("projects").insert({
      id, name: newName.trim(), client_name: newClient.trim(),
      description: newDesc.trim(), created_by: session?.user?.email || "",
    });
    const { data: defaults } = await supabase.from("dropdown_options").select("category, value, sort_order").eq("project_id", "proj_sb_bb");
    if (defaults && defaults.length > 0) {
      await supabase.from("dropdown_options").insert(defaults.map(d => ({ ...d, project_id: id })));
    }
    // Auto-grant access to creator
    await supabase.from("project_access").insert({
      user_id: session.user.id,
      email: session.user.email,
      project_id: id,
    });
    selectProject(id, newName.trim());
    router.push("/dashboard");
  };

  const saveEdit = async (id) => {
    await supabase.from("projects").update({
      name: editName.trim(),
      client_name: editClient.trim(),
      description: editDesc.trim(),
    }).eq("id", id);
    setEditingId(null);
    load();
  };

  const archiveProject = async (p) => {
    const archived = p.name.startsWith("[Archived] ") ? p.name : "[Archived] " + p.name;
    await supabase.from("projects").update({ name: archived }).eq("id", p.id);
    load();
  };

  const deleteProject = async (p) => {
    if (!confirm(`Delete "${p.name}"?\n\nThis will permanently delete the project and ALL its data — audit entries, global benchmarks, reports and settings.\n\nThis cannot be undone.`)) return;
    await supabase.from("audit_entries").delete().eq("project_id", p.id);
    await supabase.from("audit_global").delete().eq("project_id", p.id);
    await supabase.from("saved_reports").delete().eq("project_id", p.id);
    await supabase.from("dropdown_options").delete().eq("project_id", p.id);
    await supabase.from("project_access").delete().eq("project_id", p.id);
    await supabase.from("projects").delete().eq("id", p.id);
    load();
  };

  const enterProject = (p) => {
    selectProject(p.id, p.name);
    router.push("/dashboard");
  };

  const startEdit = (p, e) => {
    e.stopPropagation();
    setEditingId(p.id);
    setEditName(p.name);
    setEditClient(p.client_name || "");
    setEditDesc(p.description || "");
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
  };

  const isAdmin = role === "full_admin";

  if (loading) return <AuthGuard><div className="min-h-screen flex items-center justify-center"><p className="text-hint">Loading projects...</p></div></AuthGuard>;

  return (
    <AuthGuard>
      <div className="min-h-screen" style={{ background: "var(--bg)" }}>
        {/* HEADER */}
        <div className="px-6 py-4 flex justify-between items-center" style={{ background: "#0a0f3c", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex items-center gap-3">
            <img src="/knots-dots-logo.png" alt="Knots & Dots" style={{ height: 22 }} />
            <div>
              <p className="text-sm font-semibold text-white">Groundwork</p>
              <p className="text-[10px] text-white/40">Select a project to continue</p>
            </div>
          </div>
          <button onClick={handleLogout} className="text-[11px] text-white/25 hover:text-white/50 transition">Sign out</button>
        </div>

        <div className="max-w-3xl mx-auto p-8">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-main">Projects</h1>
            {isAdmin && (
              <button onClick={() => setCreating(!creating)}
                className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-semibold hover:opacity-90">
                {creating ? "Cancel" : "+ New project"}
              </button>
            )}
          </div>

          {/* CREATE FORM — admin only */}
          {creating && isAdmin && (
            <div className="bg-surface border border-main rounded-xl p-5 mb-6">
              <h3 className="text-sm font-semibold text-main mb-3">Create new project</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-[10px] text-muted uppercase font-semibold mb-1">Project name *</label>
                  <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="E.g., Scotiabank Business Banking"
                    className="w-full px-3 py-2 bg-surface border border-main rounded-lg text-sm text-main focus:outline-none focus:border-[var(--accent)]" />
                </div>
                <div>
                  <label className="block text-[10px] text-muted uppercase font-semibold mb-1">Client name</label>
                  <input value={newClient} onChange={e => setNewClient(e.target.value)} placeholder="E.g., Scotiabank"
                    className="w-full px-3 py-2 bg-surface border border-main rounded-lg text-sm text-main focus:outline-none focus:border-[var(--accent)]" />
                </div>
                <div>
                  <label className="block text-[10px] text-muted uppercase font-semibold mb-1">Description</label>
                  <input value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Brief description"
                    className="w-full px-3 py-2 bg-surface border border-main rounded-lg text-sm text-main focus:outline-none focus:border-[var(--accent)]" />
                </div>
                <button onClick={createProject} disabled={!newName.trim()}
                  className="bg-accent text-white px-5 py-2 rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50">
                  Create project
                </button>
              </div>
            </div>
          )}

          {/* PROJECT CARDS */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {projects.map(p => (
              <div key={p.id} className="bg-surface border border-main rounded-xl overflow-hidden hover:border-[var(--accent)] transition group">

                {/* EDIT MODE — admin only */}
                {editingId === p.id && isAdmin ? (
                  <div className="p-5" onClick={e => e.stopPropagation()}>
                    <p className="text-[10px] text-muted uppercase font-semibold mb-3">Editing project</p>
                    <div className="space-y-2">
                      <div>
                        <label className="block text-[10px] text-muted uppercase font-semibold mb-1">Project name *</label>
                        <input value={editName} onChange={e => setEditName(e.target.value)}
                          className="w-full px-3 py-2 bg-surface border border-main rounded-lg text-sm text-main focus:outline-none focus:border-[var(--accent)]" />
                      </div>
                      <div>
                        <label className="block text-[10px] text-muted uppercase font-semibold mb-1">Client name</label>
                        <input value={editClient} onChange={e => setEditClient(e.target.value)}
                          className="w-full px-3 py-2 bg-surface border border-main rounded-lg text-sm text-main focus:outline-none focus:border-[var(--accent)]" />
                      </div>
                      <div>
                        <label className="block text-[10px] text-muted uppercase font-semibold mb-1">Description</label>
                        <input value={editDesc} onChange={e => setEditDesc(e.target.value)}
                          className="w-full px-3 py-2 bg-surface border border-main rounded-lg text-sm text-main focus:outline-none focus:border-[var(--accent)]" />
                      </div>
                      <div className="flex gap-2 pt-1">
                        <button onClick={() => saveEdit(p.id)}
                          className="px-4 py-1.5 bg-accent text-white rounded-lg text-xs font-semibold hover:opacity-90">
                          Save
                        </button>
                        <button onClick={() => setEditingId(null)}
                          className="px-4 py-1.5 border border-main rounded-lg text-xs text-muted hover:bg-surface2">
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>

                ) : (
                  <>
                    {/* CARD CONTENT — clickable */}
                    <div onClick={() => enterProject(p)} className="p-5 cursor-pointer">
                      {p.logo_url && <img src={p.logo_url} alt="" className="h-8 mb-3" />}
                      <h3 className="text-base font-bold text-main group-hover:text-accent transition">{p.name}</h3>
                      {p.client_name && <p className="text-xs text-muted mt-0.5">{p.client_name}</p>}
                      {p.description && <p className="text-xs text-hint mt-1">{p.description}</p>}
                      <p className="text-[10px] text-hint mt-3">{new Date(p.created_at).toLocaleDateString()}</p>
                    </div>

                    {/* ACTION BUTTONS */}
                    <div className="border-t border-main px-5 py-2.5 flex gap-2 bg-surface2">
                      <button onClick={() => enterProject(p)}
                        className="px-3 py-1 bg-accent text-white rounded-lg text-xs font-semibold hover:opacity-90">
                        Open
                      </button>
                      {isAdmin && (
                        <>
                          <button onClick={(e) => startEdit(p, e)}
                            className="px-3 py-1 border border-main rounded-lg text-xs text-muted hover:bg-surface hover:text-main transition">
                            Edit
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); archiveProject(p); }}
                            className="px-3 py-1 border border-main rounded-lg text-xs text-muted hover:bg-surface hover:text-main transition">
                            {p.name.startsWith("[Archived] ") ? "Unarchive" : "Archive"}
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); deleteProject(p); }}
                            className="px-3 py-1 border border-red-200 rounded-lg text-xs text-red-400 hover:bg-red-50 hover:text-red-600 transition ml-auto">
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>

          {projects.length === 0 && !creating && (
            <div className="text-center py-20 text-hint">
              <p className="text-lg mb-2">No projects available</p>
              <p className="text-sm">{isAdmin ? "Create your first project to get started" : "No projects have been assigned to you yet"}</p>
            </div>
          )}
        </div>
      </div>
    </AuthGuard>
  );
}
