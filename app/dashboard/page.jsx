"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import { COMPETITOR_COLORS, fetchOptions } from "@/lib/options";
import AuthGuard from "@/components/AuthGuard";
import Nav from "@/components/Nav";
import ProjectGuard from "@/components/ProjectGuard";
import { useProject } from "@/lib/project-context";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, ScatterChart, Scatter, ZAxis, CartesianGrid } from "recharts";

/* ─── PNG DOWNLOAD HELPER ─── */
async function downloadChartAsPNG(element, filename) {
  const html2canvas = (await import("html2canvas")).default;
  const canvas = await html2canvas(element, { scale: 3, backgroundColor: "#ffffff", useCORS: true });
  const link = document.createElement("a");
  link.download = `${filename}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

// Pastel K&D palette
const COLORS = ["#7B9BF4","#B8A9E8","#7DCFB6","#F4A7A7","#82CCE5","#E8C87D","#7DD4C8","#E8A0C8","#9B9BF0","#B8D97D","#F0B87D","#7DD4E8"];
const INTENT_COLORS = {"Brand Hero":"#4060ff","Brand Tactical":"#7B9BF4","Client Testimonials":"#E8C87D","Product":"#7DCFB6","Innovation":"#F4A7A7","Beyond Banking":"#B8A9E8","Brand":"#9B9BF0"};

/* ─── COUNT WITH MULTI-VALUE SPLIT ─── */
function count(arr, key) {
  const c = {};
  arr.forEach(e => {
    const v = e[key];
    if (!v || v === "") return;
    // Split comma-separated values (e.g. "Brand Hero, Product" → count each)
    const vals = v.includes(",") ? v.split(",").map(s => s.trim()) : [v];
    vals.forEach(val => {
      if (val && !val.startsWith("Not ") && !val.startsWith("None")) c[val] = (c[val] || 0) + 1;
    });
  });
  return Object.entries(c).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
}

/* ─── HEATMAP WITH MULTI-VALUE SPLIT ─── */
function heatmapData(arr, rowKey, colKey) {
  const rows = new Set(); const cols = new Set(); const grid = {};
  arr.forEach(e => {
    const r = e[rowKey]; const cRaw = e[colKey];
    if (!r || !cRaw) return;
    const cVals = cRaw.includes(",") ? cRaw.split(",").map(s => s.trim()) : [cRaw];
    cVals.forEach(c => {
      if (!c || c.startsWith("Not ") || c.startsWith("None")) return;
      rows.add(r); cols.add(c);
      const k = `${r}__${c}`; grid[k] = (grid[k] || 0) + 1;
    });
  });
  return { rows: [...rows], cols: [...cols], grid };
}

function Heatmap({ data, rowKey, colKey, title, subtitle, onCellClick }) {
  const ref = useRef(null);
  const download = () => { if (ref.current) downloadChartAsPNG(ref.current, title.replace(/\s+/g, "-").toLowerCase()); };
  const { rows, cols, grid } = heatmapData(data, rowKey, colKey);
  if (rows.length === 0) return null;
  const max = Math.max(...Object.values(grid), 1);
  return (
    <div ref={ref} className="bg-surface border border-main rounded-lg p-5 relative group">
      <div className="flex justify-between items-start mb-1">
        <div><h3 className="text-sm font-semibold text-main">{title}</h3>{subtitle && <p className="text-xs text-muted mt-0.5">{subtitle}</p>}</div>
        <button onClick={download} className="opacity-0 group-hover:opacity-100 transition text-[9px] text-muted hover:text-main px-2 py-1 rounded border border-main hover:bg-surface2">PNG ↓</button>
      </div>
      <div className="overflow-x-auto">
        <table className="text-xs border-collapse w-full">
          <thead><tr><th className="px-3 py-2 text-left text-muted font-medium"></th>{cols.map(c => <th key={c} className="px-3 py-2 text-center text-muted font-medium" style={{ minWidth: 70, fontSize: 10 }}>{c}</th>)}</tr></thead>
          <tbody>{rows.map(r => (
            <tr key={r}><td className="px-3 py-2 text-main font-medium whitespace-nowrap" style={{ fontSize: 11 }}>{r}</td>
              {cols.map(c => {
                const v = grid[`${r}__${c}`] || 0; const i = v / max;
                return (
                  <td key={c} className={`px-3 py-2 text-center ${v > 0 && onCellClick ? "cursor-pointer hover:ring-2 hover:ring-[var(--accent)]" : ""}`}
                    style={{ background: v > 0 ? `rgba(123,155,244,${0.15 + i * 0.65})` : "transparent", color: i > 0.5 ? "#fff" : "var(--text2)", borderRadius: 4, fontSize: 11, fontWeight: v > 0 ? 600 : 400 }}
                    onClick={() => { if (v > 0 && onCellClick) onCellClick(rowKey, r, colKey, c); }}>
                    {v || "·"}
                  </td>
                );
              })}
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub }) {
  return (<div className="bg-surface border border-main rounded-lg p-4"><p className="text-[10px] text-muted uppercase font-semibold tracking-wide">{label}</p><p className="text-2xl font-bold text-main mt-1">{value}</p>{sub && <p className="text-xs text-hint mt-0.5">{sub}</p>}</div>);
}

function ChartCard({ title, subtitle, children, height }) {
  const ref = useRef(null);
  const download = () => { if (ref.current) downloadChartAsPNG(ref.current, title.replace(/\s+/g, "-").toLowerCase()); };
  return (
    <div ref={ref} className="bg-surface border border-main rounded-lg p-5 relative group">
      <div className="flex justify-between items-start mb-1">
        <div><h3 className="text-sm font-semibold text-main">{title}</h3>{subtitle && <p className="text-xs text-muted mt-0.5">{subtitle}</p>}</div>
        <button onClick={download} className="opacity-0 group-hover:opacity-100 transition text-[9px] text-muted hover:text-main px-2 py-1 rounded border border-main hover:bg-surface2">PNG ↓</button>
      </div>
      <div className="mt-3"><ResponsiveContainer width="100%" height={height || 280}>{children}</ResponsiveContainer></div>
    </div>
  );
}

function DownloadableCard({ title, subtitle, children }) {
  const ref = useRef(null);
  const download = () => { if (ref.current) downloadChartAsPNG(ref.current, title.replace(/\s+/g, "-").toLowerCase()); };
  return (
    <div ref={ref} className="bg-surface border border-main rounded-lg p-5 relative group">
      <div className="flex justify-between items-start mb-1">
        <div><h3 className="text-sm font-semibold text-main">{title}</h3>{subtitle && <p className="text-xs text-muted mt-0.5">{subtitle}</p>}</div>
        <button onClick={download} className="opacity-0 group-hover:opacity-100 transition text-[9px] text-muted hover:text-main px-2 py-1 rounded border border-main hover:bg-surface2">PNG ↓</button>
      </div>
      {children}
    </div>
  );
}

const CT = ({ active, payload }) => {
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload;
  return <div className="bg-surface border border-main rounded-lg px-3 py-2 shadow-lg text-xs"><p className="font-semibold text-main">{d.name}</p><p className="text-muted">{d.value} entries</p></div>;
};

/* ─── DRILL PANEL — shows filtered entries, click to expand full detail ─── */
function DrillPanel({ entries, title, onClose }) {
  const [activeId, setActiveId] = useState(null);
  if (!entries || entries.length === 0) return null;
  const active = activeId ? entries.find(e => e.id === activeId) : null;
  const ytId = (u) => { if (!u) return null; const m = u.match(/(?:youtube\.com\/watch\?.*v=|youtu\.be\/)([^&\s]+)/); return m ? m[1] : null; };
  const vimId = (u) => { if (!u) return null; const m = u.match(/vimeo\.com\/(\d+)/); return m ? m[1] : null; };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex justify-end" onClick={onClose}>
      <div className="flex h-full" onClick={e => e.stopPropagation()} style={{ animation: "fadeIn 0.2s ease-out" }}>
        {/* Detail view — slides in when entry selected */}
        {active && (
          <div className="w-[480px] bg-surface h-full shadow-2xl overflow-y-auto border-r border-main" style={{ animation: "fadeIn 0.25s ease-out" }}>
            <div className="sticky top-0 bg-surface border-b border-main px-5 py-3 flex justify-between items-center z-10">
              <button onClick={() => setActiveId(null)} className="text-xs text-muted hover:text-main flex items-center gap-1">← Back to list</button>
              <span className="text-[10px] text-hint">{active.competitor || active.brand}</span>
            </div>
            <div className="p-5 space-y-4">
              {/* Media */}
              {ytId(active.url) ? (
                <iframe width="100%" height="260" src={`https://www.youtube.com/embed/${ytId(active.url)}`} frameBorder="0" allowFullScreen className="rounded-xl" />
              ) : vimId(active.url) ? (
                <iframe width="100%" height="260" src={`https://player.vimeo.com/video/${vimId(active.url)}`} frameBorder="0" allowFullScreen className="rounded-xl" />
              ) : active.url && /\.(mp4|mov|webm)/i.test(active.url) ? (
                <video controls width="100%" className="rounded-xl" src={active.url} style={{ maxHeight: 280 }} />
              ) : active.image_url ? (
                <img src={active.image_url} className="w-full rounded-xl object-contain" style={{ maxHeight: 300 }} alt="" />
              ) : null}

              {/* Title + meta */}
              <div>
                <h3 className="text-base font-bold text-main">{active.description || "—"}</h3>
                <div className="flex flex-wrap gap-2 mt-2">
                  <span className="text-[10px] px-2 py-0.5 bg-accent-soft text-accent rounded-full font-semibold">{active.competitor || active.brand}</span>
                  {active.year && <span className="text-[10px] px-2 py-0.5 bg-surface2 text-muted rounded-full">{active.year}</span>}
                  {active.type && <span className="text-[10px] px-2 py-0.5 bg-surface2 text-muted rounded-full">{active.type}</span>}
                  {active.rating && <span className="text-[10px] px-2 py-0.5 bg-surface2 text-main rounded-full font-semibold">{"★".repeat(Number(active.rating))}</span>}
                </div>
              </div>

              {/* Intent */}
              {active.communication_intent && (
                <div>
                  <p className="text-[9px] text-hint uppercase font-semibold mb-1">Communication Intent</p>
                  <p className="text-xs text-accent font-medium">{active.communication_intent}</p>
                </div>
              )}

              {/* Slogan */}
              {active.main_slogan && (
                <div>
                  <p className="text-[9px] text-hint uppercase font-semibold mb-1">Main Slogan</p>
                  <p className="text-sm text-main italic" style={{ fontFamily: "Georgia, serif" }}>"{active.main_slogan}"</p>
                </div>
              )}

              {/* Synopsis */}
              {active.synopsis && (
                <div>
                  <p className="text-[9px] text-hint uppercase font-semibold mb-1">Synopsis</p>
                  <p className="text-xs text-main leading-relaxed">{active.synopsis}</p>
                </div>
              )}

              {/* Insight + Idea */}
              {active.insight && (
                <div>
                  <p className="text-[9px] text-hint uppercase font-semibold mb-1">Insight</p>
                  <p className="text-xs text-main">{active.insight}</p>
                </div>
              )}
              {active.idea && (
                <div>
                  <p className="text-[9px] text-hint uppercase font-semibold mb-1">Creative Idea</p>
                  <p className="text-xs text-main">{active.idea}</p>
                </div>
              )}

              {/* Strategic fields */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  ["Territory", active.primary_territory],
                  ["Archetype", active.brand_archetype],
                  ["Tone", active.tone_of_voice],
                  ["Execution", active.execution_style],
                  ["Emotional Benefit", active.emotional_benefit],
                  ["Rational Benefit", active.rational_benefit],
                ].filter(([, v]) => v).map(([label, val]) => (
                  <div key={label}>
                    <p className="text-[9px] text-hint uppercase font-semibold mb-0.5">{label}</p>
                    <p className="text-xs text-main">{val}</p>
                  </div>
                ))}
              </div>

              {/* Analyst comment */}
              {active.analyst_comment && (
                <div className="bg-surface2 rounded-lg p-3">
                  <p className="text-[9px] text-hint uppercase font-semibold mb-1">Analyst Notes</p>
                  <p className="text-xs text-main leading-relaxed">{active.analyst_comment}</p>
                </div>
              )}

              {/* URL */}
              {active.url && (
                <a href={active.url} target="_blank" rel="noopener noreferrer" className="text-xs text-accent hover:underline block truncate">
                  {active.url}
                </a>
              )}
            </div>
          </div>
        )}

        {/* Entry list */}
        <div className="w-[380px] bg-surface h-full shadow-2xl overflow-y-auto">
          <div className="sticky top-0 bg-surface border-b border-main px-5 py-3 flex justify-between items-center z-10">
            <div>
              <h3 className="text-sm font-semibold text-main">{title}</h3>
              <p className="text-[10px] text-muted">{entries.length} entries</p>
            </div>
            <button onClick={onClose} className="text-muted hover:text-main text-lg w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface2">×</button>
          </div>
          <div className="p-3 space-y-1.5">
            {entries.map(e => (
              <div key={e.id} onClick={() => setActiveId(e.id)}
                className={`rounded-lg p-3 border cursor-pointer transition ${activeId === e.id ? "border-[var(--accent)] bg-accent-soft" : "border-main bg-surface2 hover:border-[var(--accent)]"}`}>
                <div className="flex items-start gap-3">
                  {e.image_url && <img src={e.image_url} className="w-10 h-10 rounded object-cover flex-shrink-0" alt="" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-main truncate">{e.description || "—"}</p>
                    <p className="text-[10px] text-muted mt-0.5">{e.competitor || e.brand} · {e.year}</p>
                  </div>
                  {e.rating && <span className="text-[9px] text-main">{"★".repeat(Number(e.rating))}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── MAIN ─── */
function DashboardContent() {
  const [localData, setLocalData] = useState([]);
  const [globalData, setGlobalData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState("all");
  const [selectedBrands, setSelectedBrands] = useState([]);
  const [brandFilterOpen, setBrandFilterOpen] = useState(false);
  const [OPTIONS, setOPTIONS] = useState({});
  const [brandMetaMap, setBrandMetaMap] = useState({});
  const [drill, setDrill] = useState(null); // { title, entries }
  const brandFilterRef = useRef(null);

  const { projectId } = useProject();
  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const [{ data: local }, { data: global }, { data: meta }] = await Promise.all([
        supabase.from("audit_entries").select("*").eq("project_id", projectId),
        supabase.from("audit_global").select("*").eq("project_id", projectId),
        supabase.from("brand_metadata").select("brand_name,brand_category").eq("project_id", projectId),
      ]);
      setLocalData(local || []); setGlobalData(global || []);
      const map = {}; (meta || []).forEach(m => { map[m.brand_name] = m.brand_category; });
      setBrandMetaMap(map);
      const opts = await fetchOptions(projectId); setOPTIONS(opts);
      setLoading(false);
    })();
  }, [projectId]);

  useEffect(() => {
    if (!brandFilterOpen) return;
    const handler = (e) => { if (brandFilterRef.current && !brandFilterRef.current.contains(e.target)) setBrandFilterOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [brandFilterOpen]);

  if (loading) return <div className="p-10 text-center text-hint">Loading...</div>;

  const scopedData = scope === "local" ? localData : scope === "global" ? globalData : [...localData, ...globalData];
  const brandField = scopedData.some(e => e.competitor) ? "competitor" : "brand";

  const brandSet = new Set();
  scopedData.forEach(e => { const b = e.competitor || e.brand; if (b) brandSet.add(b); });
  (OPTIONS.competitor || []).filter(v => v !== "Other").forEach(b => brandSet.add(b));
  const catOrder = ["Traditional Banking", "Fintech", "Neobank", "Credit Union", "Supplementary Services", "Non-financial", "Other"];
  const groupedBrands = (() => {
    const groups = {};
    brandSet.forEach(b => { const cat = brandMetaMap[b] || "Other"; if (!groups[cat]) groups[cat] = []; groups[cat].push(b); });
    return Object.entries(groups).sort((a, b) => { const ia = catOrder.indexOf(a[0]), ib = catOrder.indexOf(b[0]); return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib); }).map(([cat, brands]) => ({ cat, brands: brands.sort() }));
  })();
  const allBrands = groupedBrands.flatMap(g => g.brands);

  const data = selectedBrands.length > 0 ? scopedData.filter(e => { const b = e.competitor || e.brand; return b && selectedBrands.includes(b); }) : scopedData;
  const rated = data.filter(e => e.rating);
  const avgRating = rated.length > 0 ? (rated.reduce((s, e) => s + Number(e.rating), 0) / rated.length).toFixed(1) : "—";
  const brands = [...new Set(data.map(e => e.competitor || e.brand).filter(Boolean))];

  // Chart data
  const brandCounts = count(data, brandField);
  const intentCounts = count(data, "communication_intent");
  const archetypeCounts = count(data, "brand_archetype");
  const toneCounts = count(data, "tone_of_voice");
  const executionCounts = count(data, "execution_style");
  const ratingByBrand = {};
  data.forEach(e => { const b = e.competitor || e.brand; if (!b || !e.rating) return; if (!ratingByBrand[b]) ratingByBrand[b] = { total: 0, count: 0 }; ratingByBrand[b].total += Number(e.rating); ratingByBrand[b].count++; });
  const ratingData = Object.entries(ratingByBrand).map(([name, { total, count: c }]) => ({ name, value: Math.round((total / c) * 10) / 10 })).sort((a, b) => b.value - a.value);

  // Intent by brand — normalized with multi-value split
  const INTENT_KEYS = ["Brand Hero", "Brand Tactical", "Client Testimonials", "Product", "Innovation", "Beyond Banking"];
  const intentByBrand = {};
  data.forEach(e => {
    const b = e.competitor || e.brand;
    const raw = e.communication_intent;
    if (!b || !raw) return;
    if (!intentByBrand[b]) intentByBrand[b] = Object.fromEntries(INTENT_KEYS.map(k => [k, 0]));
    const vals = raw.includes(",") ? raw.split(",").map(s => s.trim()) : [raw];
    vals.forEach(v => { if (intentByBrand[b][v] !== undefined) intentByBrand[b][v]++; });
  });
  const intentNormalized = Object.entries(intentByBrand).map(([name, d]) => {
    const total = Object.values(d).reduce((s, v) => s + v, 0);
    const row = { name, total };
    INTENT_KEYS.forEach(k => { row[k] = total > 0 ? Math.round((d[k] / total) * 100) : 0; });
    return row;
  }).sort((a, b) => b.total - a.total);

  // Positioning matrix
  const positionData = [];
  brands.forEach(b => {
    const entries = data.filter(e => (e.competitor || e.brand) === b);
    if (!entries.length) return;
    const ol = entries.filter(e => e.language_register === "Owner language").length;
    const bl = entries.filter(e => e.language_register === "Banking language").length;
    const asp = entries.filter(e => e.pain_point_type === "Aspiration territory").length;
    const prod = entries.filter(e => e.pain_point_type === "Product-focused only").length;
    const t = entries.length;
    positionData.push({ name: b, x: t > 0 ? Math.round(((ol - bl) / t) * 100) : 0, y: t > 0 ? Math.round(((asp - prod) / t) * 100) : 0, z: t });
  });

  // Brand Hero evolution timeline
  const heroTimeline = [];
  brands.forEach(b => {
    const heroes = data.filter(e => {
      const brand = e.competitor || e.brand;
      const intent = e.communication_intent || "";
      return brand === b && intent.includes("Brand Hero") && e.year;
    }).sort((a, b) => String(a.year).localeCompare(String(b.year)));
    if (heroes.length > 0) heroTimeline.push({ brand: b, entries: heroes });
  });

  // Drill handlers
  const drillByField = (field, value) => {
    const entries = data.filter(e => {
      const v = e[field] || "";
      return v.includes(value);
    });
    setDrill({ title: `${field.replace(/_/g, " ")}: ${value}`, entries });
  };
  const drillByBrandAndField = (rowKey, rowVal, colKey, colVal) => {
    const entries = data.filter(e => {
      const r = e[rowKey] || "";
      const c = e[colKey] || "";
      return r === rowVal && c.includes(colVal);
    });
    setDrill({ title: `${rowVal} — ${colVal}`, entries });
  };

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      {drill && <DrillPanel entries={drill.entries} title={drill.title} onClose={() => setDrill(null)} />}

      <div className="section-bar px-5 py-3 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-bold text-main">Dashboard</h2>
          <div className="flex bg-surface2 rounded-lg p-0.5">
            {[["all", "All"], ["local", "Local"], ["global", "Global"]].map(([k, l]) => (
              <button key={k} onClick={() => setScope(k)} className={`px-3 py-1 rounded-md text-xs font-medium transition ${scope === k ? "bg-surface text-accent shadow-sm" : "text-muted"}`}>{l}</button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative" ref={brandFilterRef}>
            <button onClick={() => setBrandFilterOpen(!brandFilterOpen)}
              className={`px-3 py-1.5 text-xs rounded-lg font-medium border transition flex items-center gap-1.5 ${selectedBrands.length > 0 ? "border-[var(--accent)] bg-accent-soft text-accent" : "border-main text-muted hover:text-main"}`}>
              {selectedBrands.length > 0 ? `${selectedBrands.length} brand${selectedBrands.length > 1 ? "s" : ""} selected` : "All brands"}
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" className={`transition ${brandFilterOpen ? "rotate-180" : ""}`}><path d="M2 4l3 3 3-3" /></svg>
            </button>
            {brandFilterOpen && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-surface border border-main rounded-xl shadow-xl py-2 max-h-[300px] overflow-y-auto" style={{ zIndex: 50 }}>
                <div className="px-3 pb-2 mb-1 border-b border-main flex justify-between">
                  <button onClick={() => setSelectedBrands(allBrands)} className="text-[10px] text-accent hover:underline">Select all</button>
                  <button onClick={() => setSelectedBrands([])} className="text-[10px] text-muted hover:text-main">Clear</button>
                </div>
                {groupedBrands.map(g => (
                  <div key={g.cat}>
                    <p className="px-3 pt-2 pb-1 text-[9px] text-hint uppercase font-semibold tracking-wider">{g.cat}</p>
                    {g.brands.map(b => (
                      <label key={b} className="flex items-center gap-2 px-3 py-1.5 hover:bg-surface2 cursor-pointer">
                        <input type="checkbox" checked={selectedBrands.includes(b)} onChange={() => setSelectedBrands(prev => prev.includes(b) ? prev.filter(x => x !== b) : [...prev, b])} className="rounded border-gray-300 text-accent" />
                        <span className="text-xs text-main">{b}</span>
                      </label>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="p-5 max-w-5xl mx-auto space-y-4">
        {/* ─── STATS ─── */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatCard label="Total entries" value={data.length} sub={`${localData.length} local · ${globalData.length} global`} />
          <StatCard label="Brands" value={brands.length} />
          <StatCard label="Classified" value={rated.length} sub={`${data.length - rated.length} pending`} />
          <StatCard label="Avg rating" value={avgRating} sub="out of 5" />
          <StatCard label="Hero pieces" value={data.filter(e => (e.communication_intent || "").includes("Brand Hero")).length} sub="core positioning" />
        </div>

        {/* ─── 1. ENTRIES BY BRAND ─── */}
        <ChartCard title="Entries by brand" height={Math.max(220, brandCounts.length * 28)}>
          <BarChart data={brandCounts} layout="vertical" margin={{ left: 90, right: 20 }}>
            <XAxis type="number" tick={{ fontSize: 11, fill: "var(--text3)" }} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "var(--text)" }} width={85} />
            <Tooltip content={<CT />} />
            <Bar dataKey="value" radius={[0, 4, 4, 0]} cursor="pointer" onClick={(d) => drillByField(brandField, d.name)}>
              {brandCounts.map((e, i) => <Cell key={i} fill={COMPETITOR_COLORS[e.name] || COLORS[i % COLORS.length]} />)}
            </Bar>
          </BarChart>
        </ChartCard>

        {/* ─── 2. COMMUNICATION INTENT (cleaned multi-value) ─── */}
        {intentCounts.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ChartCard title="Communication intent split" height={280}>
              <PieChart>
                <Pie data={intentCounts} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={95} cursor="pointer"
                  onClick={(d) => drillByField("communication_intent", d.name)}>
                  {intentCounts.map((d, i) => <Cell key={i} fill={INTENT_COLORS[d.name] || COLORS[i % COLORS.length]} />)}
                </Pie>
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Tooltip />
              </PieChart>
            </ChartCard>
            {intentNormalized.length > 0 && (
              <ChartCard title="Intent mix by brand (normalized %)" height={Math.max(200, intentNormalized.length * 32)}>
                <BarChart data={intentNormalized} layout="vertical" margin={{ left: 90, right: 20 }}>
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: "var(--text3)" }} tickFormatter={v => v + "%"} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "var(--text)" }} width={85} />
                  <Tooltip formatter={(v) => v + "%"} />
                  {INTENT_KEYS.map((k, i) => (
                    <Bar key={k} dataKey={k} stackId="a" fill={INTENT_COLORS[k] || COLORS[i]} radius={i === INTENT_KEYS.length - 1 ? [0, 4, 4, 0] : [0, 0, 0, 0]} />
                  ))}
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                </BarChart>
              </ChartCard>
            )}
          </div>
        )}

        {/* ─── 3. BRAND HERO EVOLUTION TIMELINE ─── */}
        {heroTimeline.length > 0 && (
          <DownloadableCard title="Brand Hero evolution" subtitle="Core positioning campaigns over time — click to see entries">
            <div className="mt-3 space-y-3">
              {heroTimeline.map(({ brand, entries: heroes }) => (
                <div key={brand} className="flex items-start gap-3">
                  <span className="text-xs font-semibold text-main w-[90px] flex-shrink-0 pt-1 truncate">{brand}</span>
                  <div className="flex-1 flex gap-2 overflow-x-auto pb-1">
                    {heroes.map((h, i) => (
                      <button key={h.id} onClick={() => setDrill({ title: `${brand} — Brand Hero`, entries: [h] })}
                        className="flex-shrink-0 px-3 py-2 rounded-lg border border-main hover:border-[var(--accent)] hover:bg-accent-soft transition text-left"
                        style={{ borderLeft: `3px solid ${COMPETITOR_COLORS[brand] || "#7B9BF4"}` }}>
                        <p className="text-[10px] font-bold text-accent">{h.year}</p>
                        <p className="text-[10px] text-main font-medium truncate max-w-[150px]">{h.main_slogan || h.description || "—"}</p>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </DownloadableCard>
        )}

        {/* ─── 4. INTENT BY BRAND HEATMAP ─── */}
        <Heatmap data={data} rowKey={brandField} colKey="communication_intent" title="Communication intent by brand" subtitle="Click cells to see entries" onCellClick={drillByBrandAndField} />

        {/* ─── 5. BRAND ARCHETYPE ─── */}
        <ChartCard title="Brand archetype frequency" height={250}>
          <BarChart data={archetypeCounts} margin={{ left: 10, right: 10 }}>
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: "var(--text2)" }} angle={-30} textAnchor="end" height={60} />
            <YAxis tick={{ fontSize: 10, fill: "var(--text3)" }} />
            <Tooltip />
            <Bar dataKey="value" radius={[4, 4, 0, 0]} cursor="pointer" onClick={(d) => drillByField("brand_archetype", d.name)}>
              {archetypeCounts.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Bar>
          </BarChart>
        </ChartCard>

        {/* ─── 6. TONE OF VOICE ─── */}
        <ChartCard title="Tone of voice distribution" height={250}>
          <BarChart data={toneCounts} margin={{ left: 10, right: 10 }}>
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: "var(--text2)" }} angle={-30} textAnchor="end" height={60} />
            <YAxis tick={{ fontSize: 10, fill: "var(--text3)" }} />
            <Tooltip />
            <Bar dataKey="value" radius={[4, 4, 0, 0]} cursor="pointer" onClick={(d) => drillByField("tone_of_voice", d.name)}>
              {toneCounts.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Bar>
          </BarChart>
        </ChartCard>

        {/* ─── 7. EXECUTION STYLE ─── */}
        <ChartCard title="Execution style" height={250}>
          <BarChart data={executionCounts} margin={{ left: 10, right: 10 }}>
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: "var(--text2)" }} angle={-30} textAnchor="end" height={60} />
            <YAxis tick={{ fontSize: 10, fill: "var(--text3)" }} />
            <Tooltip />
            <Bar dataKey="value" radius={[4, 4, 0, 0]} cursor="pointer" onClick={(d) => drillByField("execution_style", d.name)}>
              {executionCounts.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Bar>
          </BarChart>
        </ChartCard>

        {/* ─── 8. POSITIONING MATRIX ─── */}
        <DownloadableCard title="Positioning matrix" subtitle="X: Owner language ↔ Banking language · Y: Aspiration ↔ Product-focused · Size: entries">
          <ResponsiveContainer width="100%" height={380}>
            <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis type="number" dataKey="x" tick={{ fontSize: 10, fill: "var(--text3)" }} label={{ value: "← Banking · Owner →", position: "bottom", fontSize: 10, fill: "var(--text3)" }} />
              <YAxis type="number" dataKey="y" tick={{ fontSize: 10, fill: "var(--text3)" }} label={{ value: "← Product · Aspiration →", angle: -90, position: "left", fontSize: 10, fill: "var(--text3)" }} />
              <ZAxis type="number" dataKey="z" range={[100, 800]} />
              <Tooltip content={({ payload }) => { if (!payload?.[0]) return null; const d = payload[0].payload; return <div className="bg-surface border border-main rounded-lg px-3 py-2 shadow-lg text-xs"><p className="font-semibold text-main">{d.name}</p><p className="text-muted">{d.z} entries</p></div>; }} />
              <Scatter data={positionData} cursor="pointer" onClick={(d) => drillByField(brandField, d.name)}>
                {positionData.map((e, i) => <Cell key={i} fill={COMPETITOR_COLORS[e.name] || COLORS[i % COLORS.length]} fillOpacity={0.7} />)}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-2 mt-2 justify-center">
            {positionData.map((d, i) => (
              <span key={d.name} className="text-[10px] flex items-center gap-1">
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: COMPETITOR_COLORS[d.name] || COLORS[i % COLORS.length], display: "inline-block" }} />{d.name}
              </span>
            ))}
          </div>
        </DownloadableCard>

        {/* ─── 9. AVERAGE RATING ─── */}
        {ratingData.length > 0 && (
          <ChartCard title="Average rating by brand" height={Math.max(180, ratingData.length * 28)}>
            <BarChart data={ratingData} layout="vertical" margin={{ left: 90, right: 20 }}>
              <XAxis type="number" domain={[0, 5]} tick={{ fontSize: 10, fill: "var(--text3)" }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "var(--text)" }} width={85} />
              <Tooltip />
              <Bar dataKey="value" radius={[0, 4, 4, 0]} cursor="pointer" onClick={(d) => drillByField(brandField, d.name)}>
                {ratingData.map((e, i) => <Cell key={i} fill={COMPETITOR_COLORS[e.name] || COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ChartCard>
        )}

        {/* ─── 10. ARCHETYPE BY BRAND HEATMAP ─── */}
        <Heatmap data={data} rowKey={brandField} colKey="brand_archetype" title="Archetype by brand" subtitle="Click cells to see entries" onCellClick={drillByBrandAndField} />
      </div>
    </div>
  );
}

export default function DashboardPage() { return <AuthGuard><ProjectGuard><Nav /><DashboardContent /></ProjectGuard></AuthGuard>; }
