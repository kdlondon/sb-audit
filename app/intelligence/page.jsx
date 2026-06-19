"use client";
import { useState, useEffect, useMemo, Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import AuthGuard from "@/components/AuthGuard";
import Nav from "@/components/Nav";
import ProjectGuard from "@/components/ProjectGuard";
import { useProject } from "@/lib/project-context";
import { useFramework } from "@/lib/framework-context";

const DEFAULT_BRAND_URL = { iberia: "https://www.iberia.com/", "air europa": "https://www.aireuropa.com/", "aerolineas argentinas": "https://www.aerolineas.com.ar", latam: "https://www.latamairlines.com/es/es", laser: "https://www.laserairlines.com" };
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, CartesianGrid } from "recharts";

const PALETTE = ["#0019FF", "#7c3aed", "#e11d48", "#059669", "#d97706", "#0891b2", "#db2777", "#65a30d"];
const PASTEL = ["#AEC6CF", "#C3B1E1", "#B5EAD7", "#FFDAC1", "#FFB7B2", "#C7CEEA", "#E2F0CB", "#F8C8DC", "#D4A5A5", "#B2D8D8", "#F3E0B5", "#CDE7BE"];
const TYPE_LABEL = { white_space: "Espacio libre", differential: "Diferencial", engagement: "Engagement", timing: "Timing", creative: "Creativo", strategic: "Estratégico" };
const DIM_CHIPS = [["", "Todos"], ["white_space", "Espacio libre"], ["differential", "Diferencial"], ["engagement", "Engagement"], ["timing", "Timing"], ["creative", "Creativo"], ["strategic", "Estratégico"]];
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
      <p className="text-xs text-muted max-w-[240px]">Corre <b>Analyze with AI</b> en los contenidos para ver esto.</p>
      {pct != null && <p className="text-[10px] text-hint">{pct}% analizado hasta ahora</p>}
    </div>
  );
}

const Field = ({ label, v }) => v ? (
  <div className="mb-2.5">
    <div className="text-[9px] font-mono uppercase tracking-wide text-hint">{label}</div>
    <div className="text-xs text-main leading-relaxed">{v}</div>
  </div>
) : null;

function IntelligenceContent() {
  const { projectId, projectName } = useProject();
  const { framework } = useFramework() || {};
  const [dna, setDna] = useState({});          // brand -> [versions desc]
  const [dnaUrl, setDnaUrl] = useState({});     // brand -> url input
  const [dnaVer, setDnaVer] = useState({});     // brand -> selected version index
  const [dnaGen, setDnaGen] = useState("");     // brand currently generating
  const loadDna = async () => {
    if (!projectId) return;
    try {
      const supabase = createClient();
      const { data } = await supabase.from("brand_profiles").select("*").eq("project_id", projectId).order("created_at", { ascending: false });
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

  const d = useMemo(() => {
    const rows = entries.map((e) => {
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
    const dows = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
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
  }, [entries]);

  const TABS = [["dashboard", "Dashboard"], ["insights", "Insights"], ["explore", "Explore"], ["brands", "Marcas"], ["generate", "Generate"]];

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      <style>{`@media print { body * { visibility: hidden !important; } #intel-report, #intel-report * { visibility: visible !important; } #intel-report { position: absolute; left: 0; top: 0; width: 100%; border: none !important; box-shadow: none !important; } }`}</style>
      <div className="section-bar px-5 py-2.5 flex justify-between items-center">
        <div className="flex items-center gap-5">
          <h2 className="text-[15px] font-bold text-white">Intelligence</h2>
          <div className="flex gap-1">
            {TABS.map(([k, l]) => (
              <button key={k} onClick={() => setTab(k)} className={`px-3.5 py-1 rounded-full text-[13px] font-medium transition ${tab === k ? "bg-white/15 text-white" : "text-white/60 hover:text-white/90"}`}>{l}</button>
            ))}
          </div>
        </div>
        <span className="text-xs text-white/40">Social Media Benchmark · {projectName || ""}</span>
      </div>

      <div className="section-bar-after px-5 py-5 max-w-[1100px] mx-auto" style={{ paddingTop: "calc(var(--nav-h) + 14px)" }}>
        {loading ? (
          <p className="text-sm text-hint">Cargando inteligencia…</p>
        ) : d.total === 0 ? (
          <p className="text-sm text-hint">No hay contenidos sociales en este proyecto todavía. Importa desde Scout o Creative Source.</p>
        ) : tab === "dashboard" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="col-span-full flex gap-3 flex-wrap">
              {[["Contenidos", d.total], ["Marcas", d.brands.length], ["Analizados con IA", `${d.analyzedPct}%`]].map(([l, v]) => (
                <div key={l} className="bg-surface border border-main rounded-xl px-4 py-3 flex-1 min-w-[140px]">
                  <div className="text-2xl font-bold text-main">{v}</div>
                  <div className="text-[10px] text-hint uppercase font-semibold">{l}</div>
                </div>
              ))}
            </div>

            <Card title="Contenidos por marca" hint="volumen">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={d.byBrand} layout="vertical" margin={{ left: 10 }}>
                  <XAxis type="number" tick={{ fontSize: 11 }} /><YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} />
                  <Tooltip /><Bar dataKey="posts" radius={[0, 4, 4, 0]}>{d.byBrand.map((b, i) => <Cell key={i} fill={b.color} />)}</Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card title="Engagement promedio por marca" hint="❤ + 💬 / post">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={d.byBrand} layout="vertical" margin={{ left: 10 }}>
                  <XAxis type="number" tick={{ fontSize: 11 }} /><YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} />
                  <Tooltip /><Bar dataKey="avgEng" radius={[0, 4, 4, 0]}>{d.byBrand.map((b, i) => <Cell key={i} fill={b.color} />)}</Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card title="Formato" hint="tipo de pieza">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart><Pie data={d.byFormat} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} label={(e) => e.name}>{d.byFormat.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}</Pie><Tooltip /></PieChart>
              </ResponsiveContainer>
            </Card>

            <Card title="Plataforma">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart><Pie data={d.byPlatform} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} label={(e) => e.name}>{d.byPlatform.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}</Pie><Tooltip /></PieChart>
              </ResponsiveContainer>
            </Card>

            <Card title="Cadencia — día de publicación" hint="cuándo publican">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={d.dowCount}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} /><Tooltip /><Bar dataKey="value" fill="#0019FF" radius={[4, 4, 0, 0]} /></BarChart>
              </ResponsiveContainer>
            </Card>

            <Card title="Mix de pilares por marca" hint="necesita análisis IA">
              {d.pillars.length ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={d.pillarByBrand}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" tick={{ fontSize: 9 }} interval={0} angle={-15} textAnchor="end" height={50} /><YAxis tick={{ fontSize: 11 }} /><Tooltip /><Legend wrapperStyle={{ fontSize: 10 }} />{d.pillars.map((p, i) => <Bar key={p} dataKey={p} stackId="a" fill={PALETTE[i % PALETTE.length]} />)}</BarChart>
                </ResponsiveContainer>
              ) : <NeedsAnalysis pct={d.analyzedPct} />}
            </Card>
          </div>
        ) : tab === "insights" ? (
          <div>
            <div className="flex items-end justify-between gap-3 mb-4 flex-wrap">
              <div>
                <h3 className="text-base font-bold text-main">Insights</h3>
                <p className="text-xs text-muted">Conclusiones a partir de {d.total} contenidos · {d.analyzedPct}% analizado</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setPicksOpen(true)} className="px-3 py-2 border border-main rounded-lg text-xs text-main hover:bg-surface2 flex items-center gap-1.5"><Bookmark on /> Analyst Picks ({picks.length})</button>
                <button onClick={genInsights} disabled={insLoading} className="px-4 py-2 text-white rounded-lg text-sm font-semibold disabled:opacity-60" style={{ background: "linear-gradient(90deg,#7c3aed,#2563eb)" }}>{insLoading ? "Generando…" : insights ? "Regenerar" : "Generar insights"}</button>
              </div>
            </div>
            <div className="flex gap-1.5 flex-wrap mb-6">
              {DIM_CHIPS.map(([k, l]) => (<button key={k} onClick={() => setDimension(k)} className={`px-3 py-1 rounded-full text-[11px] font-medium border transition ${dimension === k ? "bg-accent text-white border-accent" : "bg-surface border-main text-muted hover:text-main"}`}>{l}</button>))}
            </div>
            {insErr && <div className="text-xs text-red-500 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 mb-3">{insErr}</div>}
            {insLoading && <p className="text-sm text-accent animate-pulse">La IA está leyendo el panorama competitivo… (~15s)</p>}
            {!insights && !insLoading && (
              <div className="border border-dashed border-main rounded-xl p-12 text-center">
                <p className="text-sm text-muted max-w-[430px] mx-auto">Elige una dimensión (o <b>Todos</b>) y genera 8 conclusiones estratégicas. Marca las mejores con el bookmark — se guardan en <b>Analyst Picks</b> y serán la base del reporte.</p>
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
                          <button onClick={() => togglePick(ins)} title="Guardar en Analyst Picks" className={`${picked ? "text-[#7c3aed]" : "text-hint hover:text-main"} transition`}><Bookmark on={picked} /></button>
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
              const head = ["pilar", "subpilar", "marca", "likes", "comments", "url"];
              const subBy = {}; (subData?.posts || []).forEach((p) => (subBy[p.url] = p.subpillar));
              const lines = exRows.filter((r) => r.pillar).map((r) => [r.pillar, subBy[r.url] || "", r.brand, r.likes, r.comments, r.url]);
              const csv = [head, ...lines].map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
              const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = `mapa-contenido-${projectName || "proyecto"}.csv`; a.click();
            };
            return (
              <div>
                <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
                  <div className="flex gap-1.5 flex-wrap items-center">
                    <span className="text-[10px] font-mono uppercase tracking-wide text-hint mr-1">Competidor</span>
                    <button onClick={() => { setExBrand(""); if (exPillar) drillPillar(exPillar, ""); }} className={`px-3 py-1 rounded-full text-[11px] border ${!exBrand ? "bg-accent text-white border-accent" : "bg-surface border-main text-muted"}`}>Todos</button>
                    {d.brands.map((b) => <button key={b} onClick={() => { setExBrand(b); if (exPillar) drillPillar(exPillar, b); }} className={`px-3 py-1 rounded-full text-[11px] border ${exBrand === b ? "bg-accent text-white border-accent" : "bg-surface border-main text-muted"}`}>{b}</button>)}
                  </div>
                  <button onClick={csvDownload} className="px-3 py-1.5 border border-main rounded-lg text-xs text-main hover:bg-surface2">↓ CSV</button>
                </div>

                {!exPillar ? (
                  <>
                    <p className="text-xs text-muted mb-3">Mapa de <b>territorios de conversación</b> (ancho = volumen). Haz click en un territorio para ver sus <b>subpilares</b>.</p>
                    <div className="flex flex-wrap gap-2">
                      {tree.map((g, i) => (
                        <button key={g.name} onClick={() => drillPillar(g.name, exBrand)}
                          className="rounded-xl p-3 text-left transition hover:brightness-95 flex flex-col justify-between"
                          style={{ flex: `${g.size} 1 ${Math.max(150, g.size * 9)}px`, minHeight: 118, background: PASTEL[i % PASTEL.length] }}>
                          <div className="text-[13px] font-bold leading-snug" style={{ color: "#27324a" }}>{g.name}</div>
                          <div className="text-[11px] font-mono mt-2" style={{ color: "#52607a" }}>{g.size} contenidos · ❤ {g.avgEng.toLocaleString()}</div>
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <div>
                    <button onClick={() => { setExPillar(null); setSubData(null); }} className="text-xs text-accent mb-3">← Volver al mapa</button>
                    <h3 className="text-base font-bold text-main">{exPillar}{exBrand ? ` · ${exBrand}` : ""}</h3>
                    {subLoading && <p className="text-sm text-accent animate-pulse mt-2">La IA está agrupando en subpilares… (~10s)</p>}
                    {subData?.error && <p className="text-xs text-red-500 mt-2">{subData.error}</p>}
                    {subData?.subpillars && (
                      <>
                        <div className="flex gap-1.5 flex-wrap my-3">
                          <button onClick={() => setExSub("")} className={`px-3 py-1.5 rounded-lg text-[11px] font-medium ${!exSub ? "bg-main text-white" : "bg-surface2 text-muted"}`}>Todos · {subData.posts.length}</button>
                          {subData.subpillars.map((s, i) => <button key={s.name} onClick={() => setExSub(s.name)} className="px-3 py-1.5 rounded-lg text-[11px] font-medium" style={{ background: exSub === s.name ? PASTEL[i % PASTEL.length] : PASTEL[i % PASTEL.length] + "55", color: "#27324a" }}>{s.name} · {s.count}</button>)}
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                          {subPosts.map((p, i) => (
                            <a key={i} href={p.url || "#"} target="_blank" rel="noopener" className="block bg-surface border border-main rounded-lg overflow-hidden hover:border-[var(--accent)] transition">
                              <div className="aspect-square bg-surface2 overflow-hidden">{p.image_url ? <img src={p.image_url} alt="" loading="lazy" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-hint text-xs">sin imagen</div>}</div>
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
                <p className="text-xs text-muted mb-4">Perfil de cada marca: <b>Expresado</b> (lo que dice su web) vs <b>Validado</b> (lo que hace en su contenido). Pon una URL y genera; cada actualización guarda una versión.</p>
                <div className="space-y-5">
                  {brands.map(brand => {
                    const versions = dna[brand] || [];
                    const vi = dnaVer[brand] ?? 0;
                    const rec = versions[vi];
                    const p = rec?.profile || {};
                    const urlVal = dnaUrl[brand] ?? (versions[0]?.url || DEFAULT_BRAND_URL[brand.toLowerCase()] || "");
                    return (
                      <div key={brand} className="bg-surface border border-main rounded-xl p-5">
                        <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
                          <div>
                            <h3 className="text-base font-bold text-main">{brand}</h3>
                            {rec && <span className="text-[10px] text-hint font-mono">Última versión · {new Date(rec.created_at).toLocaleDateString()}{versions.length > 1 ? ` · ${versions.length} versiones` : ""}</span>}
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            {versions.length > 1 && <select value={vi} onChange={e => setDnaVer(v => ({ ...v, [brand]: Number(e.target.value) }))} className="px-2 py-1.5 bg-surface2 border border-main rounded text-xs text-main">{versions.map((r, i) => <option key={r.id} value={i}>{i === 0 ? "Última" : new Date(r.created_at).toLocaleDateString()}</option>)}</select>}
                            <input value={urlVal} onChange={e => setDnaUrl(u => ({ ...u, [brand]: e.target.value }))} placeholder="https://marca.com" className="px-2 py-1.5 bg-surface2 border border-main rounded text-xs text-main w-[200px]" />
                            <button onClick={() => genDna(brand)} disabled={dnaGen === brand} className="px-3 py-2 text-white rounded-lg text-xs font-semibold disabled:opacity-60" style={{ background: "linear-gradient(90deg,#7c3aed,#2563eb)" }}>{dnaGen === brand ? "Analizando…" : rec ? "Actualizar" : "Generar perfil"}</button>
                          </div>
                        </div>
                        {dnaGen === brand && <p className="text-xs text-accent animate-pulse">Navegando el sitio y cruzando con su contenido… (~25s)</p>}
                        {rec && (
                          <div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                              <div className="border border-main rounded-lg p-4">
                                <div className="text-[9px] font-mono uppercase tracking-widest text-hint mb-3">Expresado · lo que dice</div>
                                <Field label="Propósito" v={p.purpose} />
                                <Field label="Claim" v={p.claim} />
                                <Field label="Posicionamiento" v={p.positioning} />
                                <Field label="Segmentos" v={Array.isArray(p.segments) ? p.segments.join(" · ") : p.segments} />
                                <Field label="Discurso" v={p.discourse} />
                                <Field label="Rol expresado" v={p.role?.expressed} />
                              </div>
                              <div className="border border-main rounded-lg p-4" style={{ background: "rgba(124,58,237,0.04)" }}>
                                <div className="text-[9px] font-mono uppercase tracking-widest text-hint mb-3">Validado · lo que hace</div>
                                <Field label="Tono" v={p.tone} />
                                <Field label="Personalidad" v={p.personality} />
                                <Field label="Arquetipo" v={p.archetype} />
                                <Field label="Rol validado" v={p.role?.validated} />
                                {p.role?.gap && <div className="mt-1 text-xs text-[#7c3aed] rounded p-2" style={{ background: "rgba(124,58,237,0.08)" }}><b>Brecha:</b> {p.role.gap}</div>}
                              </div>
                            </div>
                            {Array.isArray(p.semantic_cloud) && p.semantic_cloud.length > 0 && (
                              <div className="mt-4">
                                <div className="text-[9px] font-mono uppercase tracking-widest text-hint mb-2">Nube semántica</div>
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
                <h3 className="text-base font-bold text-main">Generate — reporte</h3>
                <p className="text-xs text-muted">Junta tus {picks.length} Analyst Picks + el mapa + los datos en un documento para el cliente.</p>
              </div>
              <div className="flex gap-2">
                {report && <button onClick={() => window.print()} className="px-3 py-2 border border-main rounded-lg text-xs text-main hover:bg-surface2">↓ Descargar PDF</button>}
                <button onClick={genReport} disabled={repLoading} className="px-4 py-2 text-white rounded-lg text-sm font-semibold disabled:opacity-60" style={{ background: "linear-gradient(90deg,#7c3aed,#2563eb)" }}>{repLoading ? "Componiendo…" : report ? "Regenerar" : "Generar reporte"}</button>
              </div>
            </div>
            {repErr && <div className="text-xs text-red-500 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 mb-3">{repErr}</div>}
            {repLoading && <p className="text-sm text-accent animate-pulse">Componiendo el reporte… (~15s)</p>}
            {!report && !repLoading && <div className="border border-dashed border-main rounded-xl p-12 text-center"><p className="text-sm text-muted max-w-[430px] mx-auto">Marca tus mejores insights en <b>Analyst Picks</b> y dale a <b>Generar reporte</b>. La IA compone el resumen ejecutivo y las recomendaciones alrededor de tus picks.</p></div>}
            {report && (
              <div id="intel-report" className="bg-surface border border-main rounded-xl px-8 py-10 max-w-[820px] mx-auto">
                <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-hint">Social Media Benchmark · {projectName}</div>
                <h1 className="text-3xl font-bold text-main mt-2 leading-tight">{report.title}</h1>
                <div className="text-[10px] text-hint mt-2 font-mono">{d.brands.length} marcas · {d.total} contenidos analizados</div>

                <h2 className="text-[11px] font-mono uppercase tracking-widest text-hint mt-9 mb-2">Resumen ejecutivo</h2>
                <p className="text-[15px] text-main leading-relaxed">{report.executive_summary}</p>

                <h2 className="text-[11px] font-mono uppercase tracking-widest text-hint mt-9 mb-3">Mapa de territorios</h2>
                <div className="flex flex-wrap gap-1.5">
                  {d.pillarGroups.map((g, i) => (
                    <div key={g.pillar} className="rounded-lg p-2.5 flex flex-col justify-between" style={{ flex: `${g.count} 1 ${Math.max(120, g.count * 7)}px`, minHeight: 78, background: PASTEL[i % PASTEL.length] }}>
                      <div className="text-[11px] font-bold leading-snug" style={{ color: "#27324a" }}>{g.pillar}</div>
                      <div className="text-[9px] font-mono mt-1" style={{ color: "#52607a" }}>{g.count} · ❤{g.avgEng.toLocaleString()}</div>
                    </div>
                  ))}
                </div>

                {picks.length > 0 && (<>
                  <h2 className="text-[11px] font-mono uppercase tracking-widest text-hint mt-9 mb-3">Insights clave</h2>
                  <div className="space-y-4">
                    {picks.map((p, i) => (
                      <div key={i} className="border-l-2 border-[#7c3aed] pl-4">
                        <div className="flex items-baseline gap-2"><span className="text-[9px] font-mono uppercase tracking-wide text-hint">{TYPE_LABEL[p.type] || p.type}</span>{p.stat && <span className="text-lg font-bold" style={{ color: "#2563eb" }}>{p.stat}</span>}</div>
                        <h4 className="text-[15px] font-bold text-main leading-snug">{p.headline}</h4>
                        <p className="text-xs text-muted leading-relaxed mt-0.5">{p.body}</p>
                      </div>
                    ))}
                  </div>
                </>)}

                {Array.isArray(report.recommendations) && report.recommendations.length > 0 && (<>
                  <h2 className="text-[11px] font-mono uppercase tracking-widest text-hint mt-9 mb-3">Recomendaciones</h2>
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
              <div><h3 className="text-sm font-bold text-main">Analyst Picks</h3><p className="text-[10px] text-hint">{picks.length} seleccionados · base del reporte</p></div>
              <button onClick={() => setPicksOpen(false)} className="text-hint hover:text-main text-xl leading-none">×</button>
            </div>
            <div className="p-3 space-y-2">
              {picks.length === 0 ? <p className="text-xs text-hint text-center py-10">Marca insights con el bookmark para guardarlos aquí.</p> : picks.map((p, i) => (
                <div key={i} className="border border-main rounded-lg p-3">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <span className="text-[9px] font-mono uppercase tracking-wide text-hint">{TYPE_LABEL[p.type] || p.type}</span>
                    <button onClick={() => togglePick(p)} title="Quitar" className="text-[#7c3aed]"><Bookmark on /></button>
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
