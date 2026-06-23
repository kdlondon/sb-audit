"use client";
import { useState, useEffect, useMemo, Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import AuthGuard from "@/components/AuthGuard";
import Nav from "@/components/Nav";
import ProjectGuard from "@/components/ProjectGuard";
import { useProject } from "@/lib/project-context";
import { useFramework } from "@/lib/framework-context";
import { deliverableLabels } from "@/lib/deliverable-labels";
import CampaignMap from "@/components/CampaignMap";

const DEFAULT_BRAND_URL = { iberia: "https://www.iberia.com/", "air europa": "https://www.aireuropa.com/", "aerolineas argentinas": "https://www.aerolineas.com.ar", latam: "https://www.latamairlines.com/es/es", laser: "https://www.laserairlines.com" };
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, CartesianGrid } from "recharts";

// Product UI Palette — data ramp by RANK (quiet). Resolved hex/rgba so Recharts
// SVG fills render reliably (oklch CSS vars don't resolve inside <svg>).
const PALETTE = ["#011EFF", "#5566F5", "#8A8FC9", "#B7B2A8", "#7A746C", "#2B2724"];
const ACCENT_DEEP = "#3B3FB0";                 // the focus mark in charts
const Q_INK = ["rgba(22,20,19,0.74)", "rgba(22,20,19,0.30)", "rgba(22,20,19,0.14)"]; // q1/q2/q3
const PASTEL = ["#AEC6CF", "#C3B1E1", "#B5EAD7", "#FFDAC1", "#FFB7B2", "#C7CEEA", "#E2F0CB", "#F8C8DC", "#D4A5A5", "#B2D8D8", "#F3E0B5", "#CDE7BE"];
const TYPE_LABEL = { white_space: "White space", differential: "Differential", engagement: "Engagement", timing: "Timing", creative: "Creative", strategic: "Strategic" };
const DIM_CHIPS = [["", "All"], ["white_space", "White space"], ["differential", "Differential"], ["engagement", "Engagement"], ["timing", "Timing"], ["creative", "Creative"], ["strategic", "Strategic"]];
const Bookmark = ({ on }) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill={on ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" /></svg>
);
const cdOf = (e) => { try { return typeof e.custom_dimensions === "string" ? JSON.parse(e.custom_dimensions) : (e.custom_dimensions || {}); } catch { return {}; } };
const num = (v) => (typeof v === "number" ? v : Number(v) || 0);

function Card({ title, hint, children, full }) {
  return (
    <div className={`bg-surface border border-main rounded-xl p-4 ${full ? "col-span-full" : ""}`}>
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-sm font-bold text-main">{title}</h3>
        {hint && <span className="text-[10px] text-hint">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function NeedsAnalysis({ pct }) {
  return (
    <div className="h-[220px] flex flex-col items-center justify-center text-center gap-1">
      <span className="text-2xl">✦</span>
      <p className="text-xs text-muted max-w-[240px]">Run <b>Analyze with AI</b> on the content to see this.</p>
      {pct != null && <p className="text-[10px] text-hint">{pct}% analyzed so far</p>}
    </div>
  );
}

const Field = ({ label, v }) => v ? (
  <div className="mb-2.5">
    <div className="text-[9px] font-mono uppercase tracking-wide text-hint">{label}</div>
    <div className="text-xs text-main leading-relaxed">{v}</div>
  </div>
) : null;

// KD Capsule data-viz: pill bars — rounded track + fill, ranked by value, hue encodes RANK
// (ramp, not brand identity), one ember spark optional. No gridlines, no legend.
const KD_RAMP = ["var(--kd-data-1)", "var(--kd-data-2)", "var(--kd-data-3)", "var(--kd-data-4)", "var(--kd-data-5)", "var(--kd-data-6)"];
const kfmt = (n) => n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, "") + "k" : Math.round(n);
function PillBars({ data, spark = null }) {
  const rows = [...data].filter((r) => r && r.name).sort((a, b) => b.value - a.value);
  const max = Math.max(1, ...rows.map((r) => r.value));
  const sparkIdx = spark === "max" ? 0 : spark === "min" ? rows.length - 1 : -1;
  return (
    <div className="flex flex-col gap-3 py-1">
      {rows.map((r, i) => (
        <div key={r.name} className="grid items-center gap-3" style={{ gridTemplateColumns: "96px 1fr 48px" }}>
          <span className="text-[12px] font-medium text-right truncate" style={{ color: "var(--kd-black)" }}>{r.name}</span>
          <div className="rounded-full overflow-hidden" style={{ height: 18, background: "var(--data-track)" }}>
            <div className="rounded-full" style={{ height: 18, width: `${Math.max(3, (r.value / max) * 100)}%`, background: i === sparkIdx ? "var(--kd-data-spark)" : i === 0 ? "var(--accent-deep)" : i === 1 ? "var(--q1)" : "var(--q2)", transition: "width 0.6s var(--kd-easing)" }} />
          </div>
          <span className="text-[11px] text-right" style={{ fontFamily: "var(--kd-mono)", color: "rgba(22,20,19,.6)" }}>{kfmt(r.value)}</span>
        </div>
      ))}
    </div>
  );
}

function IntelligenceContent() {
  const { projectId, projectName } = useProject();
  const { framework } = useFramework() || {};
  const dl = deliverableLabels(framework?.language || "English"); // deliverable labels in the project language
  const [dna, setDna] = useState({});          // brand -> [versions desc]
  const [dnaUrl, setDnaUrl] = useState({});     // brand -> url input
  const [dnaVer, setDnaVer] = useState({});     // brand -> selected version index
  const [dnaGen, setDnaGen] = useState("");     // brand currently generating
  const loadDna = async () => {
    if (!projectId) return;
    try {
      const supabase = createClient();
      const { data } = await supabase.from("brand_dna").select("*").eq("project_id", projectId).order("created_at", { ascending: false });
      const g = {}; (data || []).forEach(r => { (g[r.brand] ||= []).push(r); });
      setDna(g);
    } catch {}
  };
  useEffect(() => { loadDna(); }, [projectId]);
  const genDna = async (brand) => {
    const url = dnaUrl[brand] || dna[brand]?.[0]?.url || DEFAULT_BRAND_URL[brand.toLowerCase()] || "";
    if (!url || dnaGen) return;
    setDnaGen(brand);
    try {
      const res = await fetch("/api/intelligence/brand-dna", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ project_id: projectId, brand, url }) });
      const dt = await res.json();
      if (dt.error) alert("Error: " + dt.error);
      else { await loadDna(); setDnaVer(v => ({ ...v, [brand]: 0 })); }
    } catch (e) { alert(e.message); }
    setDnaGen("");
  };
  const [entries, setEntries] = useState([]);
  const [journeyBrand, setJourneyBrand] = useState("");   // Journey/campaign map widget
  const [journeyView, setJourneyView] = useState("funnel");
  const [dashBrands, setDashBrands] = useState([]);       // dashboard competitor filter (empty = all)
  const [dashDrill, setDashDrill] = useState(null);       // heatmap drill-down panel { label, entries }
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("dashboard");
  const [insights, setInsights] = useState(null);
  const [insLoading, setInsLoading] = useState(false);
  const [insErr, setInsErr] = useState("");
  const [dimension, setDimension] = useState("");
  const [picks, setPicks] = useState([]);
  const [picksOpen, setPicksOpen] = useState(false);
  const [report, setReport] = useState(null);
  const [repLoading, setRepLoading] = useState(false);
  const [repErr, setRepErr] = useState("");
  const genReport = async () => {
    if (repLoading) return;
    setRepLoading(true); setRepErr("");
    try {
      const res = await fetch("/api/intelligence/report", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ project_id: projectId, picks }) });
      const dt = await res.json();
      if (dt.error) setRepErr(dt.error);
      else { setReport(dt.report); try { localStorage.setItem(`gw-report-${projectId}`, JSON.stringify(dt.report)); } catch {} }
    } catch (e) { setRepErr(e.message); }
    setRepLoading(false);
  };
  const [exBrand, setExBrand] = useState("");
  const [exPillar, setExPillar] = useState(null);
  const [subData, setSubData] = useState(null);
  const [subLoading, setSubLoading] = useState(false);
  const [exSub, setExSub] = useState("");

  const drillPillar = async (pillar, brand) => {
    setExPillar(pillar); setExSub(""); setSubData(null); setSubLoading(true);
    try {
      const res = await fetch("/api/intelligence/subpillars", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ project_id: projectId, pillar, brand: brand || undefined }) });
      const dt = await res.json();
      setSubData(dt.error ? { error: dt.error } : dt);
    } catch (e) { setSubData({ error: e.message }); }
    setSubLoading(false);
  };

  // Restore last generation + analyst picks for this project (persist so they don't vanish)
  useEffect(() => {
    if (!projectId) return;
    try { const s = localStorage.getItem(`gw-insights-${projectId}`); if (s) setInsights(JSON.parse(s)); } catch {}
    try { const p = localStorage.getItem(`gw-picks-${projectId}`); setPicks(p ? JSON.parse(p) : []); } catch {}
    try { const r = localStorage.getItem(`gw-report-${projectId}`); if (r) setReport(JSON.parse(r)); } catch {}
  }, [projectId]);

  const genInsights = async () => {
    if (insLoading) return;
    setInsLoading(true); setInsErr("");
    try {
      const res = await fetch("/api/intelligence/insights", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ project_id: projectId, dimension }) });
      const dt = await res.json();
      if (dt.error) setInsErr(dt.error);
      else { setInsights(dt.insights || []); try { localStorage.setItem(`gw-insights-${projectId}`, JSON.stringify(dt.insights || [])); } catch {} }
    } catch (e) { setInsErr(e.message); }
    setInsLoading(false);
  };

  const isPicked = (ins) => picks.some((p) => p.headline === ins.headline);
  const togglePick = (ins) => {
    setPicks((prev) => {
      const next = prev.some((p) => p.headline === ins.headline) ? prev.filter((p) => p.headline !== ins.headline) : [...prev, ins];
      try { localStorage.setItem(`gw-picks-${projectId}`, JSON.stringify(next)); } catch {}
      return next;
    });
  };

  useEffect(() => {
    if (!projectId) return;
    (async () => {
      setLoading(true);
      const supabase = createClient();
      const { data } = await supabase.from("creative_source").select("*").eq("project_id", projectId).eq("type", "Social post");
      setEntries(data || []);
      setLoading(false);
    })();
  }, [projectId]);

  const allBrands = useMemo(() => [...new Set(entries.map((e) => e.competitor || e.brand || e.brand_name || "—"))].filter((b) => b && b !== "—"), [entries]);
  const d = useMemo(() => {
    const src = dashBrands.length ? entries.filter((e) => dashBrands.includes(e.competitor || e.brand || e.brand_name || "—")) : entries;
    const rows = src.map((e) => {
      const cd = cdOf(e);
      const s = cd._social || {}, m = cd._meta || {};
      return {
        brand: e.competitor || e.brand || e.brand_name || "—",
        platform: s.platform || m.platform || "—",
        format: s.format || "—",
        pillar: s.content_pillar || "",
        likes: num(m.likes), comments: num(m.comments), views: num(m.views),
        eng: num(m.likes) + num(m.comments),
        image_url: e.image_url || "", url: e.url || "", caption: m.caption || e.synopsis || "",
        posted_at: m.posted_at || "",
        analyzed: !!cd._ai_analyzed_at,
      };
    });
    const brands = [...new Set(rows.map((r) => r.brand))];
    const brandColor = Object.fromEntries(brands.map((b, i) => [b, PALETTE[i % PALETTE.length]]));
    const count = (key) => { const m = {}; rows.forEach((r) => { const k = r[key] || "—"; m[k] = (m[k] || 0) + 1; }); return Object.entries(m).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value); };

    // posts + avg engagement by brand
    const byBrand = brands.map((b) => {
      const br = rows.filter((r) => r.brand === b);
      const eng = br.reduce((s, r) => s + r.likes + r.comments, 0);
      return { name: b, posts: br.length, avgEng: br.length ? Math.round(eng / br.length) : 0, color: brandColor[b] };
    }).sort((a, b) => b.posts - a.posts);

    // day-of-week cadence
    const dows = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const dowCount = dows.map((name) => ({ name, value: 0 }));
    rows.forEach((r) => { if (r.posted_at) { const day = new Date(r.posted_at).getDay(); if (!isNaN(day)) dowCount[day].value++; } });

    // pillar mix per brand (only if pillars exist)
    const pillars = [...new Set(rows.map((r) => r.pillar).filter(Boolean))];
    const pillarByBrand = brands.map((b) => {
      const row = { name: b };
      pillars.forEach((p) => { row[p] = rows.filter((r) => r.brand === b && r.pillar === p).length; });
      return row;
    });

    const analyzedPct = rows.length ? Math.round((100 * rows.filter((r) => r.analyzed).length) / rows.length) : 0;

    // Pillar groups for Explore (drop tiny noise pillars), each with its example posts sorted by engagement
    const pillarGroups = pillars.map((p) => {
      const posts = rows.filter((r) => r.pillar === p).sort((a, b) => b.eng - a.eng);
      const eng = posts.reduce((s, r) => s + r.eng, 0);
      return { pillar: p, count: posts.length, avgEng: posts.length ? Math.round(eng / posts.length) : 0, brands: [...new Set(posts.map((r) => r.brand))], posts };
    }).filter((g) => g.count >= 3).sort((a, b) => b.count - a.count);
    const maxPillarCount = Math.max(1, ...pillarGroups.map((g) => g.count));

    return { rows, brands, brandColor, byBrand, byFormat: count("format"), byPlatform: count("platform"), dowCount, pillars, pillarByBrand, pillarGroups, maxPillarCount, analyzedPct, total: rows.length };
  }, [entries, dashBrands]);

  const TABS = [["dashboard", "Dashboard"], ["insights", "Insights"], ["explore", "Explore"], ["brands", "Brands"], ["generate", "Generate"]];

  return (
    <div className="min-h-screen" data-product="groundwork" style={{ background: "var(--kd-paper)" }}>
      <style>{`@media print { body * { visibility: hidden !important; } #intel-report, #intel-report * { visibility: visible !important; } #intel-report { position: absolute; left: 0; top: 0; width: 100%; border: none !important; box-shadow: none !important; } }`}</style>
      <div className="section-bar px-5 py-2.5 flex justify-between items-center relative" style={{background:"transparent",boxShadow:"none"}}>
        <span className="w-[200px]" aria-hidden="true"></span>
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-0.5 bg-surface border border-main rounded-full p-1 shadow-sm">
          {TABS.map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} className={`px-4 py-1.5 rounded-full text-[13px] font-medium transition ${tab === k ? "kd-seg-active" : "text-muted hover:text-main"}`}>{l}</button>
          ))}
        </div>
        <span className="text-xs text-hint w-[200px] text-right truncate">Social Media Benchmark · {projectName || ""}</span>
      </div>

      <div className="section-bar-after px-5 py-5 max-w-[1100px] mx-auto" style={{ paddingTop: "calc(var(--sec-h) + 16px)" }}>
        {loading ? (
          <p className="text-sm text-hint">Loading intelligence…</p>
        ) : d.total === 0 ? (
          <p className="text-sm text-hint">No social content in this project yet. Import from Scout or Creative Source.</p>
        ) : tab === "dashboard" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="col-span-full flex items-center gap-1.5 flex-wrap mb-1">
              <span className="text-[10px] uppercase font-semibold mr-1" style={{ color: "var(--kd-blue)", fontFamily: "var(--kd-mono)" }}>Competitors</span>
              {allBrands.map((b) => { const on = dashBrands.includes(b); return (
                <button key={b} onClick={() => setDashBrands((prev) => on ? prev.filter((x) => x !== b) : [...prev, b])} className="px-3 py-1 rounded-full text-[11px] border transition" style={on ? { background: "var(--kd-blue)", borderColor: "var(--kd-blue)", color: "#fff" } : { borderColor: "var(--border)", color: "var(--text2)" }}>{b}</button>
              ); })}
              {dashBrands.length > 0 && <button onClick={() => setDashBrands([])} className="text-[11px] ml-1" style={{ color: "var(--kd-blue)" }}>Clear</button>}
            </div>
            <div className="col-span-full flex gap-3 flex-wrap">
              {[["Content", d.total], ["Brands", d.brands.length], ["AI-analyzed", `${d.analyzedPct}%`]].map(([l, v], i) => (
                <div key={l} className="rounded-xl px-4 py-3.5 flex-1 min-w-[140px]" style={{ background: i === 0 ? "var(--accent-tint)" : i === 1 ? "var(--p-stone)" : "var(--p-sand)", border: "1px solid rgba(0,0,0,0.035)" }}>
                  <div className="text-[10px] uppercase font-semibold mb-1.5" style={{ color: "var(--kd-black)", opacity: 0.55, fontFamily: "var(--kd-mono)" }}>{l}</div>
                  <div className="font-bold" style={{ fontSize: 28, lineHeight: 0.9, letterSpacing: "-0.02em", color: "var(--kd-black)", fontFamily: "var(--kd-mono)" }}>{v}</div>
                </div>
              ))}
            </div>

            <Card title="Content by brand" hint="volume">
              <PillBars data={d.byBrand.map((b) => ({ name: b.name, value: b.posts }))} />
            </Card>

            <Card title="Average engagement by brand" hint="♥ + ✦ / post">
              <PillBars data={d.byBrand.map((b) => ({ name: b.name, value: b.avgEng }))} spark="min" />
            </Card>

            <Card title="Format" hint="content type">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart><Pie data={d.byFormat} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} label={(e) => e.name}>{d.byFormat.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}</Pie><Tooltip /></PieChart>
              </ResponsiveContainer>
            </Card>

            <Card title="Platform">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart><Pie data={d.byPlatform} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} label={(e) => e.name}>{d.byPlatform.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}</Pie><Tooltip /></PieChart>
              </ResponsiveContainer>
            </Card>

            <Card title="Cadence — day of posting" hint="when they post">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={d.dowCount}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--q3)" /><XAxis dataKey="name" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} /><Tooltip /><Bar dataKey="value" radius={[4, 4, 0, 0]}>{(() => { const mx = Math.max(1, ...d.dowCount.map((x) => x.value)); return d.dowCount.map((row, i) => <Cell key={i} fill={row.value === mx ? ACCENT_DEEP : Q_INK[1]} />); })()}</Bar></BarChart>
              </ResponsiveContainer>
            </Card>

            <Card title="Pillar mix by brand" hint="needs AI analysis">
              {d.pillars.length ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={d.pillarByBrand}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" tick={{ fontSize: 9 }} interval={0} angle={-15} textAnchor="end" height={50} /><YAxis tick={{ fontSize: 11 }} /><Tooltip /><Legend wrapperStyle={{ fontSize: 10 }} />{d.pillars.map((p, i) => <Bar key={p} dataKey={p} stackId="a" fill={PALETTE[i % PALETTE.length]} />)}</BarChart>
                </ResponsiveContainer>
              ) : <NeedsAnalysis pct={d.analyzedPct} />}
            </Card>
            <Card title="Brand × communication intent" hint="click a cell to drill in" full>
              {(() => {
                const de = dashBrands.length ? entries.filter((e) => dashBrands.includes(e.competitor || e.brand || e.brand_name || "—")) : entries;
                const intents = [...new Set(de.flatMap((e) => (e.communication_intent || "").split(",").map((s) => s.trim()).filter(Boolean)))].slice(0, 6);
                const hbrands = [...new Set(de.map((e) => e.competitor || e.brand || e.brand_name || "—"))].filter((b) => b && b !== "—");
                if (!intents.length || !hbrands.length) return <NeedsAnalysis pct={d.analyzedPct} />;
                const cell = (b, it) => de.filter((e) => (e.competitor || e.brand || e.brand_name || "—") === b && (e.communication_intent || "").split(",").map((s) => s.trim()).includes(it));
                const max = Math.max(1, ...hbrands.flatMap((b) => intents.map((it) => cell(b, it).length)));
                return (
                  <div className="overflow-x-auto">
                    <table className="border-collapse" style={{ minWidth: 460 }}>
                      <thead><tr><th></th>{intents.map((it) => <th key={it} className="px-2 pb-2 text-[10px] font-semibold text-left align-bottom" style={{ color: "var(--kd-black)", opacity: 0.6, fontFamily: "var(--kd-mono)" }}>{it}</th>)}</tr></thead>
                      <tbody>{hbrands.map((b) => (
                        <tr key={b}>
                          <td className="pr-3 py-0.5 text-[11px] font-medium whitespace-nowrap" style={{ color: "var(--kd-black)" }}>{b}</td>
                          {intents.map((it) => { const items = cell(b, it); const n = items.length; const a = n / max; return (
                            <td key={it} className="p-0.5">
                              <button onClick={() => n && setDashDrill({ label: `${b} · ${it}`, entries: items })} className="w-full h-9 rounded flex items-center justify-center text-[11px] font-semibold transition" style={{ background: n ? `rgba(1,30,255,${0.1 + a * 0.72})` : "var(--kd-cream)", color: a > 0.5 ? "#fff" : "var(--kd-black)", cursor: n ? "pointer" : "default" }}>{n || ""}</button>
                            </td>
                          ); })}
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                );
              })()}
            </Card>
            {dashDrill && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-6" onClick={() => setDashDrill(null)}>
                <div className="absolute inset-0 bg-black/40" />
                <div className="relative bg-surface border border-main rounded-2xl shadow-2xl w-full max-w-[560px] max-h-[80vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
                  <div className="p-4 border-b border-main flex items-center justify-between sticky top-0 bg-surface z-10">
                    <span className="text-sm font-bold text-main">{dashDrill.label} · {dashDrill.entries.length}</span>
                    <button onClick={() => setDashDrill(null)} className="text-hint hover:text-main text-xl leading-none">×</button>
                  </div>
                  <div className="p-3 grid grid-cols-2 gap-2">
                    {dashDrill.entries.slice(0, 40).map((e) => (
                      <div key={e.id} className="border border-main rounded-lg overflow-hidden">
                        {e.image_url && <img src={e.image_url} alt="" className="w-full h-24 object-cover" />}
                        <div className="p-2"><p className="text-[11px] text-main line-clamp-2">{e.description || e.synopsis || "—"}</p><span className="text-[9px] text-hint">{e.year || ""}</span></div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            <Card title="Journey & campaign map" hint="by funnel / journey / lifecycle" full>
              <div className="flex gap-2 flex-wrap mb-3">
                {d.brands.map((b) => <button key={b} onClick={() => setJourneyBrand(journeyBrand === b ? "" : b)} className={`px-3 py-1 rounded-full text-[11px] border transition ${journeyBrand === b ? "bg-accent text-white border-accent" : "bg-surface border-main text-muted hover:text-main"}`}>{b}</button>)}
              </div>
              <CampaignMap entries={entries.filter((e) => !journeyBrand || (e.competitor || e.brand || e.brand_name) === journeyBrand)} activeView={journeyView} setActiveView={setJourneyView} />
            </Card>
          </div>
        ) : tab === "insights" ? (
          <div>
            <div className="flex items-end justify-between gap-3 mb-4 flex-wrap">
              <div>
                <h3 className="text-base font-bold text-main">Insights</h3>
                <p className="text-xs text-muted">Conclusions from {d.total} pieces of content · {d.analyzedPct}% analyzed</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setPicksOpen(true)} className="px-3 py-2 border border-main rounded-lg text-xs text-main hover:bg-surface2 flex items-center gap-1.5"><Bookmark on /> Analyst Picks ({picks.length})</button>
                <button onClick={genInsights} disabled={insLoading} className="px-4 py-2 text-white rounded-lg text-sm font-semibold disabled:opacity-60" style={{ background: "linear-gradient(90deg,#7c3aed,#2563eb)" }}>{insLoading ? "Generating…" : insights ? "Regenerate" : "Generate insights"}</button>
              </div>
            </div>
            <div className="flex gap-1.5 flex-wrap mb-6">
              {DIM_CHIPS.map(([k, l]) => (<button key={k} onClick={() => setDimension(k)} className={`px-3 py-1 rounded-full text-[11px] font-medium border transition ${dimension === k ? "bg-accent text-white border-accent" : "bg-surface border-main text-muted hover:text-main"}`}>{l}</button>))}
            </div>
            {insErr && <div className="text-xs text-red-500 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 mb-3">{insErr}</div>}
            {insLoading && <p className="text-sm text-accent animate-pulse">The AI is reading the competitive landscape… (~15s)</p>}
            {!insights && !insLoading && (
              <div className="border border-dashed border-main rounded-xl p-12 text-center">
                <p className="text-sm text-muted max-w-[430px] mx-auto">Pick a dimension (or <b>All</b>) and generate 8 strategic conclusions. Mark the best ones with the bookmark — they're saved to <b>Analyst Picks</b> and become the basis of the report.</p>
              </div>
            )}
            {insights && !insLoading && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {insights.map((ins, i) => {
                  const thumb = d.pillarGroups.find((g) => g.pillar === ins.pillar)?.posts?.[0]?.image_url;
                  const feature = i === 0, picked = isPicked(ins);
                  return (
                    <article key={i} className={`bg-surface border rounded-xl overflow-hidden flex flex-col ${feature ? "md:col-span-2" : ""} ${picked ? "border-[#7c3aed]" : "border-main"}`}>
                      {thumb && <div className={`w-full overflow-hidden bg-surface2 ${feature ? "h-44" : "h-28"}`}><img src={thumb} alt="" loading="lazy" className="w-full h-full object-cover" /></div>}
                      <div className="p-4 flex-1 flex flex-col">
                        <div className="flex items-start justify-between mb-3">
                          <span className="text-[9px] font-mono uppercase tracking-[0.18em] text-hint">{TYPE_LABEL[ins.type] || ins.type}</span>
                          <button onClick={() => togglePick(ins)} title="Save to Analyst Picks" className={`${picked ? "text-[#7c3aed]" : "text-hint hover:text-main"} transition`}><Bookmark on={picked} /></button>
                        </div>
                        {ins.stat && <div className="mb-2 flex items-baseline gap-2"><span className={`font-bold leading-none ${feature ? "text-4xl" : "text-3xl"}`} style={{ color: "#2563eb" }}>{ins.stat}</span><span className="text-[9px] font-mono uppercase tracking-wide text-hint">{ins.stat_label}</span></div>}
                        <h4 className={`font-bold text-main leading-snug mb-2 ${feature ? "text-lg" : "text-[15px]"}`}>{ins.headline}</h4>
                        <p className="text-xs text-muted leading-relaxed flex-1">{ins.body}</p>
                        {ins.evidence && <p className="text-[10px] font-mono text-hint mt-3 pt-3 border-t border-main">{ins.evidence}</p>}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        ) : tab === "explore" ? (
          d.pillarGroups.length === 0 ? <NeedsAnalysis pct={d.analyzedPct} /> : (() => {
            const exRows = exBrand ? d.rows.filter((r) => r.brand === exBrand) : d.rows;
            const pmap = {}; exRows.forEach((r) => { if (!r.pillar) return; const p = (pmap[r.pillar] ||= { count: 0, eng: 0 }); p.count++; p.eng += r.eng; });
            const tree = Object.entries(pmap).map(([name, v]) => ({ name, size: v.count, avgEng: Math.round(v.eng / v.count) })).filter((g) => g.size >= 2).sort((a, b) => b.size - a.size);
            const subPosts = subData?.posts ? (exSub ? subData.posts.filter((p) => p.subpillar === exSub) : subData.posts) : [];
            const csvDownload = () => {
              const head = ["pillar", "subpillar", "brand", "likes", "comments", "url"];
              const subBy = {}; (subData?.posts || []).forEach((p) => (subBy[p.url] = p.subpillar));
              const lines = exRows.filter((r) => r.pillar).map((r) => [r.pillar, subBy[r.url] || "", r.brand, r.likes, r.comments, r.url]);
              const csv = [head, ...lines].map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
              const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = `content-map-${projectName || "project"}.csv`; a.click();
            };
            return (
              <div>
                <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
                  <div className="flex gap-1.5 flex-wrap items-center">
                    <span className="text-[10px] font-mono uppercase tracking-wide text-hint mr-1">Competitor</span>
                    <button onClick={() => { setExBrand(""); if (exPillar) drillPillar(exPillar, ""); }} className={`px-3 py-1 rounded-full text-[11px] border ${!exBrand ? "bg-accent text-white border-accent" : "bg-surface border-main text-muted"}`}>All</button>
                    {d.brands.map((b) => <button key={b} onClick={() => { setExBrand(b); if (exPillar) drillPillar(exPillar, b); }} className={`px-3 py-1 rounded-full text-[11px] border ${exBrand === b ? "bg-accent text-white border-accent" : "bg-surface border-main text-muted"}`}>{b}</button>)}
                  </div>
                  <button onClick={csvDownload} className="px-3 py-1.5 border border-main rounded-lg text-xs text-main hover:bg-surface2">↓ CSV</button>
                </div>

                {!exPillar ? (
                  <>
                    <p className="text-xs text-muted mb-3">Map of <b>conversation territories</b> (width = volume). Click a territory to see its <b>subpillars</b>.</p>
                    <div className="flex flex-wrap gap-2">
                      {tree.map((g, i) => (
                        <button key={g.name} onClick={() => drillPillar(g.name, exBrand)}
                          className="rounded-xl p-3 text-left transition hover:brightness-95 flex flex-col justify-between"
                          style={{ flex: `${g.size} 1 ${Math.max(150, g.size * 9)}px`, minHeight: 118, background: PASTEL[i % PASTEL.length] }}>
                          <div className="text-[13px] font-bold leading-snug" style={{ color: "#27324a" }}>{g.name}</div>
                          <div className="text-[11px] font-mono mt-2" style={{ color: "#52607a" }}>{g.size} pieces of content · ❤ {g.avgEng.toLocaleString()}</div>
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <div>
                    <button onClick={() => { setExPillar(null); setSubData(null); }} className="text-xs text-accent mb-3">← Back to map</button>
                    <h3 className="text-base font-bold text-main">{exPillar}{exBrand ? ` · ${exBrand}` : ""}</h3>
                    {subLoading && <p className="text-sm text-accent animate-pulse mt-2">The AI is grouping into subpillars… (~10s)</p>}
                    {subData?.error && <p className="text-xs text-red-500 mt-2">{subData.error}</p>}
                    {subData?.subpillars && (
                      <>
                        <div className="flex gap-1.5 flex-wrap my-3">
                          <button onClick={() => setExSub("")} className={`px-3 py-1.5 rounded-lg text-[11px] font-medium ${!exSub ? "bg-main text-white" : "bg-surface2 text-muted"}`}>All · {subData.posts.length}</button>
                          {subData.subpillars.map((s, i) => <button key={s.name} onClick={() => setExSub(s.name)} className="px-3 py-1.5 rounded-lg text-[11px] font-medium" style={{ background: exSub === s.name ? PASTEL[i % PASTEL.length] : PASTEL[i % PASTEL.length] + "55", color: "#27324a" }}>{s.name} · {s.count}</button>)}
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                          {subPosts.map((p, i) => (
                            <a key={i} href={p.url || "#"} target="_blank" rel="noopener" className="block bg-surface border border-main rounded-lg overflow-hidden hover:border-[var(--accent)] transition">
                              <div className="aspect-square bg-surface2 overflow-hidden">{p.image_url ? <img src={p.image_url} alt="" loading="lazy" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-hint text-xs">no image</div>}</div>
                              <div className="p-1.5">
                                <div className="text-[9px] font-mono uppercase tracking-wide text-hint truncate">{p.subpillar}</div>
                                <div className="text-[10px] font-semibold text-main truncate">{p.brand}</div>
                                <div className="text-[9px] text-hint">❤ {p.likes.toLocaleString()} · 💬 {p.comments.toLocaleString()}</div>
                              </div>
                            </a>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })()
        ) : tab === "brands" ? (
          (() => {
            const brandList = (framework?.localCompetitors || []).map(b => b.name).filter(Boolean);
            const brands = brandList.length ? brandList : d.brands;
            return (
              <div>
                <p className="text-xs text-muted mb-4">Each brand's profile: <b>Expressed</b> (what its website says) vs <b>Validated</b> (what it actually does in its content). Enter a URL and generate; every update is saved as a version.</p>
                <div className="space-y-5">
                  {brands.map(brand => {
                    const versions = dna[brand] || [];
                    const vi = dnaVer[brand] ?? 0;
                    const rec = versions[vi];
                    const p = rec?.profile || {};
                    const claimHero = typeof p.claim === "string" ? p.claim : (p.claim?.hero || "");
                    const claimSeasonal = (p.claim && typeof p.claim === "object" && Array.isArray(p.claim.seasonal)) ? p.claim.seasonal.filter(Boolean) : [];
                    const urlVal = dnaUrl[brand] ?? (versions[0]?.url || DEFAULT_BRAND_URL[brand.toLowerCase()] || "");
                    return (
                      <div key={brand} className="bg-surface border border-main rounded-xl p-5">
                        <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
                          <div>
                            <h3 className="text-base font-bold text-main">{brand}</h3>
                            {rec && <span className="text-[10px] text-hint font-mono">Latest version · {new Date(rec.created_at).toLocaleDateString()}{versions.length > 1 ? ` · ${versions.length} versions` : ""}</span>}
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            {versions.length > 1 && <select value={vi} onChange={e => setDnaVer(v => ({ ...v, [brand]: Number(e.target.value) }))} className="px-2 py-1.5 bg-surface2 border border-main rounded text-xs text-main">{versions.map((r, i) => <option key={r.id} value={i}>{i === 0 ? "Latest" : new Date(r.created_at).toLocaleDateString()}</option>)}</select>}
                            <input value={urlVal} onChange={e => setDnaUrl(u => ({ ...u, [brand]: e.target.value }))} placeholder="https://brand.com" className="px-2 py-1.5 bg-surface2 border border-main rounded text-xs text-main w-[200px]" />
                            <button onClick={() => genDna(brand)} disabled={dnaGen === brand} className="px-3 py-2 text-white rounded-lg text-xs font-semibold disabled:opacity-60" style={{ background: "linear-gradient(90deg,#7c3aed,#2563eb)" }}>{dnaGen === brand ? "Analyzing…" : rec ? "Update" : "Generate profile"}</button>
                          </div>
                        </div>
                        {dnaGen === brand && <p className="text-xs text-accent animate-pulse">Crawling the site and cross-referencing its content… (~25s)</p>}
                        {rec && (
                          <div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                              <div className="border border-main rounded-lg p-4">
                                <div className="text-[9px] font-mono uppercase tracking-widest text-hint mb-3">Expressed · what it says</div>
                                <Field label="Purpose" v={p.purpose} />
                                <div className="mb-2.5">
                                  <div className="text-[9px] font-mono uppercase tracking-wide text-hint">Hero claim</div>
                                  <div className={`text-xs leading-relaxed ${claimHero ? "text-main font-semibold" : "text-hint italic"}`}>{claimHero || "— no consistent hero claim"}</div>
                                  {claimSeasonal.length > 0 && (
                                    <div className="mt-1.5 flex flex-wrap gap-1 items-center">
                                      <span className="text-[8px] font-mono uppercase tracking-wide text-hint">Seasonal</span>
                                      {claimSeasonal.map((c, i) => <span key={i} className="text-[10px] text-muted bg-surface2 border border-main rounded px-1.5 py-0.5">{c}</span>)}
                                    </div>
                                  )}
                                </div>
                                <Field label="Positioning" v={p.positioning} />
                                <Field label="Segments" v={Array.isArray(p.segments) ? p.segments.join(" · ") : p.segments} />
                                <Field label="Discourse" v={p.discourse} />
                                <Field label="Expressed role" v={p.role?.expressed} />
                              </div>
                              <div className="border border-main rounded-lg p-4" style={{ background: "rgba(124,58,237,0.04)" }}>
                                <div className="text-[9px] font-mono uppercase tracking-widest text-hint mb-3">Validated · what it does</div>
                                <Field label="Tone" v={p.tone} />
                                <Field label="Personality" v={p.personality} />
                                <Field label="Archetype" v={p.archetype} />
                                <Field label="Validated role" v={p.role?.validated} />
                                {p.role?.gap && <div className="mt-1 text-xs text-[#7c3aed] rounded p-2" style={{ background: "rgba(124,58,237,0.08)" }}><b>Gap:</b> {p.role.gap}</div>}
                              </div>
                            </div>
                            {Array.isArray(p.semantic_cloud) && p.semantic_cloud.length > 0 && (
                              <div className="mt-4">
                                <div className="text-[9px] font-mono uppercase tracking-widest text-hint mb-2">Semantic cloud</div>
                                <div className="flex flex-wrap gap-x-3 gap-y-1 items-baseline">
                                  {p.semantic_cloud.map((t, i) => <span key={i} className="text-main leading-tight" style={{ fontSize: 11 + Math.min(13, (t.weight || 3) * 1.5), fontWeight: (t.weight || 3) >= 6 ? 700 : 500, opacity: 0.55 + Math.min(0.45, (t.weight || 3) / 12) }}>{t.term}</span>)}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()
        ) : (
          <div>
            <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
              <div>
                <h3 className="text-base font-bold text-main">Generate — report</h3>
                <p className="text-xs text-muted">Combine your {picks.length} Analyst Picks + the map + the data into a client-ready document.</p>
              </div>
              <div className="flex gap-2">
                {report && <button onClick={() => window.print()} className="px-3 py-2 border border-main rounded-lg text-xs text-main hover:bg-surface2">↓ Download PDF</button>}
                <button onClick={genReport} disabled={repLoading} className="px-4 py-2 text-white rounded-lg text-sm font-semibold disabled:opacity-60" style={{ background: "linear-gradient(90deg,#7c3aed,#2563eb)" }}>{repLoading ? "Composing…" : report ? "Regenerate" : "Generate report"}</button>
              </div>
            </div>
            {repErr && <div className="text-xs text-red-500 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 mb-3">{repErr}</div>}
            {repLoading && <p className="text-sm text-accent animate-pulse">Composing the report… (~15s)</p>}
            {!report && !repLoading && <div className="border border-dashed border-main rounded-xl p-12 text-center"><p className="text-sm text-muted max-w-[430px] mx-auto">Mark your best insights in <b>Analyst Picks</b> and hit <b>Generate report</b>. The AI composes the executive summary and recommendations around your picks.</p></div>}
            {report && (
              <div id="intel-report" className="bg-surface border border-main rounded-xl px-8 py-10 max-w-[820px] mx-auto">
                <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-hint">Social Media Benchmark · {projectName}</div>
                <h1 className="text-3xl font-bold text-main mt-2 leading-tight">{report.title}</h1>
                <div className="text-[10px] text-hint mt-2 font-mono">{d.brands.length} {dl.brands} · {d.total} {dl.analyzedContent}</div>

                <h2 className="text-[11px] font-mono uppercase tracking-widest text-hint mt-9 mb-2">{dl.execSummary}</h2>
                <p className="text-[15px] text-main leading-relaxed">{report.executive_summary}</p>

                <h2 className="text-[11px] font-mono uppercase tracking-widest text-hint mt-9 mb-3">{dl.territoryMap}</h2>
                <div className="flex flex-wrap gap-1.5">
                  {d.pillarGroups.map((g, i) => (
                    <div key={g.pillar} className="rounded-lg p-2.5 flex flex-col justify-between" style={{ flex: `${g.count} 1 ${Math.max(120, g.count * 7)}px`, minHeight: 78, background: PASTEL[i % PASTEL.length] }}>
                      <div className="text-[11px] font-bold leading-snug" style={{ color: "#27324a" }}>{g.pillar}</div>
                      <div className="text-[9px] font-mono mt-1" style={{ color: "#52607a" }}>{g.count} · ❤{g.avgEng.toLocaleString()}</div>
                    </div>
                  ))}
                </div>

                {picks.length > 0 && (<>
                  <h2 className="text-[11px] font-mono uppercase tracking-widest text-hint mt-9 mb-3">{dl.keyInsights}</h2>
                  <div className="space-y-4">
                    {picks.map((p, i) => (
                      <div key={i} className="border-l-2 border-[#7c3aed] pl-4">
                        <div className="flex items-baseline gap-2"><span className="text-[9px] font-mono uppercase tracking-wide text-hint">{dl.types[p.type] || TYPE_LABEL[p.type] || p.type}</span>{p.stat && <span className="text-lg font-bold" style={{ color: "#2563eb" }}>{p.stat}</span>}</div>
                        <h4 className="text-[15px] font-bold text-main leading-snug">{p.headline}</h4>
                        <p className="text-xs text-muted leading-relaxed mt-0.5">{p.body}</p>
                      </div>
                    ))}
                  </div>
                </>)}

                {Array.isArray(report.recommendations) && report.recommendations.length > 0 && (<>
                  <h2 className="text-[11px] font-mono uppercase tracking-widest text-hint mt-9 mb-3">{dl.recommendations}</h2>
                  <ol className="space-y-2">
                    {report.recommendations.map((r, i) => (
                      <li key={i} className="flex gap-3 text-sm text-main"><span className="font-bold text-[#7c3aed]">{String(i + 1).padStart(2, "0")}</span><span className="leading-relaxed">{r}</span></li>
                    ))}
                  </ol>
                </>)}
              </div>
            )}
          </div>
        )}
      </div>

      {picksOpen && (
        <div className="fixed inset-0 z-50" onClick={() => setPicksOpen(false)}>
          <div className="absolute inset-0 bg-black/30" />
          <div className="absolute right-0 top-0 h-full w-[360px] bg-surface border-l border-main shadow-xl overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-main flex items-center justify-between sticky top-0 bg-surface z-10">
              <div><h3 className="text-sm font-bold text-main">Analyst Picks</h3><p className="text-[10px] text-hint">{picks.length} selected · basis of the report</p></div>
              <button onClick={() => setPicksOpen(false)} className="text-hint hover:text-main text-xl leading-none">×</button>
            </div>
            <div className="p-3 space-y-2">
              {picks.length === 0 ? <p className="text-xs text-hint text-center py-10">Mark insights with the bookmark to save them here.</p> : picks.map((p, i) => (
                <div key={i} className="border border-main rounded-lg p-3">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <span className="text-[9px] font-mono uppercase tracking-wide text-hint">{TYPE_LABEL[p.type] || p.type}</span>
                    <button onClick={() => togglePick(p)} title="Remove" className="text-[#7c3aed]"><Bookmark on /></button>
                  </div>
                  {p.stat && <div className="text-lg font-bold leading-none mb-1" style={{ color: "#2563eb" }}>{p.stat} <span className="text-[9px] font-mono text-hint">{p.stat_label}</span></div>}
                  <h4 className="text-xs font-bold text-main leading-snug">{p.headline}</h4>
                  <p className="text-[11px] text-muted mt-1 leading-relaxed">{p.body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function IntelligencePage() {
  return (
    <AuthGuard><ProjectGuard><Nav />
      <Suspense fallback={null}><IntelligenceContent /></Suspense>
    </ProjectGuard></AuthGuard>
  );
}
