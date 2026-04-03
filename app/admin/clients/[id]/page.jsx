"use client";
import { useState, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { useRole } from "@/lib/role-context";
import Nav from "@/components/Nav";
import AuthGuard from "@/components/AuthGuard";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

const STATUS_COLORS = {
  active: { bg: "bg-green-100", text: "text-green-700" },
  trial: { bg: "bg-yellow-100", text: "text-yellow-700" },
  paused: { bg: "bg-orange-100", text: "text-orange-700" },
  churned: { bg: "bg-red-100", text: "text-red-700" },
  lead: { bg: "bg-gray-100", text: "text-gray-600" },
};

const TIER_COLORS = {
  starter: { bg: "bg-gray-100", text: "text-gray-600" },
  standard: { bg: "bg-blue-100", text: "text-blue-700" },
  premium: { bg: "bg-purple-100", text: "text-purple-700" },
  enterprise: { bg: "bg-indigo-100", text: "text-indigo-700" },
};

const STATUS_OPTIONS = ["active", "trial", "paused", "churned", "lead"];
const TIER_OPTIONS = ["starter", "standard", "premium", "enterprise"];

function StatCard({ label, value, sub, accent }) {
  return (
    <div className="bg-surface border border-main rounded-xl p-5">
      <p className="text-[10px] text-muted uppercase font-semibold tracking-wide">{label}</p>
      <p className="text-3xl font-bold mt-1" style={{ color: accent || "var(--text)" }}>{value}</p>
      {sub && <p className="text-xs text-hint mt-1">{sub}</p>}
    </div>
  );
}

export default function ClientDetailPage() {
  const { id } = useParams();
  const { role } = useRole();
  const router = useRouter();
  const supabase = createClient();

  const [client, setClient] = useState(null);
  const [clientProjects, setClientProjects] = useState([]);
  const [localEntries, setLocalEntries] = useState([]);
  const [globalEntries, setGlobalEntries] = useState([]);
  const [reports, setReports] = useState([]);
  const [showcases, setShowcases] = useState([]);
  const [teamUsers, setTeamUsers] = useState([]);
  const [activityLog, setActivityLog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  const [newNote, setNewNote] = useState("");

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  const loadData = async () => {
    // Load client
    const { data: clientData } = await supabase.from("clients").select("*").eq("id", id).single();
    if (!clientData) { setLoading(false); return; }
    setClient(clientData);
    setEditForm(clientData);

    // Load client's projects
    const { data: projData } = await supabase.from("projects").select("id, name, created_at").eq("client_id", id);
    const prjs = projData || [];
    setClientProjects(prjs);

    const projectIds = prjs.map(p => p.id);
    if (projectIds.length > 0) {
      const [csRes, reportsRes, showcasesRes, accessRes] = await Promise.all([
        supabase.from("creative_source").select("id, project_id, created_at, created_by, scope").in("project_id", projectIds),
        supabase.from("saved_reports").select("id, project_id, created_at, created_by").in("project_id", projectIds),
        supabase.from("saved_showcases").select("id, project_id, created_at").in("project_id", projectIds),
        supabase.from("project_access").select("user_id, email, project_id").in("project_id", projectIds),
      ]);
      setLocalEntries((csRes.data || []).filter(e => e.scope === "local"));
      setGlobalEntries((csRes.data || []).filter(e => e.scope === "global"));
      setReports(reportsRes.data || []);
      setShowcases(showcasesRes.data || []);

      // Deduplicate team users by email
      const userMap = {};
      (accessRes.data || []).forEach(a => {
        if (!userMap[a.email]) userMap[a.email] = { email: a.email, user_id: a.user_id, projects: [] };
        const projName = prjs.find(p => p.id === a.project_id)?.name || a.project_id;
        userMap[a.email].projects.push(projName);
      });
      setTeamUsers(Object.values(userMap));
    } else {
      setLocalEntries([]); setGlobalEntries([]); setReports([]); setShowcases([]); setTeamUsers([]);
    }

    // Load activity log
    const { data: logData } = await supabase
      .from("client_activity_log")
      .select("*")
      .eq("client_id", id)
      .order("created_at", { ascending: false })
      .limit(50);
    setActivityLog(logData || []);

    setLoading(false);
  };

  useEffect(() => {
    if (role === "full_admin") loadData();
  }, [role, id]);

  // Redirect non-admins
  if (role && role !== "full_admin") {
    router.replace("/dashboard");
    return null;
  }

  const allEntries = [...localEntries, ...globalEntries];

  // Usage chart data — entries over last 90 days
  const chartData = useMemo(() => {
    const now = new Date();
    const days = [];
    for (let i = 89; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
      const local = localEntries.filter(e => e.created_at?.startsWith(key)).length;
      const global = globalEntries.filter(e => e.created_at?.startsWith(key)).length;
      days.push({ date: label, local, global, total: local + global });
    }
    return days;
  }, [localEntries, globalEntries]);

  // Days since last activity
  const daysSinceActivity = useMemo(() => {
    if (allEntries.length === 0) return "N/A";
    const latest = allEntries.reduce((l, e) => e.created_at > l ? e.created_at : l, "");
    const diff = Math.floor((Date.now() - new Date(latest).getTime()) / 86400000);
    return diff;
  }, [allEntries]);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase.from("clients").update({
      name: editForm.name,
      primary_contact_name: editForm.primary_contact_name,
      primary_contact_email: editForm.primary_contact_email,
      website: editForm.website,
      industry: editForm.industry,
      country: editForm.country,
      company_size: editForm.company_size,
      status: editForm.status,
      tier: editForm.tier,
      contract_start: editForm.contract_start || null,
      contract_end: editForm.contract_end || null,
      monthly_value: editForm.monthly_value ? Number(editForm.monthly_value) : null,
      notes: editForm.notes,
      logo_url: editForm.logo_url,
      updated_at: new Date().toISOString(),
    }).eq("id", id);

    if (error) {
      showToast("Error: " + error.message);
    } else {
      showToast("Client updated");
      setEditing(false);
      loadData();
    }
    setSaving(false);
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    const { data: { session } } = await supabase.auth.getSession();
    await supabase.from("client_activity_log").insert({
      client_id: id,
      action: "note",
      description: newNote.trim(),
      performed_by: session?.user?.email || "unknown",
    });
    setNewNote("");
    showToast("Note added");
    // Reload activity log
    const { data: logData } = await supabase
      .from("client_activity_log")
      .select("*")
      .eq("client_id", id)
      .order("created_at", { ascending: false })
      .limit(50);
    setActivityLog(logData || []);
  };

  const formatDate = (d) => d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—";

  if (loading) return (
    <AuthGuard><Nav />
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg)" }}>
        <div className="text-center">
          <div className="w-10 h-10 mx-auto mb-3 rounded-full flex items-center justify-center" style={{ background: "#0a0f3c" }}>
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="white" strokeWidth="3" fill="none"/><path className="opacity-75" fill="white" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          </div>
          <p className="text-sm text-muted">Loading client...</p>
        </div>
      </div>
    </AuthGuard>
  );

  if (!client) return (
    <AuthGuard><Nav />
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg)" }}>
        <div className="text-center">
          <p className="text-sm text-muted mb-4">Client not found</p>
          <button onClick={() => router.push("/admin/clients")} className="text-sm text-accent hover:underline">Back to clients</button>
        </div>
      </div>
    </AuthGuard>
  );

  const statusStyle = STATUS_COLORS[client.status] || STATUS_COLORS.lead;
  const tierStyle = TIER_COLORS[client.tier] || TIER_COLORS.starter;

  return (
    <AuthGuard>
      <Nav />
      <div className="min-h-screen" style={{ background: "var(--bg)" }}>
        <div className="p-5 max-w-6xl mx-auto space-y-5">
          {/* TOAST */}
          {toast && (
            <div className="fixed top-4 right-4 bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium z-50 shadow-lg">
              {toast}
            </div>
          )}

          {/* HEADER */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button onClick={() => router.push("/admin/clients")}
                className="w-8 h-8 rounded-lg flex items-center justify-center bg-surface border border-main hover:bg-surface2 transition">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted">
                  <path d="M19 12H5M12 19l-7-7 7-7"/>
                </svg>
              </button>
              <div className="flex items-center gap-3">
                {client.logo_url ? (
                  <img src={client.logo_url} alt="" className="w-10 h-10 rounded-xl object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold uppercase"
                    style={{ background: "#4060ff22", color: "#4060ff" }}>
                    {client.name?.[0] || "?"}
                  </div>
                )}
                <div>
                  <h1 className="text-xl font-bold text-main">{client.name}</h1>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${statusStyle.bg} ${statusStyle.text}`}>
                      {client.status?.charAt(0).toUpperCase() + client.status?.slice(1)}
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${tierStyle.bg} ${tierStyle.text}`}>
                      {client.tier?.charAt(0).toUpperCase() + client.tier?.slice(1)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <button onClick={() => { if (editing) { handleSave(); } else { setEditing(true); } }}
              className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-semibold hover:opacity-90">
              {saving ? "Saving..." : editing ? "Save Changes" : "Edit"}
            </button>
          </div>

          {/* SECTION 1: PROFILE */}
          <div className="bg-surface border border-main rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-main">Profile</h3>
              {editing && (
                <button onClick={() => { setEditing(false); setEditForm(client); }} className="text-xs text-hint hover:text-muted">Cancel edit</button>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { label: "Name", key: "name" },
                { label: "Contact Name", key: "primary_contact_name" },
                { label: "Contact Email", key: "primary_contact_email" },
                { label: "Website", key: "website" },
                { label: "Industry", key: "industry" },
                { label: "Country", key: "country" },
                { label: "Company Size", key: "company_size" },
                { label: "Logo URL", key: "logo_url" },
                { label: "Monthly Value ($)", key: "monthly_value", type: "number" },
                { label: "Contract Start", key: "contract_start", type: "date" },
                { label: "Contract End", key: "contract_end", type: "date" },
              ].map(field => (
                <div key={field.key}>
                  <label className="block text-[10px] text-muted uppercase font-semibold mb-1">{field.label}</label>
                  {editing ? (
                    <input
                      value={editForm[field.key] || ""}
                      onChange={e => setEditForm({ ...editForm, [field.key]: e.target.value })}
                      type={field.type || "text"}
                      className="w-full px-3 py-2 bg-surface border border-main rounded-lg text-sm text-main focus:outline-none focus:border-[var(--accent)]"
                    />
                  ) : (
                    <p className="text-sm text-main py-2">
                      {field.type === "date" ? formatDate(client[field.key])
                        : field.key === "monthly_value" ? (client[field.key] ? `$${Number(client[field.key]).toLocaleString()}` : "—")
                        : client[field.key] || "—"}
                    </p>
                  )}
                </div>
              ))}
              {/* Status & Tier selects */}
              <div>
                <label className="block text-[10px] text-muted uppercase font-semibold mb-1">Status</label>
                {editing ? (
                  <select value={editForm.status || "lead"} onChange={e => setEditForm({ ...editForm, status: e.target.value })}
                    className="w-full px-3 py-2 bg-surface border border-main rounded-lg text-sm text-main focus:outline-none focus:border-[var(--accent)]">
                    {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                  </select>
                ) : (
                  <p className="text-sm text-main py-2">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${statusStyle.bg} ${statusStyle.text}`}>
                      {client.status?.charAt(0).toUpperCase() + client.status?.slice(1)}
                    </span>
                  </p>
                )}
              </div>
              <div>
                <label className="block text-[10px] text-muted uppercase font-semibold mb-1">Tier</label>
                {editing ? (
                  <select value={editForm.tier || "standard"} onChange={e => setEditForm({ ...editForm, tier: e.target.value })}
                    className="w-full px-3 py-2 bg-surface border border-main rounded-lg text-sm text-main focus:outline-none focus:border-[var(--accent)]">
                    {TIER_OPTIONS.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                  </select>
                ) : (
                  <p className="text-sm text-main py-2">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${tierStyle.bg} ${tierStyle.text}`}>
                      {client.tier?.charAt(0).toUpperCase() + client.tier?.slice(1)}
                    </span>
                  </p>
                )}
              </div>
            </div>
            {/* Notes */}
            <div className="mt-4">
              <label className="block text-[10px] text-muted uppercase font-semibold mb-1">Notes</label>
              {editing ? (
                <textarea value={editForm.notes || ""} onChange={e => setEditForm({ ...editForm, notes: e.target.value })} rows={3}
                  className="w-full px-3 py-2 bg-surface border border-main rounded-lg text-sm text-main focus:outline-none focus:border-[var(--accent)]" />
              ) : (
                <p className="text-sm text-muted py-2 whitespace-pre-wrap">{client.notes || "—"}</p>
              )}
            </div>
          </div>

          {/* SECTION 2: QUICK STATS */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <StatCard label="Projects" value={clientProjects.length} accent="#4060ff" />
            <StatCard label="Entries" value={allEntries.length} sub={`${localEntries.length} local · ${globalEntries.length} global`} accent="#7DCFB6" />
            <StatCard label="Reports" value={reports.length} accent="#B8A9E8" />
            <StatCard label="Showcases" value={showcases.length} accent="#E8C87D" />
            <StatCard label="Team Members" value={teamUsers.length} accent="#F4A7A7" />
            <StatCard label="Days Inactive" value={daysSinceActivity} accent="#82CCE5" />
          </div>

          {/* SECTION 3: PROJECTS */}
          <div className="bg-surface border border-main rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-main">Projects</h3>
            </div>
            {clientProjects.length > 0 ? (
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-main text-left">
                    <th className="px-3 py-2 text-[10px] text-muted uppercase font-semibold">Name</th>
                    <th className="px-3 py-2 text-[10px] text-muted uppercase font-semibold">Entries</th>
                    <th className="px-3 py-2 text-[10px] text-muted uppercase font-semibold">Reports</th>
                    <th className="px-3 py-2 text-[10px] text-muted uppercase font-semibold">Showcases</th>
                    <th className="px-3 py-2 text-[10px] text-muted uppercase font-semibold">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {clientProjects.map(p => {
                    const pEntries = allEntries.filter(e => e.project_id === p.id).length;
                    const pReports = reports.filter(r => r.project_id === p.id).length;
                    const pShowcases = showcases.filter(s => s.project_id === p.id).length;
                    return (
                      <tr key={p.id} className="border-b border-main">
                        <td className="px-3 py-2 text-sm font-medium text-main">{p.name}</td>
                        <td className="px-3 py-2 text-sm text-muted">{pEntries}</td>
                        <td className="px-3 py-2 text-sm text-muted">{pReports}</td>
                        <td className="px-3 py-2 text-sm text-muted">{pShowcases}</td>
                        <td className="px-3 py-2 text-xs text-hint">{formatDate(p.created_at)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <p className="text-sm text-hint text-center py-6">No projects linked to this client yet.</p>
            )}
          </div>

          {/* SECTION 4: TEAM */}
          <div className="bg-surface border border-main rounded-xl p-5">
            <h3 className="text-sm font-semibold text-main mb-4">Team</h3>
            {teamUsers.length > 0 ? (
              <div className="space-y-2">
                {teamUsers.map((u, i) => (
                  <div key={u.email} className="flex items-center gap-3 py-2 border-b border-main last:border-0">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold uppercase"
                      style={{ background: "#4060ff22", color: "#4060ff" }}>
                      {u.email[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-main truncate">{u.email}</p>
                      <p className="text-[10px] text-hint">
                        {u.projects.join(", ")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-hint text-center py-6">No team members with project access.</p>
            )}
          </div>

          {/* SECTION 5: USAGE CHART */}
          <div className="bg-surface border border-main rounded-xl p-5">
            <h3 className="text-sm font-semibold text-main mb-4">Usage — Last 90 days</h3>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData} margin={{ left: 10, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: "var(--text3)" }} interval={8} />
                <YAxis tick={{ fontSize: 10, fill: "var(--text3)" }} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid var(--border)" }} />
                <Line type="monotone" dataKey="local" stroke="#4060ff" strokeWidth={2} dot={false} name="Local entries" />
                <Line type="monotone" dataKey="global" stroke="#7DCFB6" strokeWidth={2} dot={false} name="Global entries" />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* SECTION 6: ACTIVITY LOG */}
          <div className="bg-surface border border-main rounded-xl p-5">
            <h3 className="text-sm font-semibold text-main mb-4">Activity Log</h3>
            {/* Add note input */}
            <div className="flex gap-2 mb-4">
              <input
                value={newNote} onChange={e => setNewNote(e.target.value)}
                placeholder="Add a note..."
                onKeyDown={e => e.key === "Enter" && handleAddNote()}
                className="flex-1 px-3 py-2 bg-surface border border-main rounded-lg text-sm text-main focus:outline-none focus:border-[var(--accent)]"
              />
              <button onClick={handleAddNote} disabled={!newNote.trim()}
                className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50">
                Add
              </button>
            </div>
            {activityLog.length > 0 ? (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {activityLog.map((log, i) => (
                  <div key={log.id || i} className="flex gap-3 items-start py-2 border-b border-main last:border-0">
                    <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                      style={{ background: log.action === "note" ? "#4060ff" : "#7DCFB6" }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-main">{log.description}</p>
                      <p className="text-[10px] text-hint mt-0.5">
                        {log.performed_by} — {formatDate(log.created_at)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-hint text-center py-6">No activity logged yet.</p>
            )}
          </div>

          <div className="text-center py-4">
            <p className="text-[10px] text-hint">Groundwork by Knots & Dots — Client Management</p>
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}
