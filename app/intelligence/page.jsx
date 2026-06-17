"use client";
import { useState, useEffect, useMemo, Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import AuthGuard from "@/components/AuthGuard";
import Nav from "@/components/Nav";
import ProjectGuard from "@/components/ProjectGuard";
import { useProject } from "@/lib/project-context";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, CartesianGrid } from "recharts";

const PALETTE = ["#0019FF", "#7c3aed", "#e11d48", "#059669", "#d97706", "#0891b2", "#db2777", "#65a30d"];
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

function IntelligenceContent() {
  const { projectId, projectName } = useProject();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("dashboard");
  const [insights, setInsights] = useState(null);
  const [insLoading, setInsLoading] = useState(false);
  const [insErr, setInsErr] = useState("");
  const [dimension, setDimension] = useState("");
  const [picks, setPicks] = useState([]);
  const [picksOpen, setPicksOpen] = useState(false);
  const [openPillar, setOpenPillar] = useState(null);
  const [pillarBrand, setPillarBrand] = useState("");

  // Restore last generation + analyst picks for this project (persist so they don't vanish)
  useEffect(() => {
    if (!projectId) return;
    try { const s = localStorage.getItem(`gw-insights-${projectId}`); if (s) setInsights(JSON.parse(s)); } catch {}
    try { const p = localStorage.getItem(`gw-picks-${projectId}`); setPicks(p ? JSON.parse(p) : []); } catch {}
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

  const TABS = [["dashboard", "Dashboard"], ["insights", "Insights"], ["explore", "Explore"], ["generate", "Generate"]];

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
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
            const grp = d.pillarGroups.find((g) => g.pillar === openPillar);
            const posts = grp ? (pillarBrand ? grp.posts.filter((p) => p.brand === pillarBrand) : grp.posts) : [];
            return (
              <div>
                <p className="text-xs text-muted mb-3">Cada burbuja es un <b>pilar de contenido</b> (tamaño = volumen, color = engagement). Haz click para ver los ejemplos.</p>
                {/* Pillar clusters */}
                <div className="flex flex-wrap gap-3">
                  {d.pillarGroups.map((g) => {
                    const size = 88 + Math.round(70 * (g.count / d.maxPillarCount));
                    const heat = Math.min(1, g.avgEng / 8000);
                    const bg = `rgba(124,58,237,${0.12 + heat * 0.5})`;
                    return (
                      <button key={g.pillar} onClick={() => { setOpenPillar(g.pillar); setPillarBrand(""); }}
                        className="rounded-full flex flex-col items-center justify-center text-center p-2 border transition hover:scale-105"
                        style={{ width: size, height: size, background: bg, borderColor: openPillar === g.pillar ? "#7c3aed" : "var(--border)" }}>
                        <span className="text-[10px] font-bold text-main leading-tight line-clamp-3">{g.pillar}</span>
                        <span className="text-[9px] text-muted mt-0.5">{g.count} · ❤{g.avgEng.toLocaleString()}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Drill-down panel */}
                {grp && (
                  <div className="mt-5 border-t border-main pt-4">
                    <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                      <div>
                        <h3 className="text-base font-bold text-main">{grp.pillar}</h3>
                        <p className="text-[11px] text-muted">{grp.count} contenidos · {grp.brands.length} marcas · engagement promedio {grp.avgEng.toLocaleString()}</p>
                      </div>
                      <div className="flex gap-1 flex-wrap">
                        <button onClick={() => setPillarBrand("")} className={`px-2 py-1 rounded text-[11px] ${!pillarBrand ? "bg-accent text-white" : "bg-surface2 text-muted"}`}>Todas</button>
                        {grp.brands.map((b) => <button key={b} onClick={() => setPillarBrand(b)} className={`px-2 py-1 rounded text-[11px] ${pillarBrand === b ? "bg-accent text-white" : "bg-surface2 text-muted"}`}>{b}</button>)}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                      {posts.map((p, i) => (
                        <a key={i} href={p.url || "#"} target="_blank" rel="noopener" className="block bg-surface border border-main rounded-lg overflow-hidden hover:border-[var(--accent)] transition">
                          <div className="aspect-square bg-surface2 overflow-hidden">{p.image_url ? <img src={p.image_url} alt="" loading="lazy" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-hint text-xs">sin imagen</div>}</div>
                          <div className="p-1.5">
                            <div className="text-[10px] font-semibold text-main truncate">{p.brand}</div>
                            <div className="text-[9px] text-hint">❤ {p.likes.toLocaleString()} · 💬 {p.comments.toLocaleString()}</div>
                            <div className="text-[9px] text-muted line-clamp-2 mt-0.5">{(p.caption || "").split("\n")[0]}</div>
                          </div>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })()
        ) : (
          <div className="bg-surface border border-main rounded-xl p-8 text-center">
            <h3 className="text-base font-bold text-main">Generate — reporte</h3>
            <p className="text-sm text-muted mt-1 mb-4">Genera el reporte de Social Media Benchmark para el cliente.</p>
            <Link href="/reports" className="inline-block px-4 py-2 bg-accent text-white rounded-lg text-sm font-semibold">Ir a generación de reportes →</Link>
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
