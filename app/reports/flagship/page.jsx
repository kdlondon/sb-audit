"use client";
import { useState, useEffect, useMemo } from "react";
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
const Chip = ({ on, onClick, children }) => (
  <button onClick={onClick} className={`px-3 py-1 rounded-full text-xs font-medium border transition ${on ? "bg-accent-soft border-[var(--accent)] text-accent" : "bg-surface border-main text-hint hover:border-[var(--accent)]"}`}>{children}</button>
);

const SECTION_LIST = [
  { key: "exec", label: "Executive read", desc: "The strategic headline — saturation, opening, the single biggest move" },
  { key: "landscape", label: "Category landscape", desc: "Territories occupied and who owns what" },
  { key: "positioning", label: "Positioning x-ray", desc: "Expressed vs validated — the gap between what brands say and do" },
  { key: "hero", label: "Hero & message consistency", desc: "Is the hero message stable over time and across channels" },
  { key: "whitespace", label: "White space & opportunity", desc: "Angles nobody owns + named opportunity territories" },
  { key: "recommendations", label: "Strategic recommendations", desc: "Prioritised, concrete actions" },
];
const MODES = [["brand_signal", "Brand signal"], ["performance", "Performance"], ["quality", "Quality"]];

function FlagshipInner() {
  const { projectId, projectName } = useProject();
  const { framework } = useFramework() || {};
  const [brands, setBrands] = useState([]);
  const [intents, setIntents] = useState([]);
  const [years, setYears] = useState([]);
  const [rows, setRows] = useState([]);            // lightweight {brand, intents[], year} for live counts
  const [scope, setScope] = useState("category");
  const [brand, setBrand] = useState("");
  const [icp, setIcp] = useState("brand");
  const [loading, setLoading] = useState(false);
  const [regenKey, setRegenKey] = useState(null);
  const [err, setErr] = useState("");
  const [report, setReport] = useState(null);
  const [cite, setCite] = useState(null);
  const [saved, setSaved] = useState("");
  const [showCfg, setShowCfg] = useState(false);
  // GLOBAL config (one lens for the whole report) + section structure
  const [filters, setFilters] = useState({ brands: [], intents: [], yearFrom: "", yearTo: "", mode: "brand_signal" });
  const [cfg, setCfg] = useState(SECTION_LIST.map((s) => ({ ...s, on: true, prompt: "" })));
  const [customInstructions, setCustomInstructions] = useState("");
  const [editKey, setEditKey] = useState(null);
  const [comments, setComments] = useState({});
  const [draft, setDraft] = useState({});

  const moveSec = (i, dir) => setCfg((c) => { const n = [...c]; const j = i + dir; if (j < 0 || j >= n.length) return c; [n[i], n[j]] = [n[j], n[i]]; return n; });
  const toggleSec = (i) => setCfg((c) => c.map((s, k) => k === i ? { ...s, on: !s.on } : s));
  const setSecPrompt = (i, v) => setCfg((c) => c.map((s, k) => k === i ? { ...s, prompt: v } : s));
  const toggleFilter = (field, val) => setFilters((f) => { const arr = f[field] || []; const has = arr.includes(val); return { ...f, [field]: has ? arr.filter((x) => x !== val) : [...arr, val] }; });
  const setFilterField = (field, v) => setFilters((f) => ({ ...f, [field]: v }));

  useEffect(() => {
    if (!projectId) return;
    (async () => {
      try {
        const fwNames = [...(framework?.localCompetitors || []).map((c) => c?.name), ...(framework?.globalBenchmarks || []).map((g) => g?.name)].filter(Boolean);
        const supabase = createClient();
        const { data } = await supabase.from("creative_source").select("competitor,brand,brand_name,communication_intent,year").eq("project_id", projectId);
        const rws = (data || []).map((r) => ({ brand: r.competitor || r.brand || r.brand_name || "—", intents: (r.communication_intent || "").split(",").map((x) => x.trim()).filter(Boolean), year: r.year }));
        setRows(rws);
        let list = fwNames;
        if (!list.length) list = [...new Set(rws.map((r) => r.brand))].filter((b) => b && b !== "—");
        setBrands(list); setBrand((b) => b || list[0] || "");
        setIntents([...new Set(rws.flatMap((r) => r.intents))].sort());
        const ys = [...new Set(rws.map((r) => r.year).filter(Boolean))].sort();
        setYears(ys);
      } catch {}
    })();
  }, [projectId, framework]);

  // live "entries in range" count for the global filters
  const inRange = useMemo(() => rows.filter((r) => {
    if (filters.brands.length && !filters.brands.includes(r.brand)) return false;
    if (filters.intents.length && !r.intents.some((it) => filters.intents.includes(it))) return false;
    if (filters.yearFrom && r.year && Number(r.year) < Number(filters.yearFrom)) return false;
    if (filters.yearTo && r.year && Number(r.year) > Number(filters.yearTo)) return false;
    return true;
  }).length, [rows, filters]);

  const bodyFor = (extra) => ({
    project_id: projectId, scope, brand: scope === "brand" ? brand : "", icp,
    sections: cfg.map(({ key, on, prompt }) => ({ key, on, prompt })),
    filters, customInstructions,
    ...extra,
  });

  const generate = async () => {
    if (loading) return;
    setLoading(true); setErr(""); setReport(null); setSaved(""); setEditKey(null); setComments({});
    try {
      const res = await fetch("/api/reports/flagship", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(bodyFor()) });
      const dt = await res.json();
      if (dt.error) setErr(dt.error); else setReport(dt);
    } catch (e) { setErr(e.message); }
    setLoading(false);
  };

  const regenerate = async (key) => {
    if (regenKey || loading) return;
    setRegenKey(key); setErr(""); setSaved("");
    try {
      const res = await fetch("/api/reports/flagship", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(bodyFor({ section: key, priorSections: report?.sections || [] })) });
      const dt = await res.json();
      if (dt.error) setErr(dt.error);
      else if (dt.section) setReport((r) => ({ ...r, sections: r.sections.map((s) => (s.key === key ? dt.section : s)) }));
    } catch (e) { setErr(e.message); }
    setRegenKey(null);
  };

  const setSectionMd = (key, md) => setReport((r) => ({ ...r, sections: r.sections.map((s) => (s.key === key ? { ...s, markdown: md } : s)) }));
  const addComment = (key) => {
    const t = (draft[key] || "").trim(); if (!t) return;
    setComments((c) => ({ ...c, [key]: [...(c[key] || []), { id: `${key}-${(c[key] || []).length + 1}`, text: t }] }));
    setDraft((d) => ({ ...d, [key]: "" }));
  };
  const removeComment = (key, id) => setComments((c) => ({ ...c, [key]: (c[key] || []).filter((x) => x.id !== id) }));

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

  const offCount = cfg.filter((s) => !s.on).length;
  const filtersActive = filters.brands.length || filters.intents.length || filters.yearFrom || filters.yearTo || filters.mode !== "brand_signal";

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      <style>{`@media print { .no-print { display: none !important; } body * { visibility: hidden; } #flagship-report, #flagship-report * { visibility: visible; } #flagship-report { position: absolute; left: 0; top: 0; width: 100%; border: none; padding: 0; } }`}</style>
      <div className="no-print"><Nav /></div>
      <div className="max-w-[860px] mx-auto px-6 pb-24" style={{ paddingTop: "calc(var(--sec-h) + 20px)" }}>
        <div className="no-print">
          <h1 className="text-2xl font-bold text-main">Strategic Positioning Report</h1>
          <p className="text-sm text-muted mt-1">Flagship — generated section by section, each weighted by signal strength. Configure once, then refine, regenerate or annotate any section.</p>

          <div className="flex flex-wrap items-center gap-3 mt-5 mb-7">
            <Toggle value={scope} set={setScope} options={[["category", "Whole category"], ["brand", "One brand"]]} />
            {scope === "brand" && (
              <select value={brand} onChange={(e) => setBrand(e.target.value)} className="px-3 py-1.5 bg-surface border border-main rounded-full text-xs text-main">
                {brands.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            )}
            <Toggle value={icp} set={setIcp} options={[["brand", "Brand lens"], ["agency", "Agency lens"], ["vc", "VC lens"]]} />
            <button onClick={() => setShowCfg((v) => !v)} className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${showCfg || filtersActive || offCount ? "bg-surface2 border-main text-main" : "border-main text-muted hover:text-main"}`}>
              Configure{offCount ? ` · ${cfg.length - offCount}/${cfg.length} sections` : ""}{filtersActive ? " · filtered" : ""}
            </button>
            <button onClick={generate} disabled={loading || !!regenKey} className="px-4 py-2 text-white rounded-full text-sm font-semibold disabled:opacity-60" style={{ background: "linear-gradient(90deg,#7c3aed,#2563eb)" }}>
              {loading ? "Generating… (~60s)" : report ? "Regenerate all" : "Generate report"}
            </button>
            {report && <button onClick={save} className="px-3 py-2 border border-main rounded-full text-xs text-main hover:bg-surface2">{saved || "Save"}</button>}
            {report && <button onClick={() => window.print()} className="px-3 py-2 border border-main rounded-full text-xs text-main hover:bg-surface2">↓ PDF</button>}
          </div>

          {showCfg && (
            <div className="mb-6 space-y-3">
              {/* TIME FRAME + WEIGHTING */}
              <div className="bg-surface rounded-lg border border-main p-4">
                <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
                  <div>
                    <h3 className="text-sm font-semibold text-main mb-2">Time frame</h3>
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] text-hint uppercase font-semibold">From</label>
                        <select value={filters.yearFrom} onChange={(e) => setFilterField("yearFrom", e.target.value)} className="px-3 py-1.5 bg-surface border border-main rounded-lg text-sm text-main">
                          <option value="">earliest</option>
                          {years.map((y) => <option key={y} value={y}>{y}</option>)}
                        </select>
                      </div>
                      <div className="text-hint mt-4">→</div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] text-hint uppercase font-semibold">To</label>
                        <select value={filters.yearTo} onChange={(e) => setFilterField("yearTo", e.target.value)} className="px-3 py-1.5 bg-surface border border-main rounded-lg text-sm text-main">
                          <option value="">latest</option>
                          {years.map((y) => <option key={y} value={y}>{y}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-main mb-2">Weighting</h3>
                    <Toggle value={filters.mode} set={(v) => setFilterField("mode", v)} options={MODES} />
                    <p className="text-[10px] text-hint mt-1.5">What drives emphasis: brand signal · engagement · rating</p>
                  </div>
                  <div className="ml-auto mb-1 text-xs text-hint">{inRange} of {rows.length} entries in range</div>
                </div>
              </div>

              {/* BRANDS */}
              <div className="bg-surface rounded-lg border border-main p-4">
                <h3 className="text-sm font-semibold text-main mb-2">Brands</h3>
                <div className="flex gap-2 flex-wrap">
                  {brands.map((b) => <Chip key={b} on={filters.brands.includes(b)} onClick={() => toggleFilter("brands", b)}>{b}</Chip>)}
                </div>
                <p className="text-[10px] text-hint mt-2">{filters.brands.length === 0 ? "All brands included" : `${filters.brands.length} brand${filters.brands.length > 1 ? "s" : ""} selected`}</p>
              </div>

              {/* INTENTS */}
              {intents.length > 0 && (
                <div className="bg-surface rounded-lg border border-main p-4">
                  <h3 className="text-sm font-semibold text-main mb-2">Communication intents</h3>
                  <div className="flex gap-2 flex-wrap">
                    {intents.map((it) => <Chip key={it} on={filters.intents.includes(it)} onClick={() => toggleFilter("intents", it)}>{it}</Chip>)}
                  </div>
                  <p className="text-[10px] text-hint mt-2">{filters.intents.length === 0 ? "All intents included" : `${filters.intents.length} intent${filters.intents.length > 1 ? "s" : ""} selected`}</p>
                </div>
              )}

              {/* SECTIONS */}
              <div className="bg-surface rounded-lg border border-main p-4">
                <h3 className="text-sm font-semibold text-main mb-1">Sections</h3>
                <p className="text-[10px] text-hint mb-2">Reorder, include/exclude, and add an optional direction the AI weaves into that section.</p>
                <div className="space-y-1.5">
                  {cfg.map((s, i) => (
                    <div key={s.key} className={`flex items-start gap-2 bg-surface2 rounded-lg p-2.5 group ${s.on ? "" : "opacity-50"}`}>
                      <input type="checkbox" checked={s.on} onChange={() => toggleSec(i)} className="mt-1 flex-shrink-0 accent-[var(--accent)]" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-main">{i + 1}. {s.label}</div>
                        <div className="text-[11px] text-hint">{s.desc}</div>
                        <input value={s.prompt} onChange={(e) => setSecPrompt(i, e.target.value)} disabled={!s.on} placeholder="Optional direction for this section (e.g. focus on the Spain–LatAm corridor)…" className="w-full mt-1.5 px-2.5 py-1.5 bg-surface border border-main rounded-lg text-xs text-main disabled:opacity-50" />
                      </div>
                      <div className="flex flex-col gap-0.5 pt-0.5 opacity-0 group-hover:opacity-100 transition flex-shrink-0">
                        <button onClick={() => moveSec(i, -1)} disabled={i === 0} className="text-hint hover:text-main disabled:opacity-30 text-xs leading-none">▲</button>
                        <button onClick={() => moveSec(i, 1)} disabled={i === cfg.length - 1} className="text-hint hover:text-main disabled:opacity-30 text-xs leading-none">▼</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* CUSTOM INSTRUCTIONS */}
              <div className="bg-surface rounded-lg border border-main p-4">
                <h3 className="text-sm font-semibold text-main mb-2">Custom instructions</h3>
                <textarea value={customInstructions} onChange={(e) => setCustomInstructions(e.target.value)} placeholder="A direction applied across the whole report — e.g. emphasise the Spain–LatAm corridor and challenger positioning…" className="w-full px-3 py-2 bg-surface border border-main rounded-lg text-sm text-main resize-y focus:outline-none focus:border-[var(--accent)]" rows={2} />
              </div>
            </div>
          )}

          {err && <div className="text-xs text-red-500 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 mb-4">{err}</div>}
          {loading && <p className="text-sm text-accent animate-pulse">Composing the report and weighting the evidence… this takes about a minute.</p>}
        </div>

        {report && (
          <div id="flagship-report" className="bg-surface border border-main rounded-2xl px-8 py-10">
            <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-hint">Strategic Positioning · {projectName} · {report.meta?.scope === "brand" ? report.meta?.subject : "Category"} · {report.meta?.icp} lens</div>
            {(report.sections || []).map((s) => {
              const editing = editKey === s.key;
              const cs = comments[s.key] || [];
              return (
                <div key={s.key} className="mt-7 group">
                  <div className="no-print flex items-center justify-end gap-1.5 mb-1 opacity-0 group-hover:opacity-100 transition">
                    <button onClick={() => regenerate(s.key)} disabled={!!regenKey || loading} className="px-2 py-0.5 rounded-full text-[11px] border border-main text-muted hover:text-main disabled:opacity-50">
                      {regenKey === s.key ? "↻ Regenerating…" : "↻ Regenerate"}
                    </button>
                    <button onClick={() => setEditKey(editing ? null : s.key)} className={`px-2 py-0.5 rounded-full text-[11px] border ${editing ? "bg-accent text-white border-transparent" : "border-main text-muted hover:text-main"}`}>{editing ? "Done" : "Edit"}</button>
                  </div>
                  {regenKey === s.key ? (
                    <p className="text-sm text-accent animate-pulse py-4">Regenerating this section…</p>
                  ) : editing ? (
                    <textarea value={s.markdown} onChange={(e) => setSectionMd(s.key, e.target.value)} rows={Math.min(28, Math.max(8, s.markdown.split("\n").length + 2))} className="w-full px-3 py-2 bg-surface2 border border-main rounded-lg text-sm text-main font-mono leading-relaxed" />
                  ) : (
                    <div className="prose prose-sm max-w-none text-main prose-headings:text-main prose-strong:text-main prose-li:text-main prose-a:text-accent">
                      <ReactMarkdown urlTransform={(u) => u} components={{ a: CiteLink }}>{s.markdown}</ReactMarkdown>
                    </div>
                  )}

                  {(cs.length > 0) && (
                    <div className="no-print mt-2 space-y-1.5">
                      {cs.map((c) => (
                        <div key={c.id} className="flex items-start gap-2 text-xs bg-surface2 border-l-2 border-accent rounded px-2.5 py-1.5">
                          <span className="text-amber-500">💬</span>
                          <span className="flex-1 text-main">{c.text}</span>
                          <button onClick={() => removeComment(s.key, c.id)} className="text-hint hover:text-main">×</button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="no-print mt-1.5 flex items-center gap-2">
                    <input value={draft[s.key] || ""} onChange={(e) => setDraft((d) => ({ ...d, [s.key]: e.target.value }))} onKeyDown={(e) => { if (e.key === "Enter") addComment(s.key); }} placeholder="Add a comment…" className="flex-1 px-2.5 py-1 bg-transparent border border-dashed border-main rounded-lg text-xs text-main opacity-0 group-hover:opacity-100 focus:opacity-100 transition" />
                    {(draft[s.key] || "").trim() && <button onClick={() => addComment(s.key)} className="px-2 py-1 rounded-lg text-[11px] bg-accent text-white">Add</button>}
                  </div>
                </div>
              );
            })}
            <div className="text-[10px] text-hint mt-8 font-mono">{report.meta?.brands} brands · {report.meta?.inRange ?? report.meta?.pieces} pieces analyzed · {report.meta?.brandDna} brand DNA profiles</div>
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
