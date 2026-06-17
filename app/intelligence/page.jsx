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

    return { rows, brands, brandColor, byBrand, byFormat: count("format"), byPlatform: count("platform"), dowCount, pillars, pillarByBrand, analyzedPct, total: rows.length };
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
          <div className="bg-surface border border-main rounded-xl p-8 text-center">
            <span className="text-3xl">✦</span>
            <h3 className="text-base font-bold text-main mt-2">Insights generados por IA</h3>
            <p className="text-sm text-muted mt-1 max-w-[420px] mx-auto">Espacios libres, tu diferencial, mejores horas para publicar, qué engancha. Se construye en la siguiente fase.</p>
          </div>
        ) : tab === "explore" ? (
          <div className="bg-surface border border-main rounded-xl p-8 text-center">
            <span className="text-3xl">🗺️</span>
            <h3 className="text-base font-bold text-main mt-2">Explore — mapa de pilares</h3>
            <p className="text-sm text-muted mt-1 max-w-[420px] mx-auto">Board tipo Miro: pilares → subpilares → ejemplos. Se construye en la siguiente fase.</p>
          </div>
        ) : (
          <div className="bg-surface border border-main rounded-xl p-8 text-center">
            <h3 className="text-base font-bold text-main">Generate — reporte</h3>
            <p className="text-sm text-muted mt-1 mb-4">Genera el reporte de Social Media Benchmark para el cliente.</p>
            <Link href="/reports" className="inline-block px-4 py-2 bg-accent text-white rounded-lg text-sm font-semibold">Ir a generación de reportes →</Link>
          </div>
        )}
      </div>
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
