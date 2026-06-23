"use client";
import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { createClient } from "@/lib/supabase";
import AuthGuard from "@/components/AuthGuard";
import Nav from "@/components/Nav";
import ProjectGuard from "@/components/ProjectGuard";
import { useProject } from "@/lib/project-context";
import { useFramework } from "@/lib/framework-context";

const Toggle = ({ value, set, options }) => (
  <div className="flex items-center gap-0.5 bg-surface border border-main rounded-full p-1 shadow-sm">
    {options.map(([v, l]) => (
      <button key={v} onClick={() => set(v)} className={`px-3 py-1 rounded-full text-xs font-medium transition ${value === v ? "bg-surface2 text-main shadow-sm" : "text-muted hover:text-main"}`}>{l}</button>
    ))}
  </div>
);

const SECTION_LIST = [
  { key: "exec", label: "Executive read" },
  { key: "landscape", label: "Category landscape" },
  { key: "positioning", label: "Positioning x-ray" },
  { key: "hero", label: "Hero & message consistency" },
  { key: "whitespace", label: "White space & opportunity" },
  { key: "recommendations", label: "Strategic recommendations" },
];

function FlagshipInner() {
  const { projectId, projectName } = useProject();
  const { framework } = useFramework() || {};
  const [brands, setBrands] = useState([]);
  const [scope, setScope] = useState("category");
  const [brand, setBrand] = useState("");
  const [icp, setIcp] = useState("brand");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [report, setReport] = useState(null);
  const [cite, setCite] = useState(null);     // the entry shown when a citation is clicked
  const [saved, setSaved] = useState("");
  const [cfg, setCfg] = useState(SECTION_LIST.map((s) => ({ ...s, on: true, prompt: "" })));
  const [showCfg, setShowCfg] = useState(false);
  const moveSec = (i, dir) => setCfg((c) => { const n = [...c]; const j = i + dir; if (j < 0 || j >= n.length) return c; [n[i], n[j]] = [n[j], n[i]]; return n; });
  const toggleSec = (i) => setCfg((c) => c.map((s, k) => k === i ? { ...s, on: !s.on } : s));
  const setSecPrompt = (i, v) => setCfg((c) => c.map((s, k) => k === i ? { ...s, prompt: v } : s));

  useEffect(() => {
    if (!projectId) return;
    (async () => {
      try {
        // Prefer the configured competitor list (project framework); fall back to brands seen in content.
        const fwNames = [...(framework?.localCompetitors || []).map((c) => c?.name), ...(framework?.globalBenchmarks || []).map((g) => g?.name)].filter(Boolean);
        let list = fwNames;
        if (!list.length) {
          const supabase = createClient();
          const { data } = await supabase.from("creative_source").select("competitor,brand,brand_name").eq("project_id", projectId);
          const set = new Set();
          (data || []).forEach((r) => { const b = r.competitor || r.brand || r.brand_name; if (b) set.add(b); });
          list = [...set];
        }
        setBrands(list); setBrand((b) => b || list[0] || "");
      } catch {}
    })();
  }, [projectId, framework]);

  const generate = async () => {
    if (loading) return;
    setLoading(true); setErr(""); setReport(null); setSaved("");
    try {
      const res = await fetch("/api/reports/flagship", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ project_id: projectId, scope, brand: scope === "brand" ? brand : "", icp, sections: cfg.map(({ key, on, prompt }) => ({ key, on, prompt })) }) });
      const dt = await res.json();
      if (dt.error) setErr(dt.error); else setReport(dt);
    } catch (e) { setErr(e.message); }
    setLoading(false);
  };

  const openCite = async (rawId) => {
    const id = String(rawId).replace(/^#/, "").trim();
    if (!id) return;
    try {
      const supabase = createClient();
      const { data } = await supabase.from("creative_source").select("id,competitor,brand,brand_name,description,synopsis,image_url,url,year,communication_intent").eq("id", id).maybeSingle();
      if (data) setCite(data);
    } catch {}
  };

  const save = async () => {
    if (!report) return;
    try {
      const supabase = createClient();
      const subject = report.meta?.scope === "brand" ? report.meta?.subject : "Category";
      const title = `Strategic Positioning — ${projectName} · ${subject}`;
      const content = (report.sections || []).map((s) => s.markdown).join("\n\n");
      const { error } = await supabase.from("saved_reports").insert({ id: String(Date.now()), title, content, template_type: "flagship_positioning", scope: "local", project_id: projectId });
      setSaved(error ? "Error saving" : "Saved ✓");
    } catch (e) { setSaved("Error saving"); }
  };

  const CiteLink = ({ href, children }) => {
    if (href && href.startsWith("cite:")) {
      const id = href.slice(5);
      return <button onClick={() => openCite(id)} className="text-accent underline decoration-dotted underline-offset-2 hover:opacity-80">{children}</button>;
    }
    return <a href={href} target="_blank" rel="noopener" className="text-accent underline">{children}</a>;
  };

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      <style>{`@media print { .no-print { display: none !important; } body * { visibility: hidden; } #flagship-report, #flagship-report * { visibility: visible; } #flagship-report { position: absolute; left: 0; top: 0; width: 100%; border: none; padding: 0; } }`}</style>
      <div className="no-print"><Nav /></div>
      <div className="max-w-[860px] mx-auto px-6 pb-24" style={{ paddingTop: "calc(var(--sec-h) + 20px)" }}>
        <div className="no-print">
          <h1 className="text-2xl font-bold text-main">Strategic Positioning Report</h1>
          <p className="text-sm text-muted mt-1">Flagship — generated section by section, each weighted by signal strength.</p>

          <div className="flex flex-wrap items-center gap-3 mt-5 mb-7">
            <Toggle value={scope} set={setScope} options={[["category", "Whole category"], ["brand", "One brand"]]} />
            {scope === "brand" && (
              <select value={brand} onChange={(e) => setBrand(e.target.value)} className="px-3 py-1.5 bg-surface border border-main rounded-full text-xs text-main">
                {brands.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            )}
            <Toggle value={icp} set={setIcp} options={[["brand", "Brand lens"], ["agency", "Agency lens"], ["vc", "VC lens"]]} />
            <button onClick={() => setShowCfg((v) => !v)} className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${showCfg ? "bg-surface2 border-main text-main" : "border-main text-muted hover:text-main"}`}>Configure{(() => { const off = cfg.filter((s) => !s.on).length; return off ? ` · ${cfg.length - off}/${cfg.length}` : ""; })()}</button>
            <button onClick={generate} disabled={loading} className="px-4 py-2 text-white rounded-full text-sm font-semibold disabled:opacity-60" style={{ background: "linear-gradient(90deg,#7c3aed,#2563eb)" }}>
              {loading ? "Generating… (~60s)" : report ? "Regenerate" : "Generate report"}
            </button>
            {report && <button onClick={save} className="px-3 py-2 border border-main rounded-full text-xs text-main hover:bg-surface2">{saved || "Save"}</button>}
            {report && <button onClick={() => window.print()} className="px-3 py-2 border border-main rounded-full text-xs text-main hover:bg-surface2">↓ PDF</button>}
          </div>

          {showCfg && (
            <div className="border border-main rounded-2xl p-4 mb-6 bg-surface">
              <p className="text-xs text-muted mb-3">Configure the report: reorder, include/exclude sections, and add a direction the AI weaves into each one.</p>
              <div className="space-y-2">
                {cfg.map((s, i) => (
                  <div key={s.key} className={`flex items-start gap-2 rounded-xl border p-2.5 ${s.on ? "border-main" : "border-dashed border-main opacity-55"}`}>
                    <div className="flex flex-col gap-0.5 pt-0.5">
                      <button onClick={() => moveSec(i, -1)} disabled={i === 0} className="text-hint hover:text-main disabled:opacity-30 text-xs leading-none">▲</button>
                      <button onClick={() => moveSec(i, 1)} disabled={i === cfg.length - 1} className="text-hint hover:text-main disabled:opacity-30 text-xs leading-none">▼</button>
                    </div>
                    <input type="checkbox" checked={s.on} onChange={() => toggleSec(i)} className="mt-1 accent-[var(--accent)]" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-main">{i + 1}. {s.label}</div>
                      <input value={s.prompt} onChange={(e) => setSecPrompt(i, e.target.value)} disabled={!s.on} placeholder="Optional direction for this section (e.g. focus on the Spain–LatAm corridor)…" className="w-full mt-1.5 px-2.5 py-1.5 bg-surface2 border border-main rounded-lg text-xs text-main disabled:opacity-50" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {err && <div className="text-xs text-red-500 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 mb-4">{err}</div>}
          {loading && <p className="text-sm text-accent animate-pulse">Composing the report and weighting the evidence… this takes about a minute.</p>}
        </div>

        {report && (
          <div id="flagship-report" className="bg-surface border border-main rounded-2xl px-8 py-10">
            <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-hint">Strategic Positioning · {projectName} · {report.meta?.scope === "brand" ? report.meta?.subject : "Category"} · {report.meta?.icp} lens</div>
            {(report.sections || []).map((s) => (
              <div key={s.key} className="prose prose-sm max-w-none mt-7 text-main prose-headings:text-main prose-strong:text-main prose-li:text-main prose-a:text-accent">
                <ReactMarkdown urlTransform={(u) => u} components={{ a: CiteLink }}>{s.markdown}</ReactMarkdown>
              </div>
            ))}
            <div className="text-[10px] text-hint mt-8 font-mono">{report.meta?.brands} brands · {report.meta?.pieces} pieces analyzed · {report.meta?.brandDna} brand DNA profiles</div>
          </div>
        )}
      </div>

      {cite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 no-print" onClick={() => setCite(null)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative bg-surface border border-main rounded-2xl shadow-2xl w-full max-w-[480px] max-h-[85vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            {cite.image_url && <img src={cite.image_url} alt="" className="w-full rounded-t-2xl object-cover max-h-[300px]" />}
            <div className="p-5">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-sm font-bold text-main">{cite.competitor || cite.brand || cite.brand_name || "—"}</span>
                <button onClick={() => setCite(null)} className="text-hint hover:text-main text-xl leading-none">×</button>
              </div>
              <div className="flex gap-2 flex-wrap mb-2">
                {cite.year && <span className="text-[10px] text-muted bg-surface2 px-1.5 py-0.5 rounded">{cite.year}</span>}
                {cite.communication_intent && <span className="text-[10px] text-muted bg-surface2 px-1.5 py-0.5 rounded">{cite.communication_intent}</span>}
              </div>
              {cite.description && <p className="text-sm text-main leading-relaxed">{cite.description}</p>}
              {cite.synopsis && cite.synopsis !== cite.description && <p className="text-xs text-muted leading-relaxed mt-2">{cite.synopsis}</p>}
              {cite.url && <a href={cite.url} target="_blank" rel="noopener" className="text-xs text-accent hover:underline mt-3 inline-block">Open original ↗</a>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function FlagshipPage() {
  return (
    <AuthGuard>
      <ProjectGuard>
        <FlagshipInner />
      </ProjectGuard>
    </AuthGuard>
  );
}
