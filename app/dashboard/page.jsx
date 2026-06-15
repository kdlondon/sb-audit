"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { useBrand } from "@/lib/brand-context";
import { useRole } from "@/lib/role-context";
import AuthGuard from "@/components/AuthGuard";
import Nav from "@/components/Nav";

export default function ClientDashboard() {
  const [brands, setBrands] = useState([]);
  const [caseCounts, setCaseCounts] = useState({});
  const [recentEntries, setRecentEntries] = useState([]);
  const [clientNames, setClientNames] = useState({});
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { selectBrand, selectProject } = useBrand();
  const { role, userId, activeOrg, orgRole, isPlatformAdmin, isOrgAdmin, loading: roleLoading } = useRole() || { loading: true };
  const supabase = createClient();
  const isAdmin = role === "full_admin" || isPlatformAdmin || isOrgAdmin;

  const load = async () => {
    // Show the PROJECTS a user can access, by role:
    //  - K&D Superadmin (platform_admin / full_admin): all projects
    //  - Client Superadmin (org_admin): all projects of their client
    //  - Analyst / Viewer: only projects assigned via project_access
    const cols = "id, name, client_id, created_at";
    let projectList = [];

    if (isPlatformAdmin) {
      const { data } = await supabase.from("projects").select(cols).order("created_at", { ascending: false });
      projectList = data || [];
    } else if (isOrgAdmin && activeOrg?.id) {
      const { data: cl } = await supabase.from("clients").select("id").eq("organization_id", activeOrg.id).maybeSingle();
      if (cl?.id) {
        const { data } = await supabase.from("projects").select(cols).eq("client_id", cl.id).order("created_at", { ascending: false });
        projectList = data || [];
      }
    } else if (activeOrg?.type === "platform" && orgRole === "analyst") {
      // K&D Analyst: projects of their assigned clients
      const { data: assigns } = await supabase.from("kd_client_assignments").select("client_id").eq("user_id", userId);
      const clientIds = [...new Set((assigns || []).map(a => a.client_id).filter(Boolean))];
      if (clientIds.length > 0) {
        const { data } = await supabase.from("projects").select(cols).in("client_id", clientIds).order("created_at", { ascending: false });
        projectList = data || [];
      }
    } else {
      const { data: access } = await supabase.from("project_access").select("project_id").eq("user_id", userId);
      const ids = [...new Set((access || []).map(a => a.project_id).filter(Boolean))];
      if (ids.length > 0) {
        const { data } = await supabase.from("projects").select(cols).in("id", ids).order("created_at", { ascending: false });
        projectList = data || [];
      }
    }
    setBrands(projectList);

    // Client names for grouping
    const cids = [...new Set(projectList.map(p => p.client_id).filter(Boolean))];
    if (cids.length > 0) {
      const { data: cls } = await supabase.from("clients").select("id, name").in("id", cids);
      const map = {};
      (cls || []).forEach(c => { map[c.id] = c.name; });
      setClientNames(map);
    } else {
      setClientNames({});
    }

    // Entry counts per project
    const counts = {};
    for (const p of projectList) {
      const { count } = await supabase.from("creative_source").select("*", { count: "exact", head: true }).eq("project_id", p.id);
      counts[p.id] = count || 0;
    }
    setCaseCounts(counts);

    setLoading(false);
  };

  useEffect(() => {
    if (roleLoading) return;
    if (role && userId) load();
    else if (!role) { setBrands([]); setLoading(false); }
  }, [role, userId, roleLoading, activeOrg, orgRole]);

  const enterBrand = async (p) => {
    // p is a project row. Set it as the active project (brand context falls back to it).
    selectProject(p.id, p.name);
    localStorage.setItem("sb-project-id", p.id);
    localStorage.setItem("sb-project-name", p.name);
    localStorage.setItem("sb-client-name", clientNames[p.client_id] || "");
    router.push(role === "client" || role === "viewer" ? "/showcase" : "/audit");
  };

  const handleLogout = async () => { await supabase.auth.signOut(); router.replace("/login"); };

  const timeAgo = (d) => {
    if (!d) return "";
    const diff = Date.now() - new Date(d).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  if (loading) return <AuthGuard><div className="min-h-screen flex items-center justify-center"><p className="text-hint">Loading...</p></div></AuthGuard>;

  return (
    <AuthGuard>
      <div className="min-h-screen" style={{ background: "var(--bg)" }}>
        <Nav />

        <div className="max-w-4xl mx-auto p-8">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-main">Your Projects</h1>
            <p className="text-sm text-muted mt-1">Select a project to start working, or add a new one.</p>
          </div>

          {isAdmin && (
            <div className="mb-6">
              <button onClick={() => router.push("/onboarding")}
                className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-semibold hover:opacity-90">
                + New Project
              </button>
            </div>
          )}

          {/* Projects grouped by client */}
          {brands.length > 0 ? (
            <div className="space-y-8 mb-10">
              {Object.entries(brands.reduce((acc, p) => { const k = p.client_id || "__none__"; (acc[k] = acc[k] || []).push(p); return acc; }, {})).map(([cid, projs]) => (
                <div key={cid}>
                  <h2 className="text-xs font-bold text-muted uppercase tracking-wide mb-3">
                    {cid === "__none__" ? "Unassigned" : (clientNames[cid] || "Client")}
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {projs.map(b => (
                      <div key={b.id} onClick={() => enterBrand(b)}
                        className="bg-surface border border-main rounded-xl p-5 cursor-pointer hover:border-accent transition group">
                        <h3 className="text-base font-bold text-main group-hover:text-accent transition">{b.name}</h3>
                        <div className="flex items-center gap-3 text-xs text-hint mt-2">
                          <span>{caseCounts[b.id] || 0} cases</span>
                          {b.created_at && <span>· {timeAgo(b.created_at)}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-20 text-hint">
              <p className="text-lg mb-2">No projects yet</p>
              <p className="text-sm">{isAdmin ? "Add your first project to get started" : "No projects have been assigned to you yet"}</p>
            </div>
          )}

          {/* Recent Activity — hidden for now */}
          {false && recentEntries.length > 0 && (
            <div>
              <h2 className="text-sm font-bold text-main mb-3">Recent activity</h2>
              <div className="space-y-1">
                {recentEntries.map((e, i) => (
                  <div key={i} className="flex items-center gap-3 py-1.5 text-xs">
                    <div className="w-1.5 h-1.5 rounded-full bg-accent/40" />
                    <span className="text-muted font-medium">{e.brand_name || "—"}</span>
                    <span className="text-hint">·</span>
                    <span className="text-main truncate max-w-[300px]">{e.description || "Entry"}</span>
                    <span className="text-hint ml-auto flex-shrink-0">{timeAgo(e.created_at)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </AuthGuard>
  );
}
