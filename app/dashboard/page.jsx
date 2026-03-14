"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase";
import { COMPETITOR_COLORS } from "@/lib/options";
import AuthGuard from "@/components/AuthGuard";
import Nav from "@/components/Nav";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, ScatterChart, Scatter, ZAxis, CartesianGrid } from "recharts";

const COLORS = ["#2563eb","#7c3aed","#059669","#dc2626","#0ea5e9","#d97706","#14b8a6","#ec4899","#6366f1","#84cc16","#f97316","#06b6d4"];

function count(arr, key) {
  const c = {};
  arr.forEach(e => { const v = e[key]; if (v && !v.startsWith("Not ") && !v.startsWith("None") && v !== "") c[v] = (c[v] || 0) + 1; });
  return Object.entries(c).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
}

function heatmapData(arr, rowKey, colKey) {
  const rows = new Set(); const cols = new Set(); const grid = {};
  arr.forEach(e => {
    const r = e[rowKey]; const c = e[colKey];
    if (!r || !c || r.startsWith("Not ") || r.startsWith("None") || c.startsWith("Not ") || c.startsWith("None")) return;
    rows.add(r); cols.add(c);
    const k = `${r}__${c}`; grid[k] = (grid[k] || 0) + 1;
  });
  return { rows: [...rows], cols: [...cols], grid };
}

function Heatmap({ data, rowKey, colKey, title }) {
  const { rows, cols, grid } = heatmapData(data, rowKey, colKey);
  if (rows.length === 0) return null;
  const max = Math.max(...Object.values(grid), 1);
  return (
    <div>
      <h3 className="text-sm font-semibold text-main mb-3">{title}</h3>
      <div className="overflow-x-auto">
        <table className="text-xs border-collapse">
          <thead>
            <tr>
              <th className="px-2 py-1 text-left text-muted font-medium"></th>
              {cols.map(c => <th key={c} className="px-2 py-1 text-center text-muted font-medium" style={{ minWidth: 60, fontSize: 10 }}>{c}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r}>
                <td className="px-2 py-1 text-main font-medium whitespace-nowrap" style={{ fontSize: 11 }}>{r}</td>
                {cols.map(c => {
                  const v = grid[`${r}__${c}`] || 0;
                  const intensity = v / max;
                  return (
                    <td key={c} className="px-2 py-1 text-center" style={{
                      background: v > 0 ? `rgba(37, 99, 235, ${0.1 + intensity * 0.6})` : "transparent",
                      color: intensity > 0.5 ? "#fff" : "var(--text2)",
                      borderRadius: 4, fontSize: 11, fontWeight: v > 0 ? 600 : 400,
                    }}>{v || "·"}</td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub }) {
  return (
    <div className="bg-surface border border-main rounded-lg p-4">
      <p className="text-[10px] text-muted uppercase font-semibold tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-main mt-1">{value}</p>
      {sub && <p className="text-xs text-hint mt-0.5">{sub}</p>}
    </div>
  );
}

function DashboardContent() {
  const [localData, setLocalData] = useState([]);
  const [globalData, setGlobalData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState("all");

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const [{ data: local }, { data: global }] = await Promise.all([
        supabase.from("audit_entries").select("*"),
        supabase.from("audit_global").select("*"),
      ]);
      setLocalData(local || []);
      setGlobalData(global || []);
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="p-10 text-center text-hint">Loading...</div>;

  const data = scope === "local" ? localData : scope === "global" ? globalData : [...localData, ...globalData];
  const rated = data.filter(e => e.rating);
  const avgRating = rated.length > 0 ? (rated.reduce((s, e) => s + Number(e.rating), 0) / rated.length).toFixed(1) : "—";

  // Competitor/brand counts
  const brandCounts = count(data, data.some(e => e.competitor) ? "competitor" : "brand");
  const allBrandCounts = [];
  const localBrands = count(localData, "competitor");
  const globalBrands = count(globalData, "brand");
  localBrands.forEach(b => allBrandCounts.push({ ...b, scope: "Local" }));
  globalBrands.forEach(b => allBrandCounts.push({ ...b, scope: "Global" }));

  const categoryCounts = count(data, "category");
  const toneCounts = count(data, "tone_of_voice");
  const archetypeCounts = count(data, "brand_archetype");
  const portraitCounts = count(data, "portrait");
  const languageCounts = count(data, "language_register");
  const executionCounts = count(data, "execution_style");
  const ratingByBrand = {};
  data.forEach(e => {
    const b = e.competitor || e.brand;
    if (!b || !e.rating) return;
    if (!ratingByBrand[b]) ratingByBrand[b] = { total: 0, count: 0 };
    ratingByBrand[b].total += Number(e.rating);
    ratingByBrand[b].count++;
  });
  const ratingData = Object.entries(ratingByBrand).map(([name, { total, count: c }]) => ({ name, value: Math.round((total / c) * 10) / 10 })).sort((a, b) => b.value - a.value);

  // Positioning matrix data
  const positionData = [];
  const brands = [...new Set(data.map(e => e.competitor || e.brand).filter(Boolean))];
  brands.forEach(b => {
    const entries = data.filter(e => (e.competitor || e.brand) === b);
    if (entries.length === 0) return;
    const ownerLang = entries.filter(e => e.language_register === "Owner language").length;
    const bankLang = entries.filter(e => e.language_register === "Banking language").length;
    const aspiration = entries.filter(e => e.pain_point_type === "Aspiration territory").length;
    const product = entries.filter(e => e.pain_point_type === "Product-focused only").length;
    const total = entries.length;
    positionData.push({
      name: b,
      x: total > 0 ? Math.round(((ownerLang - bankLang) / total) * 100) : 0,
      y: total > 0 ? Math.round(((aspiration - product) / total) * 100) : 0,
      z: total,
    });
  });

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.[0]) return null;
    const d = payload[0].payload;
    return <div className="bg-surface border border-main rounded-lg px-3 py-2 shadow-lg text-xs"><p className="font-semibold text-main">{d.name}</p><p className="text-muted">{d.value} entries</p></div>;
  };

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      <div className="bg-surface border-b border-main px-5 py-3 flex justify-between items-center">
        <div>
          <h2 className="text-lg font-bold text-main">Dashboard</h2>
          <p className="text-xs text-muted">Data visualizations across your audit</p>
        </div>
        <div className="flex bg-surface2 rounded-lg p-0.5">
          {[["all", "All"], ["local", "Local"], ["global", "Global"]].map(([k, l]) => (
            <button key={k} onClick={() => setScope(k)} className={`px-3 py-1 rounded-md text-xs font-medium transition ${scope === k ? "bg-surface text-accent shadow-sm" : "text-muted"}`}>{l}</button>
          ))}
        </div>
      </div>

      <div className="p-5 max-w-6xl mx-auto space-y-6">
        {/* Stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatCard label="Total entries" value={data.length} sub={`${localData.length} local · ${globalData.length} global`} />
          <StatCard label="Brands" value={brands.length} />
          <StatCard label="Classified" value={rated.length} sub={`${data.length - rated.length} pending`} />
          <StatCard label="Avg rating" value={avgRating} sub="out of 5" />
          <StatCard label="Categories" value={categoryCounts.length} />
        </div>

        {/* Row 1: Entries by brand + Category split */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2 bg-surface border border-main rounded-lg p-4">
            <h3 className="text-sm font-semibold text-main mb-3">Entries by brand</h3>
            <ResponsiveContainer width="100%" height={Math.max(200, brandCounts.length * 28)}>
              <BarChart data={brandCounts} layout="vertical" margin={{ left: 80, right: 20, top: 0, bottom: 0 }}>
                <XAxis type="number" tick={{ fontSize: 11, fill: "var(--text3)" }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "var(--text)" }} width={75} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {brandCounts.map((entry, i) => (
                    <Cell key={i} fill={COMPETITOR_COLORS[entry.name] || COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-surface border border-main rounded-lg p-4">
            <h3 className="text-sm font-semibold text-main mb-3">Category split</h3>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={categoryCounts} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80}>
                  {categoryCounts.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Heatmaps */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-surface border border-main rounded-lg p-4">
            <Heatmap data={data} rowKey={data[0]?.competitor ? "competitor" : "brand"} colKey="portrait" title="Portrait coverage by brand" />
          </div>
          <div className="bg-surface border border-main rounded-lg p-4">
            <Heatmap data={data} rowKey={data[0]?.competitor ? "competitor" : "brand"} colKey="journey_phase" title="Journey phase coverage by brand" />
          </div>
        </div>

        {/* Tone + Archetype */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-surface border border-main rounded-lg p-4">
            <h3 className="text-sm font-semibold text-main mb-3">Tone of voice distribution</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={toneCounts} margin={{ left: 10, right: 10 }}>
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "var(--text2)" }} angle={-30} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 10, fill: "var(--text3)" }} />
                <Tooltip />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {toneCounts.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-surface border border-main rounded-lg p-4">
            <h3 className="text-sm font-semibold text-main mb-3">Brand archetype frequency</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={archetypeCounts} margin={{ left: 10, right: 10 }}>
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "var(--text2)" }} angle={-30} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 10, fill: "var(--text3)" }} />
                <Tooltip />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {archetypeCounts.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Language + Execution */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-surface border border-main rounded-lg p-4">
            <h3 className="text-sm font-semibold text-main mb-3">Language register</h3>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={languageCounts} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={70}>
                  {languageCounts.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-surface border border-main rounded-lg p-4">
            <h3 className="text-sm font-semibold text-main mb-3">Execution style</h3>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={executionCounts} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={70}>
                  {executionCounts.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Positioning matrix */}
        <div className="bg-surface border border-main rounded-lg p-4">
          <h3 className="text-sm font-semibold text-main mb-1">Positioning matrix</h3>
          <p className="text-xs text-muted mb-3">X: Owner language ↔ Banking language · Y: Aspiration ↔ Product-focused · Size: number of entries</p>
          <ResponsiveContainer width="100%" height={350}>
            <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis type="number" dataKey="x" name="Language" tick={{ fontSize: 10, fill: "var(--text3)" }}
                label={{ value: "← Banking language · Owner language →", position: "bottom", fontSize: 10, fill: "var(--text3)" }} />
              <YAxis type="number" dataKey="y" name="Focus" tick={{ fontSize: 10, fill: "var(--text3)" }}
                label={{ value: "← Product · Aspiration →", angle: -90, position: "left", fontSize: 10, fill: "var(--text3)" }} />
              <ZAxis type="number" dataKey="z" range={[100, 800]} />
              <Tooltip content={({ payload }) => {
                if (!payload?.[0]) return null;
                const d = payload[0].payload;
                return <div className="bg-surface border border-main rounded-lg px-3 py-2 shadow-lg text-xs"><p className="font-semibold text-main">{d.name}</p><p className="text-muted">{d.z} entries</p></div>;
              }} />
              <Scatter data={positionData}>
                {positionData.map((entry, i) => (
                  <Cell key={i} fill={COMPETITOR_COLORS[entry.name] || COLORS[i % COLORS.length]} fillOpacity={0.7} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-2 mt-2 justify-center">
            {positionData.map((d, i) => (
              <span key={d.name} className="text-[10px] flex items-center gap-1">
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: COMPETITOR_COLORS[d.name] || COLORS[i % COLORS.length], display: "inline-block" }} />
                {d.name}
              </span>
            ))}
          </div>
        </div>

        {/* Rating by brand */}
        {ratingData.length > 0 && (
          <div className="bg-surface border border-main rounded-lg p-4">
            <h3 className="text-sm font-semibold text-main mb-3">Average rating by brand</h3>
            <ResponsiveContainer width="100%" height={Math.max(180, ratingData.length * 28)}>
              <BarChart data={ratingData} layout="vertical" margin={{ left: 80, right: 20 }}>
                <XAxis type="number" domain={[0, 5]} tick={{ fontSize: 10, fill: "var(--text3)" }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "var(--text)" }} width={75} />
                <Tooltip />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {ratingData.map((entry, i) => <Cell key={i} fill={COMPETITOR_COLORS[entry.name] || COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Journey moment heatmap */}
        <div className="bg-surface border border-main rounded-lg p-4">
          <Heatmap data={data} rowKey={data[0]?.competitor ? "competitor" : "brand"} colKey="moment_acquisition" title="Acquisition moment coverage" />
        </div>
        <div className="bg-surface border border-main rounded-lg p-4">
          <Heatmap data={data} rowKey={data[0]?.competitor ? "competitor" : "brand"} colKey="moment_deepening" title="Deepening moment coverage" />
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return <AuthGuard><Nav /><DashboardContent /></AuthGuard>;
}
