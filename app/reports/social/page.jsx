"use client";
import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
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
  { key: "snapshot", label: "Snapshot", desc: "Brands, posts, window, who leads, dominant pillars & platforms" },
  { key: "territories", label: "Territories & angles", desc: "Shared territories + each brand's angle → re-angle opportunity" },
  { key: "voice", label: "Personality & voice", desc: "Tone & archetype compared across brands, from content" },
  { key: "declared_deployed", label: "Declared vs deployed", desc: "Web/brand-profile positioning vs actual social — gaps" },
  { key: "working", label: "What's working", desc: "Pillars, formats & posts that drive engagement — and why" },
  { key: "cadence", label: "Cadence, format & platform", desc: "Posting rhythm, format mix and platform mix per brand" },
  { key: "takeaways", label: "Takeaways", desc: "Prioritised, concrete social recommendations" },
];

function SocialInner() {
  const router = useRouter();
  const { projectId, projectName } = useProject();
  const { framework } = useFramework() || {};
  const [brands, setBrands] = useState([]);
  const [pillars, setPillars] = useState([]);
  const [platforms, setPlatforms] = useState([]);
  const [years, setYears] = useState([]);
  const [rows, setRows] = useState([]);
  const [scope, setScope] = useState("category");
  const [brand, setBrand] = useState("");
  const [icp, setIcp] = useState("brand");
  const [loading, setLoading] = useState(false);
  const [regenKey, setRegenKey] = useState(null);
  const [err, setErr] = useState("");
  const [report, setReport] = useState(null);
  const [cite, setCite] = useState(null);
  const [saved, setSaved] = useState("");
  const [savedId, setSavedId] = useState(null);
  const [opening, setOpening] = useState(false);
  const [showCfg, setShowCfg] = useState(false);
  const [filters, setFilters] = useState({ brands: [], pillars: [], platforms: [], yearFrom: "", yearTo: "" });
  const [cfg, setCfg] = useState(SECTION_LIST.map((s) => ({ ...s, on: true, prompt: "" })));
  const [customInstructions, setCustomInstructions] = useState("");

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
        const { data } = await supabase.from("creative_source").select("competitor,brand,brand_name,channel,year,custom_dimensions").eq("project_id", projectId);
        const parse = (cd) => { try { return typeof cd === "string" ? JSON.parse(cd) : (cd || {}); } catch { return {}; } };
        const rws = (data || []).map((r) => { const cd = parse(r.custom_dimensions), s = cd._social || {}, m = cd._meta || {}; const posted = m.posted_at || ""; return { brand: r.competitor || r.brand || r.brand_name || "—", pillar: s.content_pillar || "Unclassified", platform: s.platform || r.channel || "", year: r.year || (posted ? Number(String(posted).slice(0, 4)) : null) }; });
        setRows(rws);
        let list = fwNames;
        if (!list.length) list = [...new Set(rws.map((r) => r.brand))].filter((b) => b && b !== "—");
        setBrands(list); setBrand((b) => b || list[0] || "");
        setPillars([...new Set(rws.map((r) => r.pillar).filter((p) => p && p !== "Unclassified"))].sort());
        setPlatforms([...new Set(rws.map((r) => r.platform).filter(Boolean))].sort());
        setYears([...new Set(rws.map((r) => r.year).filter(Boolean))].sort());
      } catch {}
    })();
  }, [projectId, framework]);

  const inRange = useMemo(() => rows.filter((r) => {
    if (filters.brands.length && !filters.brands.includes(r.brand)) return false;
    if (filters.pillars.length && !filters.pillars.includes(r.pillar)) return false;
    if (filters.platforms.length && !filters.platforms.includes(r.platform)) return false;
    if (filters.yearFrom && r.year && Number(r.year) < Number(filters.yearFrom)) return false;
    if (filters.yearTo && r.year && Number(r.year) > Number(filters.yearTo)) return false;
    return true;
  }).length, [rows, filters]);

  const bodyFor = (extra) => ({
    project_id: projectId, scope, brand: scope === "brand" ? brand : "", icp,
    sections: cfg.map(({ key, on, prompt }) => ({ key, on, prompt })),
    filters, customInstructions, ...extra,
  });

  const generate = async () => {
    if (loading) return;
    setLoading(true); setErr(""); setReport(null); setSaved(""); setSavedId(null);
    try {
      const res = await fetch("/api/reports/social", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(bodyFor()) });
      const dt = await res.json();
      if (dt.error) setErr(dt.error); else setReport(dt);
    } catch (e) { setErr(e.message); }
    setLoading(false);
  };

  const regenerate = async (key) => {
    if (regenKey || loading) return;
    setRegenKey(key); setErr(""); setSaved("");
    try {
      const res = await fetch("/api/reports/social", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(bodyFor({ section: key, priorSections: report?.sections || [] })) });
      const dt = await res.json();
      if (dt.error) setErr(dt.error);
      else if (dt.section) setReport((r) => ({ ...r, sections: r.sections.map((s) => (s.key === key ? dt.section : s)) }));
    } catch (e) { setErr(e.message); }
    setRegenKey(null);
  };

  const ensureSaved = async () => {
    const supabase = createClient();
    const subject = report.meta?.scope === "brand" ? report.meta?.subject : "Category";
    const title = `Social Content Benchmark — ${projectName} · ${subject}`;
    const content = (report.sections || []).map((s) => s.markdown).join("\n\n");
    if (savedId) {
      const { error } = await supabase.from("saved_reports").update({ content, title }).eq("id", savedId);
      if (error) throw new Error(error.message);
      return savedId;
    }
    const id = String(Date.now());
    const { error } = await supabase.from("saved_reports").insert({ id, title, content, template_type: "social_benchmark", scope: "local", project_id: projectId });
    if (error) throw new Error(error.message);
    setSavedId(id);
    return id;
  };
  const save = async () => { if (!report) return; try { await ensureSaved(); setSaved("Saved ✓"); } catch { setSaved("Error saving"); } };
  const openEditor = async () => {
    if (!report || opening) return;
    setOpening(true); setErr("");
    try { const id = await ensureSaved(); router.push(`/reports/editor?id=${id}`); }
    catch (e) { setErr("Couldn't open the editor: " + e.message); setOpening(false); }
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

  const CiteLink = ({ href, children }) => {
    if (href && href.startsWith("cite:")) {
      const id = href.slice(5);
      return <button onClick={() => openCite(id)} className="text-accent underline decoration-dotted underline-offset-2 hover:opacity-80">{children}</button>;
    }
    return <a href={href} target="_blank" rel="noopener" className="text-accent underline">{children}</a>;
  };

  const offCount = cfg.filter((s) => !s.on).length;
  const filtersActive = filters.brands.length || filters.pillars.length || filters.platforms.length || filters.yearFrom || filters.yearTo;

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      <style>{`@media print { .no-print { display: none !important; } body * { visibility: hidden; } #social-report, #social-report * { visibility: visible; } #social-report { position: absolute; left: 0; top: 0; width: 100%; border: none; padding: 0; } }`}</style>
      <div className="no-print"><Nav /></div>
      <div className="max-w-[860px] mx-auto px-6 pb-24" style={{ paddingTop: "calc(var(--sec-h) + 20px)" }}>
        <div className="no-print">
          <h1 className="text-2xl font-bold text-main">Social Content Benchmark</h1>
          <p className="text-sm text-muted mt-1">How competitors use social and what works — weighted by engagement. Configure once, then refine, regenerate or edit any section.</p>

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
            {report && <button onClick={openEditor} disabled={opening} className="px-3 py-2 rounded-full text-xs font-semibold text-white disabled:opacity-60" style={{ background: "var(--accent)" }}>{opening ? "Opening…" : "✎ Edit"}</button>}
            {report && <button onClick={save} className="px-3 py-2 border border-main rounded-full text-xs text-main hover:bg-surface2">{saved || "Save"}</button>}
            {report && <button onClick={() => window.print()} className="px-3 py-2 border border-main rounded-full text-xs text-main hover:bg-surface2">↓ PDF</button>}
          </div>

          {showCfg && (
            <div className="mb-6 space-y-3">
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
                  <div className="ml-auto mb-1 text-xs text-hint">{inRange} of {rows.length} posts in range</div>
                </div>
              </div>

              <div className="bg-surface rounded-lg border border-main p-4">
                <h3 className="text-sm font-semibold text-main mb-2">Brands</h3>
                <div className="flex gap-2 flex-wrap">{brands.map((b) => <Chip key={b} on={filters.brands.includes(b)} onClick={() => toggleFilter("brands", b)}>{b}</Chip>)}</div>
                <p className="text-[10px] text-hint mt-2">{filters.brands.length === 0 ? "All brands included" : `${filters.brands.length} selected`}</p>
              </div>

              {pillars.length > 0 && (
                <div className="bg-surface rounded-lg border border-main p-4">
                  <h3 className="text-sm font-semibold text-main mb-2">Content pillars</h3>
                  <div className="flex gap-2 flex-wrap">{pillars.map((p) => <Chip key={p} on={filters.pillars.includes(p)} onClick={() => toggleFilter("pillars", p)}>{p}</Chip>)}</div>
                  <p className="text-[10px] text-hint mt-2">{filters.pillars.length === 0 ? "All pillars included" : `${filters.pillars.length} selected`}</p>
                </div>
              )}

              {platforms.length > 1 && (
                <div className="bg-surface rounded-lg border border-main p-4">
                  <h3 className="text-sm font-semibold text-main mb-2">Platforms</h3>
                  <div className="flex gap-2 flex-wrap">{platforms.map((p) => <Chip key={p} on={filters.platforms.includes(p)} onClick={() => toggleFilter("platforms", p)}>{p}</Chip>)}</div>
                  <p className="text-[10px] text-hint mt-2">{filters.platforms.length === 0 ? "All platforms included" : `${filters.platforms.length} selected`}</p>
                </div>
              )}

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
                        <input value={s.prompt} onChange={(e) => setSecPrompt(i, e.target.value)} disabled={!s.on} placeholder="Optional direction for this section…" className="w-full mt-1.5 px-2.5 py-1.5 bg-surface border border-main rounded-lg text-xs text-main disabled:opacity-50" />
                      </div>
                      <div className="flex flex-col gap-0.5 pt-0.5 opacity-0 group-hover:opacity-100 transition flex-shrink-0">
                        <button onClick={() => moveSec(i, -1)} disabled={i === 0} className="text-hint hover:text-main disabled:opacity-30 text-xs leading-none">▲</button>
                        <button onClick={() => moveSec(i, 1)} disabled={i === cfg.length - 1} className="text-hint hover:text-main disabled:opacity-30 text-xs leading-none">▼</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-surface rounded-lg border border-main p-4">
                <h3 className="text-sm font-semibold text-main mb-2">Custom instructions</h3>
                <textarea value={customInstructions} onChange={(e) => setCustomInstructions(e.target.value)} placeholder="A direction applied across the whole report…" className="w-full px-3 py-2 bg-surface border border-main rounded-lg text-sm text-main resize-y focus:outline-none focus:border-[var(--accent)]" rows={2} />
              </div>
            </div>
          )}

          {err && <div className="text-xs text-red-500 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 mb-4">{err}</div>}
          {loading && <p className="text-sm text-accent animate-pulse">Composing the benchmark and weighting by engagement… this takes about a minute.</p>}
        </div>

        {report && (
          <div id="social-report" className="bg-surface border border-main rounded-2xl px-8 py-10">
            <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-hint">Social Content Benchmark · {projectName} · {report.meta?.scope === "brand" ? report.meta?.subject : "Category"} · {report.meta?.icp} lens</div>
            {(report.sections || []).map((s) => (
              <div key={s.key} className="mt-7 group">
                <div className="no-print flex items-center justify-end gap-1.5 mb-1 opacity-0 group-hover:opacity-100 transition">
                  <button onClick={() => regenerate(s.key)} disabled={!!regenKey || loading} className="px-2 py-0.5 rounded-full text-[11px] border border-main text-muted hover:text-main disabled:opacity-50">
                    {regenKey === s.key ? "↻ Regenerating…" : "↻ Regenerate"}
                  </button>
                </div>
                {regenKey === s.key ? (
                  <p className="text-sm text-accent animate-pulse py-4">Regenerating this section…</p>
                ) : (
                  <div className="prose prose-sm max-w-none text-main prose-headings:text-main prose-strong:text-main prose-li:text-main prose-a:text-accent">
                    <ReactMarkdown urlTransform={(u) => u} components={{ a: CiteLink }}>{s.markdown}</ReactMarkdown>
                  </div>
                )}
              </div>
            ))}
            <div className="text-[10px] text-hint mt-8 font-mono">{report.meta?.brands} brands · {report.meta?.posts} posts · {report.meta?.pillars} pillars · {report.meta?.dateRange}</div>
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

export default function SocialReportPage() {
  return (
    <AuthGuard>
      <ProjectGuard>
        <SocialInner />
      </ProjectGuard>
    </AuthGuard>
  );
}
