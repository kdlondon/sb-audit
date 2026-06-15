"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { useRole } from "@/lib/role-context";
import Nav from "@/components/Nav";
import AuthGuard from "@/components/AuthGuard";

function ModuleTabs({ active, router }) {
  const tab = (label, href, isActive) => (
    <button onClick={() => router.push(href)}
      className={`text-xs font-semibold px-3 py-1 rounded-full transition ${isActive ? "bg-white/20 text-white" : "text-white/50 hover:text-white/80"}`}>
      {label}
    </button>
  );
  return (
    <div className="flex items-center gap-3">
      <h2 className="text-lg font-bold text-white">Platform Admin</h2>
      <span className="text-white/30">/</span>
      <div className="flex items-center gap-1">
        {tab("K&D Team", "/admin/team", active === "team")}
        {tab("Client Management", "/admin/clients", active === "clients")}
      </div>
    </div>
  );
}

export default function KDTeamPage() {
  const { userEmail, isPlatformAdmin, loading: roleLoading } = useRole() || {};
  const router = useRouter();
  const supabase = createClient();

  const [platformOrgId, setPlatformOrgId] = useState(null);
  const [members, setMembers] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");
  const showToast = (m) => { setToast(m); setTimeout(() => setToast(""), 3000); };

  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", role: "platform_admin", clientIds: [] });
  const [adding, setAdding] = useState(false);
  const [expanded, setExpanded] = useState(null);

  const load = async () => {
    const { data: org } = await supabase.from("organizations").select("id").eq("type", "platform").maybeSingle();
    const orgId = org?.id || null;
    setPlatformOrgId(orgId);
    const { data: cl } = await supabase.from("clients").select("id, name").order("name");
    setClients(cl || []);
    if (orgId) {
      const { data: mem } = await supabase.from("organization_members").select("user_id, email, role").eq("organization_id", orgId);
      const { data: assigns } = await supabase.from("kd_client_assignments").select("user_id, client_id");
      const byUser = {};
      (assigns || []).forEach(a => { (byUser[a.user_id] ||= []).push(a.client_id); });
      setMembers((mem || []).map(m => ({ ...m, clientIds: byUser[m.user_id] || [] })));
    }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  if (!roleLoading && userEmail && !isPlatformAdmin) { router.replace("/dashboard"); return null; }

  const createMember = async () => {
    if (!form.email.trim() || !form.password.trim()) return;
    setAdding(true);
    const res = await fetch("/api/create-user", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: form.email.trim(), password: form.password.trim(), role: form.role, organization_id: platformOrgId }),
    });
    let r; try { r = await res.json(); } catch { r = { error: "Invalid response from server" }; }
    if (r.error) { showToast("Error: " + r.error); setAdding(false); return; }
    if (form.role === "analyst" && form.clientIds.length && r.user?.id) {
      await supabase.from("kd_client_assignments").insert(form.clientIds.map(cid => ({ user_id: r.user.id, client_id: cid })));
    }
    showToast("K&D user created");
    setForm({ email: "", password: "", role: "platform_admin", clientIds: [] });
    setShowAdd(false); setAdding(false); load();
  };

  const updateRole = async (m, newRole) => {
    await supabase.from("organization_members").update({ role: newRole }).eq("organization_id", platformOrgId).eq("user_id", m.user_id);
    const legacy = newRole === "platform_admin" ? "full_admin" : "analyst";
    await supabase.from("user_roles").update({ role: legacy }).eq("user_id", m.user_id);
    if (newRole !== "analyst") await supabase.from("kd_client_assignments").delete().eq("user_id", m.user_id);
    showToast("Role updated"); load();
  };

  const removeMember = async (m) => {
    if (!confirm(`Remove "${m.email}" from K&D?\n\nThis deletes their login account and all access. This cannot be undone.`)) return;
    const res = await fetch("/api/delete-user", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user_id: m.user_id }) });
    let r; try { r = await res.json(); } catch { r = { error: "Invalid response from server" }; }
    if (r.error) { showToast("Error: " + r.error); return; }
    showToast("User removed"); load();
  };

  const toggleClient = async (m, clientId) => {
    const has = m.clientIds.includes(clientId);
    if (has) await supabase.from("kd_client_assignments").delete().eq("user_id", m.user_id).eq("client_id", clientId);
    else await supabase.from("kd_client_assignments").insert({ user_id: m.user_id, client_id: clientId });
    load();
  };

  const toggleFormClient = (cid) => setForm(f => ({ ...f, clientIds: f.clientIds.includes(cid) ? f.clientIds.filter(x => x !== cid) : [...f.clientIds, cid] }));

  return (
    <AuthGuard>
      <Nav />
      <div className="min-h-screen" style={{ background: "var(--bg)" }}>
        <div className="section-bar px-5 py-3 flex justify-between items-center">
          <ModuleTabs active="team" router={router} />
          <button onClick={() => setShowAdd(!showAdd)} className="px-4 py-1.5 bg-white/15 text-white rounded-lg text-sm font-semibold hover:bg-white/25">
            {showAdd ? "Cancel" : "+ Add K&D user"}
          </button>
        </div>

        <div className="p-5 max-w-3xl mx-auto space-y-5">
          {toast && <div className="fixed top-4 right-4 bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium z-50 shadow-lg">{toast}</div>}

          {showAdd && (
            <div className="bg-surface border border-main rounded-xl p-5 space-y-3">
              <h3 className="text-sm font-semibold text-main">Add K&D user</h3>
              <input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="name@kad.london" type="email"
                className="w-full px-3 py-2 bg-surface border border-main rounded-lg text-sm text-main focus:outline-none focus:border-[var(--accent)]" />
              <input value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="Temporary password (min 6 chars)" type="text"
                className="w-full px-3 py-2 bg-surface border border-main rounded-lg text-sm text-main focus:outline-none focus:border-[var(--accent)]" />
              <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}
                className="w-full px-3 py-2 bg-surface border border-main rounded-lg text-sm text-main focus:outline-none focus:border-[var(--accent)]">
                <option value="platform_admin">Superadmin — Platform Admin + all clients</option>
                <option value="analyst">Analyst — only assigned clients</option>
              </select>
              {form.role === "analyst" && (
                <div className="p-3 border border-main rounded-lg bg-surface2">
                  <p className="text-[10px] text-muted uppercase font-semibold mb-2">Assign clients</p>
                  {clients.length === 0 ? <p className="text-xs text-hint">No clients yet.</p> : (
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {clients.map(c => (
                        <label key={c.id} className="flex items-center gap-2 text-xs cursor-pointer">
                          <input type="checkbox" checked={form.clientIds.includes(c.id)} onChange={() => toggleFormClient(c.id)} />
                          <span className="text-main">{c.name}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <button onClick={createMember} disabled={adding || !form.email.trim() || !form.password.trim()}
                className="w-full px-4 py-2 bg-accent text-white rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50">
                {adding ? "Creating..." : "Create user"}
              </button>
            </div>
          )}

          {loading ? (
            <p className="text-hint text-center py-20">Loading...</p>
          ) : (
            <div className="bg-surface border border-main rounded-xl p-5">
              <h3 className="text-sm font-semibold text-main mb-4">K&D members ({members.length})</h3>
              {members.length === 0 ? (
                <p className="text-sm text-hint text-center py-6">No K&D members found.</p>
              ) : members.map(m => {
                const isAnalyst = m.role === "analyst";
                return (
                  <div key={m.user_id} className="py-2 border-b border-main last:border-0">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold uppercase flex-shrink-0"
                        style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>{m.email[0]}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-main truncate">{m.email}</p>
                        <p className="text-[10px] text-hint truncate">
                          {isAnalyst ? `${m.clientIds.length} client${m.clientIds.length !== 1 ? "s" : ""} assigned` : "All clients (Superadmin)"}
                        </p>
                      </div>
                      <select value={m.role} onChange={e => updateRole(m, e.target.value)}
                        className="text-[11px] px-2 py-1 bg-surface border border-main rounded-md text-main flex-shrink-0">
                        <option value="platform_admin">Superadmin</option>
                        <option value="analyst">Analyst</option>
                      </select>
                      {isAnalyst && (
                        <button onClick={() => setExpanded(expanded === m.user_id ? null : m.user_id)}
                          className="text-[11px] px-2 py-1 border border-main rounded-md text-muted hover:text-main flex-shrink-0 whitespace-nowrap">
                          Clients ({m.clientIds.length})
                        </button>
                      )}
                      <button onClick={() => removeMember(m)} className="text-[11px] text-red-400 hover:text-red-600 font-medium flex-shrink-0">Remove</button>
                    </div>
                    {isAnalyst && expanded === m.user_id && (
                      <div className="mt-2 ml-11 p-3 border border-main rounded-lg bg-surface2 space-y-1.5">
                        <p className="text-[10px] text-muted uppercase font-semibold mb-1">Assign clients</p>
                        {clients.length === 0 ? <p className="text-[11px] text-hint">No clients yet.</p> : clients.map(c => {
                          const has = m.clientIds.includes(c.id);
                          return (
                            <label key={c.id} className="flex items-center gap-2 text-xs cursor-pointer">
                              <input type="checkbox" checked={has} onChange={() => toggleClient(m, c.id)} />
                              <span className={has ? "text-main font-medium" : "text-muted"}>{c.name}</span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AuthGuard>
  );
}
