"use client";
import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { useRole } from "@/lib/role-context";
import Nav from "@/components/Nav";
import AuthGuard from "@/components/AuthGuard";

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

export default function ClientsPage() {
  const { role } = useRole();
  const router = useRouter();
  const supabase = createClient();

  const [clients, setClients] = useState([]);
  const [projects, setProjects] = useState([]);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");

  // New client form
  const [form, setForm] = useState({
    name: "", primary_contact_name: "", primary_contact_email: "", website: "",
    industry: "", country: "", company_size: "", status: "lead", tier: "standard",
    contract_start: "", contract_end: "", monthly_value: "", notes: "",
  });

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  const loadData = async () => {
    const [clientsRes, projectsRes, localRes, globalRes] = await Promise.all([
      supabase.from("clients").select("*").order("created_at", { ascending: false }),
      supabase.from("projects").select("id, name, client_id, created_at"),
      supabase.from("audit_entries").select("id, project_id, created_at"),
      supabase.from("audit_global").select("id, project_id, created_at"),
    ]);
    setClients(clientsRes.data || []);
    setProjects(projectsRes.data || []);
    setEntries([...(localRes.data || []), ...(globalRes.data || [])]);
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

  const clientStats = useMemo(() => {
    const map = {};
    clients.forEach(c => {
      const clientProjects = projects.filter(p => p.client_id === c.id);
      const projectIds = new Set(clientProjects.map(p => p.id));
      const clientEntries = entries.filter(e => projectIds.has(e.project_id));
      const lastActivity = clientEntries.length > 0
        ? clientEntries.reduce((latest, e) => e.created_at > latest ? e.created_at : latest, "")
        : null;
      map[c.id] = { projects: clientProjects.length, entries: clientEntries.length, lastActivity };
    });
    return map;
  }, [clients, projects, entries]);

  const filtered = useMemo(() => {
    return clients.filter(c => {
      const matchSearch = !search || c.name?.toLowerCase().includes(search.toLowerCase())
        || c.primary_contact_name?.toLowerCase().includes(search.toLowerCase())
        || c.industry?.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === "all" || c.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [clients, search, statusFilter]);

  const totalMRR = clients.filter(c => c.status === "active").reduce((sum, c) => sum + (Number(c.monthly_value) || 0), 0);
  const activeCount = clients.filter(c => c.status === "active").length;
  const avgProjects = clients.length > 0
    ? (Object.values(clientStats).reduce((s, v) => s + v.projects, 0) / clients.length).toFixed(1)
    : "0";

  const handleAdd = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    const { data: { session } } = await supabase.auth.getSession();
    const slug = form.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const { error } = await supabase.from("clients").insert({
      ...form,
      slug,
      monthly_value: form.monthly_value ? Number(form.monthly_value) : null,
      created_by: session?.user?.id || null,
    });
    if (error) {
      showToast("Error: " + error.message);
    } else {
      showToast("Client added");
      setForm({ name: "", primary_contact_name: "", primary_contact_email: "", website: "", industry: "", country: "", company_size: "", status: "lead", tier: "standard", contract_start: "", contract_end: "", monthly_value: "", notes: "" });
      setShowAdd(false);
      loadData();
    }
    setSaving(false);
  };

  const formatDate = (d) => d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "2-digit" }) : "—";
  const formatCurrency = (v) => v ? `$${Number(v).toLocaleString()}` : "—";

  return (
    <AuthGuard>
      <Nav />
      <div className="min-h-screen" style={{ background: "var(--bg)" }}>
        {/* HEADER BAR */}
        <div className="section-bar px-5 py-3 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-bold text-main">Client Management</h2>
            <span className="text-[10px] text-hint bg-accent-soft px-2 py-0.5 rounded-full font-semibold">Admin</span>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="text" placeholder="Search clients..."
              value={search} onChange={e => setSearch(e.target.value)}
              className="px-3 py-1.5 bg-surface border border-main rounded-lg text-xs text-main w-48 focus:outline-none focus:border-[var(--accent)]"
            />
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              className="px-2 py-1.5 bg-surface border border-main rounded-lg text-xs text-main">
              <option value="all">All statuses</option>
              {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
            </select>
            <button onClick={() => setShowAdd(!showAdd)}
              className="px-4 py-1.5 bg-accent text-white rounded-lg text-sm font-semibold hover:opacity-90">
              {showAdd ? "Cancel" : "+ Add Client"}
            </button>
          </div>
        </div>

        <div className="p-5 max-w-6xl mx-auto space-y-5">
          {/* TOAST */}
          {toast && (
            <div className="fixed top-4 right-4 bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium z-50 shadow-lg">
              {toast}
            </div>
          )}

          {/* STATS */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Total Clients" value={clients.length} accent="#4060ff" />
            <StatCard label="Active" value={activeCount} accent="#7DCFB6" />
            <StatCard label="Total MRR" value={formatCurrency(totalMRR)} accent="#B8A9E8" />
            <StatCard label="Avg Projects / Client" value={avgProjects} accent="#E8C87D" />
          </div>

          {/* ADD CLIENT FORM */}
          {showAdd && (
            <div className="bg-surface border border-main rounded-xl p-5">
              <h3 className="text-sm font-semibold text-main mb-3">Add new client</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] text-muted uppercase font-semibold mb-1">Name *</label>
                  <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Company name"
                    className="w-full px-3 py-2 bg-surface border border-main rounded-lg text-sm text-main focus:outline-none focus:border-[var(--accent)]" />
                </div>
                <div>
                  <label className="block text-[10px] text-muted uppercase font-semibold mb-1">Contact Name</label>
                  <input value={form.primary_contact_name} onChange={e => setForm({ ...form, primary_contact_name: e.target.value })} placeholder="John Smith"
                    className="w-full px-3 py-2 bg-surface border border-main rounded-lg text-sm text-main focus:outline-none focus:border-[var(--accent)]" />
                </div>
                <div>
                  <label className="block text-[10px] text-muted uppercase font-semibold mb-1">Contact Email</label>
                  <input value={form.primary_contact_email} onChange={e => setForm({ ...form, primary_contact_email: e.target.value })} placeholder="john@company.com" type="email"
                    className="w-full px-3 py-2 bg-surface border border-main rounded-lg text-sm text-main focus:outline-none focus:border-[var(--accent)]" />
                </div>
                <div>
                  <label className="block text-[10px] text-muted uppercase font-semibold mb-1">Industry</label>
                  <input value={form.industry} onChange={e => setForm({ ...form, industry: e.target.value })} placeholder="Financial services"
                    className="w-full px-3 py-2 bg-surface border border-main rounded-lg text-sm text-main focus:outline-none focus:border-[var(--accent)]" />
                </div>
                <div>
                  <label className="block text-[10px] text-muted uppercase font-semibold mb-1">Country</label>
                  <input value={form.country} onChange={e => setForm({ ...form, country: e.target.value })} placeholder="United Kingdom"
                    className="w-full px-3 py-2 bg-surface border border-main rounded-lg text-sm text-main focus:outline-none focus:border-[var(--accent)]" />
                </div>
                <div>
                  <label className="block text-[10px] text-muted uppercase font-semibold mb-1">Company Size</label>
                  <input value={form.company_size} onChange={e => setForm({ ...form, company_size: e.target.value })} placeholder="50-200"
                    className="w-full px-3 py-2 bg-surface border border-main rounded-lg text-sm text-main focus:outline-none focus:border-[var(--accent)]" />
                </div>
                <div>
                  <label className="block text-[10px] text-muted uppercase font-semibold mb-1">Status</label>
                  <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}
                    className="w-full px-3 py-2 bg-surface border border-main rounded-lg text-sm text-main focus:outline-none focus:border-[var(--accent)]">
                    {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-muted uppercase font-semibold mb-1">Tier</label>
                  <select value={form.tier} onChange={e => setForm({ ...form, tier: e.target.value })}
                    className="w-full px-3 py-2 bg-surface border border-main rounded-lg text-sm text-main focus:outline-none focus:border-[var(--accent)]">
                    {TIER_OPTIONS.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-muted uppercase font-semibold mb-1">Monthly Value ($)</label>
                  <input value={form.monthly_value} onChange={e => setForm({ ...form, monthly_value: e.target.value })} placeholder="5000" type="number"
                    className="w-full px-3 py-2 bg-surface border border-main rounded-lg text-sm text-main focus:outline-none focus:border-[var(--accent)]" />
                </div>
                <div>
                  <label className="block text-[10px] text-muted uppercase font-semibold mb-1">Contract Start</label>
                  <input value={form.contract_start} onChange={e => setForm({ ...form, contract_start: e.target.value })} type="date"
                    className="w-full px-3 py-2 bg-surface border border-main rounded-lg text-sm text-main focus:outline-none focus:border-[var(--accent)]" />
                </div>
                <div>
                  <label className="block text-[10px] text-muted uppercase font-semibold mb-1">Contract End</label>
                  <input value={form.contract_end} onChange={e => setForm({ ...form, contract_end: e.target.value })} type="date"
                    className="w-full px-3 py-2 bg-surface border border-main rounded-lg text-sm text-main focus:outline-none focus:border-[var(--accent)]" />
                </div>
                <div>
                  <label className="block text-[10px] text-muted uppercase font-semibold mb-1">Website</label>
                  <input value={form.website} onChange={e => setForm({ ...form, website: e.target.value })} placeholder="https://company.com"
                    className="w-full px-3 py-2 bg-surface border border-main rounded-lg text-sm text-main focus:outline-none focus:border-[var(--accent)]" />
                </div>
              </div>
              <div className="mt-3">
                <label className="block text-[10px] text-muted uppercase font-semibold mb-1">Notes</label>
                <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} placeholder="Internal notes about this client..."
                  className="w-full px-3 py-2 bg-surface border border-main rounded-lg text-sm text-main focus:outline-none focus:border-[var(--accent)]" />
              </div>
              <div className="mt-3 flex justify-end">
                <button onClick={handleAdd} disabled={saving || !form.name.trim()}
                  className="px-6 py-2 bg-accent text-white rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50">
                  {saving ? "Saving..." : "Add Client"}
                </button>
              </div>
            </div>
          )}

          {/* CLIENTS TABLE */}
          {loading ? (
            <div className="text-center py-20">
              <div className="w-10 h-10 mx-auto mb-3 rounded-full flex items-center justify-center" style={{ background: "#0a0f3c" }}>
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="white" strokeWidth="3" fill="none"/><path className="opacity-75" fill="white" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
              </div>
              <p className="text-sm text-muted">Loading clients...</p>
            </div>
          ) : (
            <div className="bg-surface border border-main rounded-xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-main text-left">
                    <th className="px-4 py-3 text-[10px] text-muted uppercase font-semibold">Client</th>
                    <th className="px-4 py-3 text-[10px] text-muted uppercase font-semibold">Status</th>
                    <th className="px-4 py-3 text-[10px] text-muted uppercase font-semibold">Tier</th>
                    <th className="px-4 py-3 text-[10px] text-muted uppercase font-semibold">Projects</th>
                    <th className="px-4 py-3 text-[10px] text-muted uppercase font-semibold">Entries</th>
                    <th className="px-4 py-3 text-[10px] text-muted uppercase font-semibold">Last Activity</th>
                    <th className="px-4 py-3 text-[10px] text-muted uppercase font-semibold">Contract End</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(c => {
                    const st = clientStats[c.id] || { projects: 0, entries: 0, lastActivity: null };
                    const statusStyle = STATUS_COLORS[c.status] || STATUS_COLORS.lead;
                    const tierStyle = TIER_COLORS[c.tier] || TIER_COLORS.starter;
                    return (
                      <tr key={c.id}
                        onClick={() => router.push(`/admin/clients/${c.id}`)}
                        className="border-b border-main cursor-pointer hover:bg-surface2 transition">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            {c.logo_url ? (
                              <img src={c.logo_url} alt="" className="w-8 h-8 rounded-lg object-cover" />
                            ) : (
                              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold uppercase"
                                style={{ background: "#4060ff22", color: "#4060ff" }}>
                                {c.name?.[0] || "?"}
                              </div>
                            )}
                            <div>
                              <p className="text-sm font-medium text-main">{c.name}</p>
                              {c.industry && <p className="text-[10px] text-hint">{c.industry}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${statusStyle.bg} ${statusStyle.text}`}>
                            {c.status?.charAt(0).toUpperCase() + c.status?.slice(1)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${tierStyle.bg} ${tierStyle.text}`}>
                            {c.tier?.charAt(0).toUpperCase() + c.tier?.slice(1)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-main">{st.projects}</td>
                        <td className="px-4 py-3 text-sm text-main">{st.entries}</td>
                        <td className="px-4 py-3 text-xs text-hint">{st.lastActivity ? formatDate(st.lastActivity) : "—"}</td>
                        <td className="px-4 py-3 text-xs text-hint">{formatDate(c.contract_end)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filtered.length === 0 && (
                <p className="text-center py-10 text-hint text-sm">
                  {clients.length === 0 ? "No clients yet. Add your first client above." : "No clients match your filters."}
                </p>
              )}
            </div>
          )}

          <div className="text-center py-4">
            <p className="text-[10px] text-hint">Groundwork by Knots & Dots — Client Management</p>
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}
