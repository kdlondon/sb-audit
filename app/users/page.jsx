"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { useRole } from "@/lib/role-context";
import Nav from "@/components/Nav";
import AuthGuard from "@/components/AuthGuard";
import ProjectGuard from "@/components/ProjectGuard";

const ROLE_OPTIONS = [
  { value: "full_admin", label: "Full Admin", desc: "All modules, all projects, manage users" },
  { value: "analyst", label: "Analyst", desc: "Audit, Dashboard, Reports, Chat — assigned projects only" },
  { value: "client", label: "Client", desc: "Dashboard, Reports (view), Chat — assigned projects only" },
];

export default function UsersPage() {
  const { role } = useRole();
  const router = useRouter();
  const supabase = createClient();

  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [projectAccess, setProjectAccess] = useState({}); // { userId: [projectId, ...] }
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [toast, setToast] = useState("");

  // New user form — 2 steps: create user, then assign projects
  const [showInvite, setShowInvite] = useState(false);
  const [inviteStep, setInviteStep] = useState(1); // 1=create, 2=assign projects
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitePassword, setInvitePassword] = useState("");
  const [inviteRole, setInviteRole] = useState("analyst");
  const [inviting, setInviting] = useState(false);
  const [newUserId, setNewUserId] = useState(null);
  const [newUserProjects, setNewUserProjects] = useState([]);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  const loadData = async () => {
    const [usersRes, projectsRes, accessRes] = await Promise.all([
      supabase.from("user_roles").select("*").order("created_at", { ascending: true }),
      supabase.from("projects").select("id, name").order("name"),
      supabase.from("project_access").select("*"),
    ]);

    setUsers(usersRes.data || []);
    setProjects(projectsRes.data || []);

    // Build access map: { userId: [projectId, ...] }
    const map = {};
    (accessRes.data || []).forEach(a => {
      if (!map[a.user_id]) map[a.user_id] = [];
      map[a.user_id].push(a.project_id);
    });
    setProjectAccess(map);
    setLoading(false);
  };

  useEffect(() => {
    if (role === "full_admin") loadData();
  }, [role]);

  // Redirect non-admins
  if (role && role !== "full_admin") {
    router.replace("/dashboard");
    return null;
  }

  const updateRole = async (userId, newRole) => {
    await supabase.from("user_roles").update({ role: newRole }).eq("user_id", userId);
    showToast("Role updated");
    loadData();
  };

  const toggleProjectAccess = async (user, projectId) => {
    const current = projectAccess[user.user_id] || [];
    if (current.includes(projectId)) {
      // Remove access
      await supabase.from("project_access").delete().eq("user_id", user.user_id).eq("project_id", projectId);
    } else {
      // Add access
      await supabase.from("project_access").insert({
        user_id: user.user_id,
        email: user.email,
        project_id: projectId,
      });
    }
    loadData();
  };

  const grantAllProjects = async (user) => {
    const current = projectAccess[user.user_id] || [];
    const missing = projects.filter(p => !current.includes(p.id));
    if (missing.length > 0) {
      await supabase.from("project_access").insert(
        missing.map(p => ({ user_id: user.user_id, email: user.email, project_id: p.id }))
      );
    }
    showToast("Access granted to all projects");
    loadData();
  };

  const revokeAllProjects = async (user) => {
    await supabase.from("project_access").delete().eq("user_id", user.user_id);
    showToast("All project access revoked");
    loadData();
  };

  const deleteUser = async (user) => {
    if (!confirm(`Remove "${user.email}" from the platform?\n\nThis will remove their role and all project access. The Supabase auth account will remain (delete it from the Supabase dashboard if needed).`)) return;
    await supabase.from("project_access").delete().eq("user_id", user.user_id);
    await supabase.from("user_roles").delete().eq("user_id", user.user_id);
    setSelectedUser(null);
    showToast("User removed");
    loadData();
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim() || !invitePassword.trim()) return;
    setInviting(true);

    try {
      // Create user via server-side API (doesn't affect current session)
      const res = await fetch("/api/create-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim(), password: invitePassword.trim(), role: inviteRole }),
      });
      const result = await res.json();

      if (result.error) {
        showToast("Error: " + result.error);
        setInviting(false);
        return;
      }

      setNewUserId(result.user.id);
      setNewUserProjects([]);
      setInviteStep(2); // Move to project assignment step
      showToast(`User created — now assign project access`);
      await loadData();
    } catch (err) {
      showToast("Error: " + err.message);
    }
    setInviting(false);
  };

  const handleAssignProjects = async () => {
    if (!newUserId) return;
    setInviting(true);

    // Grant access to selected projects
    if (newUserProjects.length > 0) {
      await supabase.from("project_access").insert(
        newUserProjects.map(pid => ({
          user_id: newUserId,
          email: inviteEmail.trim(),
          project_id: pid,
        }))
      );
    }

    showToast(`${inviteEmail} now has access to ${newUserProjects.length} project${newUserProjects.length !== 1 ? "s" : ""}`);
    setInviteEmail("");
    setInvitePassword("");
    setInviteRole("analyst");
    setInviteStep(1);
    setNewUserId(null);
    setNewUserProjects([]);
    setShowInvite(false);
    setInviting(false);
    loadData();
  };

  const selectedUserData = users.find(u => u.user_id === selectedUser);

  return (
    <AuthGuard>
      <ProjectGuard>
        <Nav />
        <div className="min-h-screen" style={{ background: "var(--bg)" }}>
          <div className="max-w-5xl mx-auto p-6">
            {/* HEADER */}
            <div className="flex justify-between items-center mb-6">
              <div>
                <h1 className="text-xl font-bold text-main">User Management</h1>
                <p className="text-xs text-muted mt-1">Manage roles and project access</p>
              </div>
              <button onClick={() => setShowInvite(!showInvite)}
                className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-semibold hover:opacity-90">
                {showInvite ? "Cancel" : "+ Add user"}
              </button>
            </div>

            {/* TOAST */}
            {toast && (
              <div className="fixed top-4 right-4 bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium z-50 shadow-lg">
                {toast}
              </div>
            )}

            {/* INVITE FORM */}
            {showInvite && (
              <div className="bg-surface border border-main rounded-xl p-5 mb-6">
                {inviteStep === 1 ? (
                  <>
                    <h3 className="text-sm font-semibold text-main mb-3">Step 1: Create user</h3>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      <div>
                        <label className="block text-[10px] text-muted uppercase font-semibold mb-1">Email *</label>
                        <input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="user@example.com" type="email"
                          className="w-full px-3 py-2 bg-surface border border-main rounded-lg text-sm text-main focus:outline-none focus:border-[var(--accent)]" />
                      </div>
                      <div>
                        <label className="block text-[10px] text-muted uppercase font-semibold mb-1">Password *</label>
                        <input value={invitePassword} onChange={e => setInvitePassword(e.target.value)} placeholder="Min 6 characters" type="text"
                          className="w-full px-3 py-2 bg-surface border border-main rounded-lg text-sm text-main focus:outline-none focus:border-[var(--accent)]" />
                      </div>
                      <div>
                        <label className="block text-[10px] text-muted uppercase font-semibold mb-1">Role *</label>
                        <select value={inviteRole} onChange={e => setInviteRole(e.target.value)}
                          className="w-full px-3 py-2 bg-surface border border-main rounded-lg text-sm text-main focus:outline-none focus:border-[var(--accent)]">
                          {ROLE_OPTIONS.map(r => (
                            <option key={r.value} value={r.value}>{r.label}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex items-end">
                        <button onClick={handleInvite} disabled={inviting || !inviteEmail.trim() || !invitePassword.trim()}
                          className="w-full px-4 py-2 bg-accent text-white rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50">
                          {inviting ? "Creating..." : "Create user →"}
                        </button>
                      </div>
                    </div>
                    <div className="mt-2 flex gap-4">
                      {ROLE_OPTIONS.map(r => (
                        <p key={r.value} className="text-[10px] text-hint">
                          <span className="font-semibold">{r.label}:</span> {r.desc}
                        </p>
                      ))}
                    </div>
                  </>
                ) : (
                  <>
                    <h3 className="text-sm font-semibold text-main mb-1">Step 2: Assign project access</h3>
                    <p className="text-xs text-muted mb-4">Select which projects <strong>{inviteEmail}</strong> ({inviteRole}) can access:</p>
                    <div className="space-y-1.5 mb-4">
                      {projects.map(p => (
                        <label key={p.id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface2 cursor-pointer border border-main">
                          <input type="checkbox" checked={newUserProjects.includes(p.id)}
                            onChange={() => setNewUserProjects(prev => prev.includes(p.id) ? prev.filter(x => x !== p.id) : [...prev, p.id])}
                            className="rounded border-gray-300 text-accent" />
                          <span className="text-sm text-main">{p.name}</span>
                        </label>
                      ))}
                      {projects.length === 0 && <p className="text-sm text-hint">No projects available</p>}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={handleAssignProjects} disabled={inviting}
                        className="px-5 py-2 bg-accent text-white rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50">
                        {inviting ? "Saving..." : `Assign ${newUserProjects.length} project${newUserProjects.length !== 1 ? "s" : ""} & finish`}
                      </button>
                      <button onClick={handleAssignProjects}
                        className="px-5 py-2 border border-main rounded-lg text-sm text-muted hover:text-main">
                        Skip — no project access
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {loading ? (
              <p className="text-hint text-center py-20">Loading users...</p>
            ) : (
              <div className="flex gap-6">
                {/* USER LIST */}
                <div className="flex-1">
                  <div className="bg-surface border border-main rounded-xl overflow-hidden">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-main text-left">
                          <th className="px-4 py-3 text-[10px] text-muted uppercase font-semibold">Email</th>
                          <th className="px-4 py-3 text-[10px] text-muted uppercase font-semibold">Role</th>
                          <th className="px-4 py-3 text-[10px] text-muted uppercase font-semibold">Projects</th>
                          <th className="px-4 py-3 text-[10px] text-muted uppercase font-semibold">Added</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.map(u => {
                          const accessCount = (projectAccess[u.user_id] || []).length;
                          const isSelected = selectedUser === u.user_id;
                          return (
                            <tr key={u.user_id}
                              onClick={() => setSelectedUser(isSelected ? null : u.user_id)}
                              className={`border-b border-main cursor-pointer transition ${isSelected ? "bg-accent-soft" : "hover:bg-surface2"}`}>
                              <td className="px-4 py-3 text-sm text-main">{u.email}</td>
                              <td className="px-4 py-3">
                                <select
                                  value={u.role}
                                  onChange={(e) => { e.stopPropagation(); updateRole(u.user_id, e.target.value); }}
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-xs px-2 py-1 bg-surface border border-main rounded-md text-main">
                                  {ROLE_OPTIONS.map(r => (
                                    <option key={r.value} value={r.value}>{r.label}</option>
                                  ))}
                                </select>
                              </td>
                              <td className="px-4 py-3 text-xs text-muted">
                                {u.role === "full_admin" ? (
                                  <span className="text-accent font-medium">All projects</span>
                                ) : (
                                  `${accessCount} of ${projects.length}`
                                )}
                              </td>
                              <td className="px-4 py-3 text-xs text-hint">
                                {new Date(u.created_at).toLocaleDateString()}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {users.length === 0 && (
                      <p className="text-center py-10 text-hint text-sm">No users found</p>
                    )}
                  </div>
                </div>

                {/* PROJECT ACCESS PANEL */}
                {selectedUserData && selectedUserData.role !== "full_admin" && (
                  <div className="w-80 bg-surface border border-main rounded-xl p-5 h-fit sticky top-20">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-sm font-semibold text-main">Project Access</h3>
                        <p className="text-[10px] text-muted mt-0.5">{selectedUserData.email}</p>
                      </div>
                      <button onClick={() => setSelectedUser(null)} className="text-hint hover:text-muted text-lg leading-none">&times;</button>
                    </div>

                    {/* Quick actions */}
                    <div className="flex gap-2 mb-3">
                      <button onClick={() => grantAllProjects(selectedUserData)}
                        className="text-[10px] text-accent hover:underline font-medium">Grant all</button>
                      <span className="text-hint">|</span>
                      <button onClick={() => revokeAllProjects(selectedUserData)}
                        className="text-[10px] text-red-400 hover:underline font-medium">Revoke all</button>
                    </div>

                    {/* Project checkboxes */}
                    <div className="space-y-1.5 max-h-96 overflow-y-auto">
                      {projects.map(p => {
                        const hasAccess = (projectAccess[selectedUserData.user_id] || []).includes(p.id);
                        return (
                          <label key={p.id} className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-surface2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={hasAccess}
                              onChange={() => toggleProjectAccess(selectedUserData, p.id)}
                              className="rounded border-gray-300 text-accent focus:ring-accent"
                            />
                            <span className={`text-xs ${hasAccess ? "text-main font-medium" : "text-muted"}`}>{p.name}</span>
                          </label>
                        );
                      })}
                    </div>

                    {/* Delete user */}
                    <div className="mt-6 pt-4 border-t border-main">
                      <button onClick={() => deleteUser(selectedUserData)}
                        className="text-xs text-red-400 hover:text-red-600 font-medium">
                        Remove user from platform
                      </button>
                    </div>
                  </div>
                )}

                {/* Info panel for full_admin */}
                {selectedUserData && selectedUserData.role === "full_admin" && (
                  <div className="w-80 bg-surface border border-main rounded-xl p-5 h-fit sticky top-20">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-sm font-semibold text-main">Full Admin</h3>
                        <p className="text-[10px] text-muted mt-0.5">{selectedUserData.email}</p>
                      </div>
                      <button onClick={() => setSelectedUser(null)} className="text-hint hover:text-muted text-lg leading-none">&times;</button>
                    </div>
                    <p className="text-xs text-muted">Full Admins automatically have access to all projects and all modules. No project assignment needed.</p>

                    {/* Delete user */}
                    <div className="mt-6 pt-4 border-t border-main">
                      <button onClick={() => deleteUser(selectedUserData)}
                        className="text-xs text-red-400 hover:text-red-600 font-medium">
                        Remove user from platform
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </ProjectGuard>
    </AuthGuard>
  );
}
