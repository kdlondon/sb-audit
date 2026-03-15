"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { useProject } from "@/lib/project-context";
import AuthGuard from "@/components/AuthGuard";

export default function ProjectsPage() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newClient, setNewClient] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const router = useRouter();
  const { selectProject } = useProject();
  const supabase = createClient();

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("projects").select("*").order("created_at", { ascending: false });
      setProjects(data || []);
      setLoading(false);
    })();
  }, []);

  const createProject = async () => {
    if (!newName.trim()) return;
    const { data: { session } } = await supabase.auth.getSession();
    const id = "proj_" + Date.now();
    await supabase.from("projects").insert({
      id,
      name: newName.trim(),
      client_name: newClient.trim(),
      description: newDesc.trim(),
      created_by: session?.user?.email || "",
    });

    // Copy default dropdown options for new project
    const { data: defaults } = await supabase.from("dropdown_options").select("category, value, sort_order").eq("project_id", "proj_sb_bb");
    if (defaults && defaults.length > 0) {
      const newOpts = defaults.map(d => ({ ...d, project_id: id }));
      await supabase.from("dropdown_options").insert(newOpts);
    }

    selectProject(id, newName.trim());
    router.push("/dashboard");
  };

  const enterProject = (p) => {
    selectProject(p.id, p.name);
    router.push("/dashboard");
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
  };

  if (loading) return <AuthGuard><div className="min-h-screen flex items-center justify-center"><p className="text-hint">Loading projects...</p></div></AuthGuard>;

  return (
    <AuthGuard>
      <div className="min-h-screen" style={{ background: "var(--bg)" }}>
        <div className="bg-surface border-b border-main px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <img src="/knots-dots-logo.png" alt="Knots & Dots" style={{ height: 28 }} />
            <div>
              <p className="text-sm font-semibold text-main">Category Landscape Platform</p>
              <p className="text-[10px] text-muted">Select a project to continue</p>
            </div>
          </div>
          <button onClick={handleLogout} className="text-xs text-hint hover:text-muted">Sign out</button>
        </div>

        <div className="max-w-3xl mx-auto p-8">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-main">Projects</h1>
            <button onClick={() => setCreating(!creating)}
              className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-semibold hover:opacity-90">
              {creating ? "Cancel" : "+ New project"}
            </button>
          </div>

          {creating && (
            <div className="bg-surface border border-main rounded-xl p-5 mb-6">
              <h3 className="text-sm font-semibold text-main mb-3">Create new project</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-[10px] text-muted uppercase font-semibold mb-1">Project name *</label>
                  <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="E.g., Scotiabank Business Banking"
                    className="w-full px-3 py-2 bg-surface border border-main rounded-lg text-sm text-main" />
                </div>
                <div>
                  <label className="block text-[10px] text-muted uppercase font-semibold mb-1">Client name</label>
                  <input value={newClient} onChange={e => setNewClient(e.target.value)} placeholder="E.g., Scotiabank"
                    className="w-full px-3 py-2 bg-surface border border-main rounded-lg text-sm text-main" />
                </div>
                <div>
                  <label className="block text-[10px] text-muted uppercase font-semibold mb-1">Description</label>
                  <input value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Brief description"
                    className="w-full px-3 py-2 bg-surface border border-main rounded-lg text-sm text-main" />
                </div>
                <button onClick={createProject} disabled={!newName.trim()}
                  className="bg-accent text-white px-5 py-2 rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50">
                  Create project
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {projects.map(p => (
              <div key={p.id} onClick={() => enterProject(p)}
                className="bg-surface border border-main rounded-xl p-5 cursor-pointer hover:border-[var(--accent)] transition group">
                {p.logo_url && <img src={p.logo_url} alt="" className="h-8 mb-3" />}
                <h3 className="text-base font-bold text-main group-hover:text-accent transition">{p.name}</h3>
                {p.client_name && <p className="text-xs text-muted mt-0.5">{p.client_name}</p>}
                {p.description && <p className="text-xs text-hint mt-1">{p.description}</p>}
                <p className="text-[10px] text-hint mt-3">{new Date(p.created_at).toLocaleDateString()}</p>
              </div>
            ))}
          </div>

          {projects.length === 0 && !creating && (
            <div className="text-center py-20 text-hint">
              <p className="text-lg mb-2">No projects yet</p>
              <p className="text-sm">Create your first project to get started</p>
            </div>
          )}
        </div>
      </div>
    </AuthGuard>
  );
}
