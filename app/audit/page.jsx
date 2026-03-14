"use client";
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import { OPTIONS, COMPETITOR_COLORS, getFieldsForScope, getTableName } from "@/lib/options";
import AuthGuard from "@/components/AuthGuard";
import Nav from "@/components/Nav";

function ytId(u) { if (!u) return null; const m = u.match(/(?:youtube\.com\/watch\?.*v=|youtu\.be\/)([^&\s]+)/); return m ? m[1] : null; }
function isImage(u) { return u && /\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/i.test(u); }
function Tag({ v }) { return <span style={{ background: COMPETITOR_COLORS[v] || "#888", color: "#fff", padding: "1px 6px", borderRadius: 3, fontSize: 11, fontWeight: 600 }}>{v}</span>; }

function AuditContent({ scope }) {
  const [data, setData] = useState([]);
  const [cur, setCur] = useState({});
  const [vw, setVw] = useState("list");
  const [eid, setEid] = useState(null);
  const [fl, setFl] = useState({});
  const [sec, setSec] = useState(0);
  const [sb, setSb] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState("asc");
  const [selected, setSelected] = useState(new Set());
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [ytLoading, setYtLoading] = useState(false);
  const supabase = createClient();

  const load = useCallback(async () => {
    setLoading(true);
    const { data: rows } = await supabase.from(getTableName(scope)).select("*").order("created_at", { ascending: true });
    setData(rows || []); setLoading(false); setSelected(new Set()); setSb(null);
  }, [scope]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    const e = { ...cur }; delete e.created_at;
    if (!e.competitor && !e.brand && !e.description) return;
    const table = getTableName(scope);
    if (eid) { await supabase.from(table).update(e).eq("id", eid); }
    else { e.id = String(Date.now()); const { data: { session } } = await supabase.auth.getSession(); e.created_by = session?.user?.email || ""; await supabase.from(table).insert(e); }
    setCur({}); setEid(null); setVw("list"); load();
  };

  const del = async (id) => { await supabase.from(getTableName(scope)).delete().eq("id", id); if (sb?.id === id) setSb(null); load(); };

  const bulkDelete = async () => {
    if (selected.size === 0 || !confirm(`Delete ${selected.size} entries?`)) return;
    const table = getTableName(scope);
    for (const id of selected) { await supabase.from(table).delete().eq("id", id); }
    if (sb && selected.has(sb.id)) setSb(null); load();
  };

  const toggleSelect = (id) => { setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; }); };

  const doExport = () => {
    const ks = getFieldsForScope(scope).flatMap(s => s.fields.map(f => f.key));
    const h = ks.join(",");
    const rows = data.map(e => ks.map(k => '"' + (e[k] || "").replace(/"/g, '""').replace(/\n/g, " ") + '"').join(","));
    const blob = new Blob([[h, ...rows].join("\n")], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `audit_${scope}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  // YouTube metadata extraction
  const fetchYTMeta = async (url) => {
    setYtLoading(true);
    try {
      const res = await fetch("/api/youtube", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url }) });
      const meta = await res.json();
      if (!meta.error) {
        setCur(prev => ({
          ...prev,
          description: prev.description || meta.title || "",
          image_url: prev.image_url || meta.thumbnail || "",
          synopsis: prev.synopsis || (meta.description ? meta.description.slice(0, 300) : ""),
          year: prev.year || meta.year || "",
          ...(scope === "global" ? { brand: prev.brand || meta.channel || "" } : {}),
        }));
      }
    } catch {} 
    setYtLoading(false);
  };

  const handleUrlChange = (url) => { setCur(prev => ({ ...prev, url })); if (ytId(url)) fetchYTMeta(url); };

  // Image upload to Supabase Storage
  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${Date.now()}.${ext}`;
    const { data: uploadData, error } = await supabase.storage.from("media").upload(path, file);
    if (!error) {
      const { data: { publicUrl } } = supabase.storage.from("media").getPublicUrl(path);
      setCur(prev => ({ ...prev, image_url: publicUrl }));
    }
    setUploading(false);
  };

  // AI image analysis
  const analyzeImage = async () => {
    const imgUrl = cur.image_url;
    if (!imgUrl) return;
    setAnalyzing(true);
    try {
      const context = cur.competitor ? `Brand: ${cur.competitor}` : cur.brand ? `Brand: ${cur.brand}` : "";
      const res = await fetch("/api/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ imageUrl: imgUrl, context }) });
      const result = await res.json();
      if (result.success && result.analysis) {
        const a = result.analysis;
        setCur(prev => {
          const updated = { ...prev };
          // Only fill empty fields
          if (!updated.description && a.description) updated.description = a.description;
          if (!updated.synopsis && a.synopsis) updated.synopsis = a.synopsis;
          if (!updated.main_slogan && a.main_slogan) updated.main_slogan = a.main_slogan;
          if (!updated.insight && a.insight) updated.insight = a.insight;
          if (!updated.idea && a.idea) updated.idea = a.idea;
          if (!updated.tone_of_voice && a.tone_of_voice) updated.tone_of_voice = a.tone_of_voice;
          if (!updated.execution_style && a.execution_style) updated.execution_style = a.execution_style;
          if (!updated.brand_archetype && a.brand_archetype) updated.brand_archetype = a.brand_archetype;
          if (!updated.bank_role && a.bank_role) updated.bank_role = a.bank_role;
          if (!updated.language_register && a.language_register) updated.language_register = a.language_register;
          if (!updated.pain_point_type && a.pain_point_type) updated.pain_point_type = a.pain_point_type;
          if (!updated.representation && a.representation) updated.representation = a.representation;
          if (!updated.transcript && a.transcript) updated.transcript = a.transcript;
          if (!updated.analyst_comment && a.analyst_comment) updated.analyst_comment = a.analyst_comment;
          return updated;
        });
      }
    } catch {}
    setAnalyzing(false);
  };

  let fd = data.filter(e => Object.entries(fl).every(([k, v]) => !v || (e[k] || "").includes(v)));
  if (sortCol) { fd = [...fd].sort((a, b) => { const va = (a[sortCol] || "").toLowerCase(), vb = (b[sortCol] || "").toLowerCase(); return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va); }); }
  const handleSort = (col) => { if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc"); else { setSortCol(col); setSortDir("asc"); } };
  const getOpts = (f) => OPTIONS[f.optKey || f.key] || [];
  const sections = getFieldsForScope(scope);

  if (loading) return <div className="p-10 text-center text-hint">Loading...</div>;

  // ── FORM VIEW ──
  if (vw === "form") {
    const y = ytId(cur.url);
    const imgUrl = cur.image_url;
    const hasPreview = y || (imgUrl && isImage(imgUrl)) || cur.url;

    return (
      <div className="min-h-screen" style={{ background: "var(--bg)" }}>
        <div className="bg-surface border-b border-main px-5 py-3 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-main">{eid ? "Edit entry" : "New entry"}</h2>
            <span className="text-xs text-hint bg-accent-soft px-2 py-0.5 rounded font-medium">{scope === "local" ? "Local" : "Global"}</span>
            {ytLoading && <span className="text-xs text-accent">Fetching metadata...</span>}
          </div>
          <div className="flex gap-2">
            <button onClick={() => { setVw("list"); setEid(null); setCur({}); }} className="px-3 py-1.5 text-sm border border-main rounded-lg text-muted hover:bg-surface2">Cancel</button>
            <button onClick={save} className="px-4 py-1.5 text-sm bg-accent text-white rounded-lg font-semibold hover:opacity-90">Save</button>
          </div>
        </div>
        <div className="flex" style={{ height: "calc(100vh - 52px)" }}>
          {/* Left: Preview */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="bg-surface border-b border-main px-4 py-2 space-y-2">
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-[9px] text-hint uppercase font-semibold mb-0.5">URL (YouTube, website, social)</label>
                  <input value={cur.url || ""} onChange={e => handleUrlChange(e.target.value)}
                    placeholder="https://..." className="w-full px-2 py-1.5 bg-surface2 border border-main rounded text-sm text-main" />
                </div>
                <div className="w-[240px]">
                  <label className="block text-[9px] text-hint uppercase font-semibold mb-0.5">Image URL or upload</label>
                  <div className="flex gap-1">
                    <input value={cur.image_url || ""} onChange={e => setCur({ ...cur, image_url: e.target.value })}
                      placeholder="https://...image.jpg" className="flex-1 px-2 py-1.5 bg-surface2 border border-main rounded text-sm text-main" />
                    <label className="px-2 py-1.5 bg-surface2 border border-main rounded text-xs text-muted cursor-pointer hover:bg-accent-soft flex items-center">
                      {uploading ? "..." : "↑"}
                      <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                    </label>
                  </div>
                </div>
              </div>
              {/* AI Analyze button */}
              {(imgUrl || y) && (
                <button onClick={analyzeImage} disabled={analyzing}
                  className="text-xs bg-accent-soft text-accent border border-[var(--accent)] px-3 py-1 rounded-lg font-medium hover:opacity-80 disabled:opacity-50">
                  {analyzing ? "Analyzing with AI..." : "✦ Analyze with AI"}
                </button>
              )}
            </div>

            <div className="flex-1 bg-surface2 flex items-center justify-center overflow-auto p-4">
              {y ? (
                <iframe width="100%" height="100%" style={{ maxHeight: 500, maxWidth: 800 }}
                  src={`https://www.youtube.com/embed/${y}`} frameBorder="0" allowFullScreen className="rounded-lg" />
              ) : imgUrl && isImage(imgUrl) ? (
                <img src={imgUrl} className="max-w-full max-h-full rounded-lg" alt="" />
              ) : cur.url ? (
                <div className="w-full h-full flex flex-col items-center justify-center">
                  <iframe src={cur.url} width="100%" height="100%" className="rounded-lg border border-main flex-1"
                    sandbox="allow-scripts allow-same-origin" style={{ maxWidth: 900 }} />
                  <a href={cur.url} target="_blank" className="mt-2 text-xs text-accent hover:underline">Open in new tab</a>
                </div>
              ) : (
                <div className="text-center text-hint">
                  <p className="text-lg mb-2">Paste a URL or upload an image</p>
                  <p className="text-sm">YouTube, website, image URL, or file upload</p>
                </div>
              )}
            </div>
          </div>

          {/* Right: Form */}
          <div className="w-[380px] border-l border-main bg-surface overflow-auto">
            <div className="p-3">
              {sections.map((s, si) => (
                <div key={si} className="mb-1">
                  <div onClick={() => setSec(sec === si ? -1 : si)}
                    className={`px-3 py-2 rounded-lg cursor-pointer flex justify-between text-xs font-semibold ${sec === si ? "bg-accent-soft text-accent border border-[var(--accent)]" : "bg-surface2 border border-main text-main"}`}>
                    <span>{s.title}</span><span className="text-hint">{sec === si ? "−" : "+"}</span>
                  </div>
                  {sec === si && (
                    <div className="py-2 space-y-2">
                      {s.fields.filter(f => f.key !== "url" && f.key !== "image_url").map(f => (
                        <div key={f.key}>
                          <label className="block text-[10px] text-muted uppercase font-semibold mb-0.5">{f.label}</label>
                          {f.type === "select" ? (
                            <div>
                              <select value={cur[f.key] || ""} onChange={e => setCur({ ...cur, [f.key]: e.target.value })}
                                className="w-full px-2 py-1.5 bg-surface border border-main rounded text-sm text-main">
                                <option value="">—</option>{getOpts(f).map(o => <option key={o} value={o}>{o}</option>)}
                              </select>
                              {cur[f.key] === "Other" && <input value={cur[f.key + "_other"] || ""} onChange={e => setCur({ ...cur, [f.key + "_other"]: e.target.value })}
                                placeholder="Specify..." className="w-full mt-1 px-2 py-1 border border-[var(--accent)] rounded text-xs bg-accent-soft text-main" />}
                            </div>
                          ) : f.type === "textarea" ? (
                            <textarea value={cur[f.key] || ""} onChange={e => setCur({ ...cur, [f.key]: e.target.value })}
                              rows={2} className="w-full px-2 py-1.5 bg-surface border border-main rounded text-sm text-main resize-y" />
                          ) : (
                            <input value={cur[f.key] || ""} onChange={e => setCur({ ...cur, [f.key]: e.target.value })}
                              className="w-full px-2 py-1.5 bg-surface border border-main rounded text-sm text-main" />
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="p-3 border-t border-main">
              <button onClick={save} className="w-full bg-accent text-white py-2 rounded-lg text-sm font-semibold hover:opacity-90">
                {eid ? "Save changes" : "Save entry"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── LIST VIEW ──
  const cols = [
    { key: "_select", label: "", nosort: true },
    { key: scope === "local" ? "competitor" : "brand", label: "Brand" },
    { key: "category", label: "Cat." },
    { key: "description", label: "Description" },
    { key: "year", label: "Year" },
    { key: "type", label: "Type" },
    { key: "portrait", label: "Portrait" },
    { key: "journey_phase", label: "Phase" },
    { key: "rating", label: "★" },
  ];

  const filterKeys = scope === "local"
    ? [["competitor","Competitor"],["category","Category"],["portrait","Portrait"],["journey_phase","Phase",OPTIONS.journeyPhase],["client_lifecycle","Lifecycle",OPTIONS.clientLifecycle],["brand_archetype","Archetype",OPTIONS.brandArchetype]]
    : [["category","Category"],["portrait","Portrait"],["journey_phase","Phase",OPTIONS.journeyPhase],["category_proximity","Proximity",OPTIONS.categoryProximity],["brand_archetype","Archetype",OPTIONS.brandArchetype]];

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      <div style={{ marginRight: sb ? 380 : 0, transition: "margin 0.15s" }}>
        <div className="bg-surface border-b border-main px-5 py-2.5 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-bold text-main">{scope === "local" ? "Local audit" : "Global benchmarks"}</h2>
            <span className="text-xs text-hint">{fd.length} of {data.length}</span>
          </div>
          <div className="flex gap-2 items-center">
            {selected.size > 0 && <button onClick={bulkDelete} className="px-3 py-1.5 text-xs bg-red-500 text-white rounded-lg font-semibold">Delete {selected.size}</button>}
            <button onClick={() => { setCur({}); setEid(null); setVw("form"); setSec(0); }} className="px-3 py-1.5 text-sm bg-accent text-white rounded-lg font-semibold">+ Add</button>
            <button onClick={doExport} className="px-3 py-1.5 text-sm border border-main rounded-lg text-muted hover:bg-surface2">Export</button>
          </div>
        </div>
        <div className="bg-surface border-b border-main px-5 py-2 flex gap-2 flex-wrap items-center">
          <span className="text-[10px] text-hint uppercase font-semibold">Filter:</span>
          {filterKeys.map(([k, l, opts]) => (
            <select key={k} value={fl[k] || ""} onChange={e => setFl({ ...fl, [k]: e.target.value })}
              className="px-1.5 py-1 border border-main rounded text-xs bg-surface text-main">
              <option value="">{l}</option>{(opts || OPTIONS[k] || []).map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          ))}
          {Object.values(fl).some(Boolean) && <span onClick={() => setFl({})} className="text-accent text-xs cursor-pointer">Clear</span>}
        </div>
        <div className="px-5 pb-5 overflow-x-auto">
          <table className="w-full border-collapse text-xs mt-1">
            <thead><tr className="border-b-2 border-main">
              {cols.map((c, i) => (
                <th key={i} onClick={() => !c.nosort && handleSort(c.key)}
                  className={`text-left px-2 py-2 text-[10px] text-muted uppercase font-semibold ${!c.nosort ? "cursor-pointer hover:text-main select-none" : ""}`}>
                  {c.key === "_select" ? <input type="checkbox" checked={selected.size === fd.length && fd.length > 0} onChange={() => selected.size === fd.length ? setSelected(new Set()) : setSelected(new Set(fd.map(e => e.id)))} />
                    : <span>{c.label} {sortCol === c.key ? (sortDir === "asc" ? "↑" : "↓") : ""}</span>}
                </th>
              ))}<th></th>
            </tr></thead>
            <tbody>{fd.map(e => (
              <tr key={e.id} className="border-b border-main hover:bg-accent-soft cursor-pointer" onClick={() => setSb(e)}>
                <td className="px-2 py-1.5" onClick={ev => ev.stopPropagation()}><input type="checkbox" checked={selected.has(e.id)} onChange={() => toggleSelect(e.id)} /></td>
                <td className="px-2 py-1.5">{scope === "local" ? <Tag v={e.competitor} /> : <span className="font-medium text-main">{e.brand || "—"}</span>}</td>
                <td className="px-2 py-1.5"><Tag v={e.category} /></td>
                <td className="px-2 py-1.5 max-w-[180px] truncate font-medium text-main">{e.description || "—"}</td>
                <td className="px-2 py-1.5 text-muted">{e.year || "—"}</td>
                <td className="px-2 py-1.5 text-muted">{e.type || "—"}</td>
                <td className="px-2 py-1.5 text-main">{e.portrait || "—"}</td>
                <td className="px-2 py-1.5 text-main">{e.journey_phase || "—"}</td>
                <td className="px-2 py-1.5 text-main">{e.rating ? "★".repeat(Number(e.rating)) : "—"}</td>
                <td className="px-2 py-1" onClick={ev => ev.stopPropagation()}><span onClick={() => del(e.id)} className="text-hint hover:text-red-400 cursor-pointer text-sm">×</span></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div>

      {/* Sidebar */}
      {sb && (
        <div className="fixed top-0 right-0 w-[380px] h-screen bg-surface border-l border-main overflow-auto z-50" style={{ boxShadow: "-2px 0 12px rgba(0,0,0,0.05)" }}>
          <div className="p-3 border-b border-main flex justify-between items-center sticky top-0 bg-surface z-10">
            <b className="text-sm text-main">{sb.description || sb.competitor || sb.brand}</b>
            <span onClick={() => setSb(null)} className="cursor-pointer text-lg text-hint hover:text-main">×</span>
          </div>
          {ytId(sb.url) && <div className="px-3 pt-2"><iframe width="100%" height="195" src={`https://www.youtube.com/embed/${ytId(sb.url)}`} frameBorder="0" allowFullScreen className="rounded-md" /></div>}
          {sb.image_url && !ytId(sb.url) && <div className="px-3 pt-2"><img src={sb.image_url} className="w-full rounded-md" /></div>}
          {sb.url && !ytId(sb.url) && <div className="px-3 pt-1"><a href={sb.url} target="_blank" className="text-[11px] text-accent break-all">{sb.url}</a></div>}
          <div className="p-3">
            <div className="flex gap-1 flex-wrap mb-2">
              {sb.competitor && <Tag v={sb.competitor} />}{sb.brand && <span className="text-xs font-semibold text-main bg-surface2 px-1.5 py-0.5 rounded">{sb.brand}</span>}
              {sb.category && <Tag v={sb.category} />}{sb.year && <span className="bg-surface2 px-1.5 py-0.5 rounded text-[11px] text-main">{sb.year}</span>}
              {sb.rating && <span className="text-[11px]">{"★".repeat(Number(sb.rating))}</span>}
            </div>
            {[["Type",sb.type],["Portrait",sb.portrait],["Phase",sb.journey_phase],["Lifecycle",sb.client_lifecycle],["Door",sb.entry_door],["Role",sb.bank_role],["Archetype",sb.brand_archetype],["Tone",sb.tone_of_voice],["Language",sb.language_register],["Territory",sb.primary_territory],["Execution",sb.execution_style],["VP",sb.main_vp],["Slogan",sb.main_slogan]].filter(([,v])=>v&&v!==""&&!v.startsWith("Not ")&&!v.startsWith("None")).map(([l,v])=>(
              <div key={l} className="text-xs mb-0.5"><span className="text-muted">{l}:</span> <span className="text-main">{v}</span></div>
            ))}
          </div>
          {sb.synopsis && <div className="px-3 pb-2"><div className="text-[10px] font-semibold text-hint uppercase mb-1">Synopsis</div><div className="text-xs leading-relaxed bg-surface2 p-2 rounded text-main">{sb.synopsis}</div></div>}
          {sb.insight && <div className="px-3 pb-2"><div className="text-[10px] font-semibold text-hint uppercase mb-1">Insight</div><div className="text-xs leading-relaxed bg-surface2 p-2 rounded text-main">{sb.insight}</div></div>}
          {sb.transcript && <div className="px-3 pb-2"><div className="text-[10px] font-semibold text-hint uppercase mb-1">Transcript</div><div className="text-xs leading-relaxed bg-surface2 p-2 rounded max-h-[150px] overflow-auto whitespace-pre-wrap text-main">{sb.transcript}</div></div>}
          {sb.analyst_comment && <div className="px-3 pb-2"><div className="text-[10px] font-semibold text-hint uppercase mb-1">Analyst comment</div><div className="text-xs leading-relaxed bg-surface2 p-2 rounded text-main">{sb.analyst_comment}</div></div>}
          <div className="p-3 border-t border-main sticky bottom-0 bg-surface">
            <button onClick={() => { setCur({ ...sb }); setEid(sb.id); setVw("form"); setSec(0); setSb(null); }}
              className="w-full bg-accent text-white py-2 rounded-lg text-sm font-semibold hover:opacity-90">Edit</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AuditPage() {
  const [scope, setScope] = useState("local");
  return <AuthGuard><Nav scope={scope} onScopeChange={setScope} /><AuditContent scope={scope} key={scope} /></AuthGuard>;
}
