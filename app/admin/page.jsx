"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase";
import Nav from "@/components/Nav";
import AuthGuard from "@/components/AuthGuard";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, CartesianGrid, Legend } from "recharts";

const COLORS = ["#4060ff","#7DCFB6","#B8A9E8","#F4A7A7","#E8C87D","#82CCE5","#7DD4C8","#E8A0C8","#9B9BF0"];

function StatCard({ label, value, sub, accent }) {
  return (
    <div className="bg-surface border border-main rounded-xl p-5">
      <p className="text-[10px] text-muted uppercase font-semibold tracking-wide">{label}</p>
      <p className="text-3xl font-bold mt-1" style={{ color: accent || "var(--text)" }}>{value}</p>
      {sub && <p className="text-xs text-hint mt-1">{sub}</p>}
    </div>
  );
}

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [rawData, setRawData] = useState(null);
  const [timeframe, setTimeframe] = useState(30);
  const [selectedProject, setSelectedProject] = useState("all");
  const supabase = createClient();

  // Load raw data once
  useEffect(() => {
    (async () => {
      const [
        { data: projects },
        { data: localEntries },
        { data: globalEntries },
        { data: reports },
        { data: showcases },
        { data: users },
      ] = await Promise.all([
        supabase.from("projects").select("id, name, created_at"),
        supabase.from("audit_entries").select("id, created_by, created_at, updated_at, competitor, communication_intent, rating, project_id"),
        supabase.from("audit_global").select("id, created_by, created_at, updated_at, brand, communication_intent, rating, project_id"),
        supabase.from("saved_reports").select("id, created_by, created_at, template_type, project_id"),
        supabase.from("saved_showcases").select("id, created_by, created_at, project_id, slides"),
        supabase.from("user_roles").select("email, role, project_id"),
      ]);
      setRawData({ projects: projects || [], localEntries: localEntries || [], globalEntries: globalEntries || [], reports: reports || [], showcases: showcases || [], users: users || [] });
    })();
  }, []);

  // Recompute stats when filters change
  useEffect(() => {
    if (!rawData) return;
    const { projects, localEntries, globalEntries, reports: allReports, showcases: allShowcases, users } = rawData;
    const computeStats = () => {

    // Apply project filter
    const filterByProject = (arr) => selectedProject === "all" ? arr : arr.filter(e => e.project_id === selectedProject);
    const filteredLocal = filterByProject(localEntries);
    const filteredGlobal = filterByProject(globalEntries);
    const reports = filterByProject(allReports);
    const showcases = filterByProject(allShowcases);

    // Apply timeframe filter
    const cutoff = timeframe > 0 ? new Date(Date.now() - timeframe * 86400000).toISOString() : "";
    const filterByTime = (arr) => cutoff ? arr.filter(e => (e.created_at || "") >= cutoff) : arr;

    const localFiltered = filterByTime(filteredLocal);
    const globalFiltered = filterByTime(filteredGlobal);
    const reportsFiltered = filterByTime(reports);
    const showcasesFiltered = filterByTime(showcases);
    const allEntries = [...localFiltered, ...globalFiltered];

      // Users activity
      const userMap = {};
      allEntries.forEach(e => {
        if (!e.created_by) return;
        if (!userMap[e.created_by]) userMap[e.created_by] = { entries: 0, reports: 0, showcases: 0, lastActive: "" };
        userMap[e.created_by].entries++;
        if (e.updated_at > (userMap[e.created_by].lastActive || "")) userMap[e.created_by].lastActive = e.updated_at;
      });
      reportsFiltered.forEach(r => {
        if (!r.created_by) return;
        if (!userMap[r.created_by]) userMap[r.created_by] = { entries: 0, reports: 0, showcases: 0, lastActive: "" };
        userMap[r.created_by].reports++;
        if (r.created_at > (userMap[r.created_by].lastActive || "")) userMap[r.created_by].lastActive = r.created_at;
      });
      showcasesFiltered.forEach(s => {
        if (!s.created_by) return;
        if (!userMap[s.created_by]) userMap[s.created_by] = { entries: 0, reports: 0, showcases: 0, lastActive: "" };
        userMap[s.created_by].showcases++;
      });
      const activeUsers = Object.entries(userMap).map(([email, data]) => ({ email, ...data })).sort((a, b) => b.entries - a.entries);

      // Activity over time
      const now = new Date();
      const days = [];
      const chartDays = Math.min(timeframe || 30, 90);
      for (let i = chartDays - 1; i >= 0; i--) {
        const d = new Date(now); d.setDate(d.getDate() - i);
        const key = d.toISOString().slice(0, 10);
        const label = d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
        const entries = allEntries.filter(e => e.created_at?.startsWith(key)).length;
        const reps = reportsFiltered.filter(r => r.created_at?.startsWith(key)).length;
        days.push({ date: label, entries, reports: reps });
      }

      // Entries by project
      const projectMap = {};
      (projects || []).forEach(p => { projectMap[p.id] = p.name; });
      const byProject = {};
      allEntries.forEach(e => {
        const pName = projectMap[e.project_id] || e.project_id;
        byProject[pName] = (byProject[pName] || 0) + 1;
      });
      const projectData = Object.entries(byProject).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

      // Report types
      const reportTypes = {};
      reportsFiltered.forEach(r => {
        const t = r.template_type || "unknown";
        reportTypes[t] = (reportTypes[t] || 0) + 1;
      });
      const reportTypeData = Object.entries(reportTypes).map(([name, value]) => ({ name, value }));

      // Brands coverage
      const brandSet = new Set();
      allEntries.forEach(e => { if (e.competitor) brandSet.add(e.competitor); if (e.brand) brandSet.add(e.brand); });

      // Intent distribution
      const intents = {};
      allEntries.forEach(e => {
        if (!e.communication_intent) return;
        e.communication_intent.split(",").map(s => s.trim()).filter(Boolean).forEach(v => {
          intents[v] = (intents[v] || 0) + 1;
        });
      });
      const intentData = Object.entries(intents).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

      // Classified vs unclassified
      const classified = allEntries.filter(e => e.rating).length;

      // Showcase slides count
      const totalSlides = showcasesFiltered.reduce((s, sc) => s + (sc.slides?.length || 0), 0);

      setStats({
        totalEntries: allEntries.length,
        localEntries: localFiltered.length,
        globalEntries: globalFiltered.length,
        totalReports: reportsFiltered.length,
        totalShowcases: showcasesFiltered.length,
        totalSlides,
        totalBrands: brandSet.size,
        totalProjects: (projects || []).length,
        totalUsers: activeUsers.length,
        classified,
        unclassified: allEntries.length - classified,
        activeUsers,
        days,
        projectData,
        reportTypeData,
        intentData,
        roles: users,
        projects,
      });
      setLoading(false);
    };
    computeStats();
  }, [rawData, timeframe, selectedProject]);

  if (loading) return (
    <AuthGuard><Nav />
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg)" }}>
        <div className="text-center">
          <div className="w-10 h-10 mx-auto mb-3 rounded-full flex items-center justify-center" style={{ background: "#0a0f3c" }}>
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="white" strokeWidth="3" fill="none"/><path className="opacity-75" fill="white" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          </div>
          <p className="text-sm text-muted">Loading platform analytics...</p>
        </div>
      </div>
    </AuthGuard>
  );

  const s = stats;

  return (
    <AuthGuard><Nav />
      <div className="min-h-screen" style={{ background: "var(--bg)" }}>
        <div className="section-bar px-5 py-3 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-bold text-main">Platform Analytics</h2>
            <span className="text-[10px] text-hint bg-accent-soft px-2 py-0.5 rounded-full font-semibold">Admin</span>
          </div>
          <div className="flex items-center gap-3">
            <select value={selectedProject} onChange={e => setSelectedProject(e.target.value)}
              className="px-2 py-1 bg-surface border border-main rounded-lg text-xs text-main">
              <option value="all">All projects</option>
              {(rawData?.projects || []).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select value={timeframe} onChange={e => setTimeframe(Number(e.target.value))}
              className="px-2 py-1 bg-surface border border-main rounded-lg text-xs text-main">
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
              <option value={365}>Last year</option>
              <option value={0}>All time</option>
            </select>
          </div>
        </div>

        <div className="p-5 max-w-6xl mx-auto space-y-5">
          {/* ─── TOP STATS ─── */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            <StatCard label="Total Entries" value={s.totalEntries} sub={`${s.localEntries} local · ${s.globalEntries} global`} accent="#4060ff" />
            <StatCard label="Brands" value={s.totalBrands} accent="#7DCFB6" />
            <StatCard label="Reports" value={s.totalReports} accent="#B8A9E8" />
            <StatCard label="Showcases" value={s.totalShowcases} sub={`${s.totalSlides} slides`} accent="#E8C87D" />
            <StatCard label="Active Users" value={s.totalUsers} accent="#F4A7A7" />
            <StatCard label="Classified" value={`${Math.round((s.classified / Math.max(s.totalEntries, 1)) * 100)}%`} sub={`${s.unclassified} pending`} accent="#82CCE5" />
          </div>

          {/* ─── ACTIVITY TIMELINE ─── */}
          <div className="bg-surface border border-main rounded-xl p-5">
            <h3 className="text-sm font-semibold text-main mb-4">Activity — Last 30 days</h3>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={s.days} margin={{ left: 10, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: "var(--text3)" }} interval={4} />
                <YAxis tick={{ fontSize: 10, fill: "var(--text3)" }} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid var(--border)" }} />
                <Line type="monotone" dataKey="entries" stroke="#4060ff" strokeWidth={2} dot={false} name="Entries" />
                <Line type="monotone" dataKey="reports" stroke="#B8A9E8" strokeWidth={2} dot={false} name="Reports" />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* ─── USERS TABLE ─── */}
            <div className="bg-surface border border-main rounded-xl p-5">
              <h3 className="text-sm font-semibold text-main mb-4">Users</h3>
              <div className="space-y-2">
                {s.activeUsers.map((u, i) => (
                  <div key={u.email} className="flex items-center gap-3 py-2 border-b border-main last:border-0">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold uppercase"
                      style={{ background: COLORS[i % COLORS.length] + "22", color: COLORS[i % COLORS.length] }}>
                      {u.email[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-main truncate">{u.email}</p>
                      <p className="text-[10px] text-hint">
                        {u.entries} entries · {u.reports} reports · {u.showcases} showcases
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] text-hint">{u.lastActive ? new Date(u.lastActive).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "—"}</p>
                      <p className="text-[8px] text-hint">last active</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ─── ENTRIES BY PROJECT ─── */}
            <div className="bg-surface border border-main rounded-xl p-5">
              <h3 className="text-sm font-semibold text-main mb-4">Entries by project</h3>
              <ResponsiveContainer width="100%" height={Math.max(150, s.projectData.length * 36)}>
                <BarChart data={s.projectData} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <XAxis type="number" tick={{ fontSize: 10, fill: "var(--text3)" }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "var(--text)" }} width={120} />
                  <Tooltip />
                  <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                    {s.projectData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* ─── REPORT TYPES ─── */}
            <div className="bg-surface border border-main rounded-xl p-5">
              <h3 className="text-sm font-semibold text-main mb-4">Report types generated</h3>
              {s.reportTypeData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={s.reportTypeData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={85}>
                      {s.reportTypeData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : <p className="text-sm text-hint text-center py-8">No reports yet</p>}
            </div>

            {/* ─── INTENT DISTRIBUTION ─── */}
            <div className="bg-surface border border-main rounded-xl p-5">
              <h3 className="text-sm font-semibold text-main mb-4">Communication intent distribution</h3>
              {s.intentData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={s.intentData} margin={{ left: 10, right: 10 }}>
                    <XAxis dataKey="name" tick={{ fontSize: 9, fill: "var(--text2)" }} angle={-20} textAnchor="end" height={50} />
                    <YAxis tick={{ fontSize: 10, fill: "var(--text3)" }} />
                    <Tooltip />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {s.intentData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : <p className="text-sm text-hint text-center py-8">No data yet</p>}
            </div>
          </div>

          {/* ─── USER ROLES ─── */}
          {s.roles.length > 0 && (
            <div className="bg-surface border border-main rounded-xl p-5">
              <h3 className="text-sm font-semibold text-main mb-4">User roles & permissions</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b-2 border-main">
                      <th className="text-left px-3 py-2 text-[10px] text-muted uppercase font-semibold">Email</th>
                      <th className="text-left px-3 py-2 text-[10px] text-muted uppercase font-semibold">Role</th>
                      <th className="text-left px-3 py-2 text-[10px] text-muted uppercase font-semibold">Project</th>
                    </tr>
                  </thead>
                  <tbody>
                    {s.roles.map((r, i) => (
                      <tr key={i} className="border-b border-main">
                        <td className="px-3 py-2 text-main">{r.email}</td>
                        <td className="px-3 py-2">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${r.role === "full_admin" ? "bg-blue-100 text-blue-700" : r.role === "analyst" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                            {r.role === "full_admin" ? "Admin" : r.role === "analyst" ? "Analyst" : "Client"}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-muted">{r.project_id}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="text-center py-4">
            <p className="text-[10px] text-hint">Groundwork by Knots & Dots — Platform Analytics</p>
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}
