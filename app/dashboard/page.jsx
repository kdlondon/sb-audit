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
  const [tab, setTab] = useState("active");
  const [menuFor, setMenuFor] = useState(null);
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
    // Lifecycle status (resilient — works even before the migration adds the column)
    try {
      const ids = projectList.map(p => p.id);
      if (ids.length) {
        const { data: st } = await supabase.from("projects").select("id, status, status_changed_at").in("id", ids);
        if (st) { const m = {}; st.forEach(r => (m[r.id] = r)); projectList = projectList.map(p => ({ ...p, status: m[p.id]?.status || "active", status_changed_at: m[p.id]?.status_changed_at })); }
      }
      const cutoff = new Date(Date.now() - 30 * 86400000).toISOString();
      supabase.from("projects").delete().eq("status", "trashed").lt("status_changed_at", cutoff).then(() => {});
    } catch {}
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

  const setProjectStatus = async (id, status) => {
    setMenuFor(null);
    try { await supabase.from("projects").update({ status, status_changed_at: new Date().toISOString() }).eq("id", id); } catch {}
    load();
  };
  const daysLeft = (changedAt) => { if (!changedAt) return 30; return Math.max(0, 30 - Math.floor((Date.now() - new Date(changedAt).getTime()) / 86400000)); };

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

  if (loading) return (
    <AuthGuard>
      <div className="min-h-screen" style={{ background: "var(--bg)" }}>
        <Nav />
        <div className="max-w-4xl mx-auto p-8">
          <div className="mb-8">
            <div className="h-7 w-44 rounded-lg bg-surface2 animate-pulse" />
            <div className="h-4 w-72 rounded bg-surface2 animate-pulse mt-2.5" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-surface border border-main rounded-xl p-5">
                <div className="h-4 w-3/4 rounded bg-surface2 animate-pulse" />
                <div className="h-3 w-1/2 rounded bg-surface2 animate-pulse mt-3" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </AuthGuard>
  );

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

          {/* Lifecycle tabs */}
          <div className="flex gap-1 mb-6 border-b border-main">
            {[["active","Active"],["archived","Archived"],["trashed","Trash"]].map(([k,l])=>{
              const n=brands.filter(p=>(p.status||"active")===k).length;
              return <button key={k} onClick={()=>{setTab(k);setMenuFor(null);}} className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition ${tab===k?"border-accent text-main":"border-transparent text-muted hover:text-main"}`}>{l}{n>0&&<span className="ml-1.5 text-[10px] text-hint">{n}</span>}</button>;
            })}
          </div>

          {/* Projects grouped by client (filtered by lifecycle tab) */}
          {(()=>{ const visible=brands.filter(p=>(p.status||"active")===tab); return visible.length>0 ? (
            <div className="space-y-8 mb-10">
              {Object.entries(visible.reduce((acc, p) => { const k = p.client_id || "__none__"; (acc[k] = acc[k] || []).push(p); return acc; }, {})).map(([cid, projs]) => (
                <div key={cid}>
                  <h2 className="text-xs font-bold text-muted uppercase tracking-wide mb-3">
                    {cid === "__none__" ? "Unassigned" : (clientNames[cid] || "Client")}
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {projs.map(b => (
                      <div key={b.id} className="bg-surface border border-main rounded-xl p-5 transition group relative">
                        <div onClick={() => tab==="active"&&enterBrand(b)} className={tab==="active"?"cursor-pointer":""}>
                          <h3 className={`text-base font-bold text-main transition ${tab==="active"?"group-hover:text-accent":""}`}>{b.name}</h3>
                          <div className="flex items-center gap-3 text-xs text-hint mt-2 flex-wrap tabular-nums">
                            <span>{caseCounts[b.id] || 0} cases</span>
                            {b.created_at && <span>· {timeAgo(b.created_at)}</span>}
                            {tab==="trashed" && <span className="text-red-500">· deleted in {daysLeft(b.status_changed_at)} d</span>}
                          </div>
                        </div>
                        {isAdmin && (
                          <div className="absolute top-3 right-3" onClick={e=>e.stopPropagation()}>
                            <button onClick={()=>setMenuFor(menuFor===b.id?null:b.id)} className="text-hint hover:text-main text-lg leading-none px-1">⋯</button>
                            {menuFor===b.id && (
                              <div className="absolute right-0 top-full mt-1 bg-surface border border-main rounded-lg shadow-xl z-20 w-[160px] overflow-hidden">
                                {tab!=="active" && <button onClick={()=>setProjectStatus(b.id,"active")} className="w-full text-left px-3 py-2 text-xs text-main hover:bg-accent-soft">Restore</button>}
                                {tab==="active" && <button onClick={()=>setProjectStatus(b.id,"archived")} className="w-full text-left px-3 py-2 text-xs text-main hover:bg-accent-soft">Archive</button>}
                                {tab!=="trashed" && <button onClick={()=>setProjectStatus(b.id,"trashed")} className="w-full text-left px-3 py-2 text-xs text-red-500 hover:bg-red-500/10">Move to trash</button>}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-20 text-hint">
              <p className="text-lg mb-2">{tab==="active"?"No projects yet":tab==="archived"?"No archived projects":"Trash empty"}</p>
              {tab==="active" && <p className="text-sm">{isAdmin ? "Add your first project to get started" : "No projects have been assigned to you yet"}</p>}
            </div>
          ); })()}

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
