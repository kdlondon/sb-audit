"use client";
// Collections — the workspace, being moved out of Creative Source into Intelligence.
//
// Step 2a: the LIST surface (official grid + Groundwork's suggestions + the manual scan).
// Opening a collection still routes to the existing detail at /audit?collection=<id> for
// now; the detail/storyboard move into this component in a later step.
//
// Self-contained: its own supabase client, router, toast and state — it takes only the
// project context as props, so it can live under any module.
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { Mosaic, BrandAvatars } from "@/components/collections/cards";

const fmtDate = (d) => { if (!d) return "—"; const dt = new Date(d); return dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) + " " + dt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }); };
const ythumb = (u) => { const m = u?.match(/(?:youtube\.com\/watch\?.*v=|youtu\.be\/)([^&\s]+)/); return m ? `https://img.youtube.com/vi/${m[1]}/mqdefault.jpg` : null; };

export default function CollectionsWorkspace({ projectId, brandId = null, orgId = null, userEmail = "", framework }) {
  const supabase = createClient();
  const router = useRouter();
  const [toast, setToast] = useState(null);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 4000); return () => clearTimeout(t); }, [toast]);

  const [collections, setCollections] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [scanning, setScanning] = useState(false);
  const [scanInfo, setScanInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [newCol, setNewCol] = useState({ name: "", description: "", objective: "", is_private: false });
  const [menuOpen, setMenuOpen] = useState(null);

  const loadCollections = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    const { data: cols } = await supabase.from("collections").select("*").eq("project_id", projectId).order("created_at", { ascending: false });
    if (cols) {
      for (const c of cols) {
        const { data: links } = await supabase.from("collection_entries").select("entry_id").eq("collection_id", c.id).order("sort_order", { ascending: true });
        c.entryCount = links?.length || 0;
        const ids = (links || []).map(l => l.entry_id).filter(Boolean);
        if (ids.length) {
          const { data: pcs } = await supabase.from("creative_source").select("id,url,image_url,competitor,brand_name,brand").in("id", ids.slice(0, 20));
          const byId = new Map((pcs || []).map(p => [p.id, p]));
          const ordered = ids.map(id => byId.get(id)).filter(Boolean);
          c.thumbs = ordered.map(p => p.image_url || ythumb(p.url) || "").filter(Boolean).slice(0, 4);
          c.brands = [...new Set(ordered.map(p => p.competitor || p.brand_name || p.brand || "").filter(Boolean))];
        } else { c.thumbs = []; c.brands = []; }
      }
      setSuggestions(cols.filter(c => c.state === "suggested"));
      setCollections(cols.filter(c => c.state !== "suggested"));
    }
    setLoading(false);
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadCollections(); }, [loadCollections]);

  // Opening a collection reuses the existing detail for now.
  const openCollection = (c) => router.push(`/audit?collection=${c.id}`);

  const scanForCollections = async () => {
    if (!projectId || scanning) return;
    setScanning(true); setScanInfo(null);
    try {
      const res = await fetch("/api/collections/scan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ project_id: projectId, brand_id: brandId, organization_id: orgId, created_by: userEmail }) });
      let data; const raw = await res.text();
      try { data = JSON.parse(raw); } catch {
        const hint = res.status === 504 ? "the scan took too long and the server cut it off" : `server returned ${res.status}`;
        setScanInfo({ kind: "error", text: `Scan couldn't finish — ${hint}.` }); setToast("Scan couldn't finish — see the note above the list"); setScanning(false); return;
      }
      if (data.error) { setScanInfo({ kind: "error", text: `Scan error: ${data.error}` }); setToast("Scan error — see the note above the list"); setScanning(false); return; }
      await loadCollections();
      const n = (data.suggestions || []).length;
      if (n) { setScanInfo(null); setToast(`${n} suggestion${n > 1 ? "s" : ""} found`); }
      else if (data.reason === "not_enough_pieces") { setScanInfo({ kind: "none", text: "Need at least 4 captured pieces before Groundwork can find a pattern." }); }
      else {
        const bits = [`${data.scanned ?? 0} pieces scanned`, `${data.proposed ?? 0} pattern${data.proposed === 1 ? "" : "s"} proposed by the model`];
        if (data.dropped) bits.push(`${data.dropped} dropped${data.drops ? ` (${Object.entries(data.drops).filter(([, v]) => v).map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}`).join(", ")})` : ""}`);
        setScanInfo({ kind: data.drops?.insert_fail > 0 ? "error" : "none", text: `No suggestions this time — ${bits.join(" · ")}.${data.insert_error ? ` DB error → ${data.insert_error}` : ""}` });
      }
    } catch (err) { console.error("scan error", err); setScanInfo({ kind: "error", text: `Scan failed — ${err.message || "network error"}. Try again.` }); setToast("Scan failed — see the note above the list"); }
    setScanning(false);
  };

  const approveSuggestion = async (col) => {
    const { error } = await supabase.from("collections").update({ state: "active" }).eq("id", col.id);
    if (error) { setToast("Error approving suggestion"); return; }
    setToast("Approved — added to collections"); await loadCollections();
  };

  const dismissSuggestion = async (col) => {
    if (col.signature) await supabase.from("collection_dismissals").upsert({ project_id: projectId, signature: col.signature, dismissed_by: userEmail || "" }, { onConflict: "project_id,signature" });
    await supabase.from("collection_entries").delete().eq("collection_id", col.id);
    await supabase.from("collections").delete().eq("id", col.id);
    setToast("Dismissed — won't be suggested again"); await loadCollections();
  };

  const createCollection = async () => {
    if (!newCol.name.trim()) { setToast("Name is required"); return; }
    const { data: created, error } = await supabase.from("collections").insert({
      name: newCol.name, description: newCol.description || null, objective: newCol.objective || null,
      is_private: newCol.is_private || false, project_id: projectId || null, brand_id: brandId, organization_id: orgId, created_by: userEmail || "",
    }).select().single();
    if (error) { setToast("Error creating collection: " + error.message); return; }
    setShowNew(false); setNewCol({ name: "", description: "", objective: "", is_private: false });
    await loadCollections();
    if (created) openCollection(created);
  };

  const deleteCollection = async (id) => {
    if (!confirm("Delete this collection? Entries will not be deleted.")) return;
    await supabase.from("collection_entries").delete().eq("collection_id", id);
    const { error } = await supabase.from("collections").delete().eq("id", id);
    if (error) { setToast("Error deleting: " + error.message); return; }
    await loadCollections();
  };

  return (
    <div>
      {/* toolbar — the module header already shows the "Collections" title */}
      <div className="flex justify-between items-center mb-5 flex-wrap gap-3">
        <p className="text-[13px] text-muted">Curated sets of pieces — yours, plus patterns Groundwork spots for you.</p>
        <div className="flex items-center gap-2">
          <button onClick={scanForCollections} disabled={scanning} title="Let Groundwork scan the Creative Source for patterns worth a collection"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-[var(--accent-ember-tint)] text-[var(--accent-ember-deep)] bg-[#fdf6f2] hover:bg-[#fbeee6] disabled:opacity-60 transition font-medium whitespace-nowrap">
            {scanning ? <><svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="30 70" strokeLinecap="round" /></svg>Scanning…</> : <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="m12 3 1.6 5L19 9.5l-5 1.6L12 16l-1.6-4.9L5 9.5 10.4 8z" /></svg>Scan for collections</>}
          </button>
          <button onClick={() => setShowNew(true)} className="px-3 py-1.5 text-xs bg-[var(--ink-800,#1a1a1a)] text-white rounded-lg font-semibold whitespace-nowrap">+ New collection</button>
        </div>
      </div>

      {showNew && (
        <div className="bg-surface border border-main rounded-lg p-4 mb-4 max-w-[520px]">
          <div className="space-y-3">
            <div><label className="text-xs font-medium text-muted block mb-1">Name *</label>
              <input value={newCol.name} onChange={e => setNewCol({ ...newCol, name: e.target.value })} className="w-full gw-finput focus:outline-none focus:border-accent" placeholder="Collection name" autoFocus /></div>
            <div><label className="text-xs font-medium text-muted block mb-1">Description</label>
              <input value={newCol.description} onChange={e => setNewCol({ ...newCol, description: e.target.value })} className="w-full gw-finput focus:outline-none focus:border-accent" placeholder="Optional description" /></div>
            <label className="flex items-center gap-2 text-xs text-main"><input type="checkbox" checked={newCol.is_private} onChange={e => setNewCol({ ...newCol, is_private: e.target.checked })} /> Private (only visible to you)</label>
            <div className="flex gap-2">
              <button onClick={createCollection} className="px-3 py-1.5 text-xs bg-accent text-white rounded-lg font-semibold">Save</button>
              <button onClick={() => { setShowNew(false); setNewCol({ name: "", description: "", objective: "", is_private: false }); }} className="px-3 py-1.5 text-xs border border-main rounded-lg text-muted">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {scanInfo && !scanning && (
        <div className={`mb-4 rounded-lg px-4 py-3 text-sm flex items-start gap-2 ${scanInfo.kind === "error" ? "bg-red-50 border border-red-200 text-red-700" : "bg-[#f6f4f0] border border-[var(--border)] text-muted"}`}>
          <span className="flex-1">{scanInfo.text}</span>
          <button onClick={() => setScanInfo(null)} className="text-hint hover:text-main flex-shrink-0" title="Dismiss">×</button>
        </div>
      )}

      {(scanning || suggestions.length > 0) && (
        <div className="mb-6 rounded-xl border border-dashed border-[var(--accent-ember-tint)] bg-[#fdf6f2] p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[var(--accent-ember-deep)]"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m12 3 1.6 5L19 9.5l-5 1.6L12 16l-1.6-4.9L5 9.5 10.4 8z" /></svg></span>
            <span className="text-[9px] tracking-[0.16em] text-[var(--accent-ember-deep)] uppercase" style={{ fontFamily: "var(--font-mono,monospace)" }}>Suggested Collections by Groundwork</span>
            {suggestions.length > 0 && <span className="text-[10px] text-hint">· {suggestions.length} proposal{suggestions.length > 1 ? "s" : ""} — approve or dismiss</span>}
          </div>
          {scanning && suggestions.length === 0 ? (
            <div className="text-sm text-[var(--accent-ember-deep)] py-6 text-center flex items-center justify-center gap-2">
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="30 70" strokeLinecap="round" /></svg>
              Reading the Creative Source for patterns…
            </div>
          ) : (
            <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(270px,1fr))" }}>
              {suggestions.map(c => (
                <div key={c.id} onClick={() => openCollection(c)} className="scard bg-white border border-[var(--accent-ember-tint)] rounded-2xl overflow-hidden cursor-pointer transition hover:shadow-[0_8px_26px_rgba(223,92,41,0.14)] hover:-translate-y-0.5">
                  <Mosaic thumbs={c.thumbs} />
                  <div className="p-[15px]">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 text-[8px] font-semibold tracking-[0.08em] uppercase px-2 py-[3px] rounded-full bg-[var(--accent-ember-tint)] text-[var(--accent-ember-deep)]" style={{ fontFamily: "var(--font-mono,monospace)" }}>{c.kind === "cross_brand" ? "Cross-brand" : "Brand pattern"}</span>
                      <span className="ml-auto text-[9.5px] text-hint">{c.entryCount} {c.entryCount === 1 ? "piece" : "pieces"}</span>
                    </div>
                    <h4 className="text-[15px] font-bold text-main leading-[1.25] mt-2.5">{c.name}</h4>
                    {c.description && <p className="text-[11.5px] text-muted leading-[1.5] mt-1.5 line-clamp-2">{c.description}</p>}
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[var(--border)]">
                      {c.brands?.length > 0 && (c.kind === "cross_brand"
                        ? <BrandAvatars brands={c.brands} />
                        : <><BrandAvatars brands={c.brands.slice(0, 1)} /><span className="text-[10.5px] font-semibold text-main">{c.brands[0]}</span></>)}
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--accent-ember-deep)" strokeWidth="1.7" className="ml-auto"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                    </div>
                    <div className="flex gap-2 mt-3" onClick={e => e.stopPropagation()}>
                      <button onClick={() => approveSuggestion(c)} className="flex-1 px-2.5 py-1.5 text-xs font-semibold text-white bg-[var(--accent-ember-deep)] rounded-lg hover:brightness-95 transition">Approve</button>
                      <button onClick={() => dismissSuggestion(c)} className="px-2.5 py-1.5 text-xs text-muted border border-[var(--border)] rounded-lg hover:text-red-500 hover:border-red-300 transition">Dismiss</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {loading ? (<div className="text-sm text-hint text-center py-8">Loading collections...</div>) : (
        <>
          <div className="flex items-center gap-2.5 mt-1 mb-4">
            <span className="text-[9px] tracking-[0.16em] text-hint uppercase" style={{ fontFamily: "var(--font-mono,monospace)" }}>Your collections · {collections.length}</span>
            <span className="flex-1 h-px bg-[var(--border)]" />
          </div>
          <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(270px,1fr))" }}>
            {collections.map(c => (
              <div key={c.id} onClick={() => openCollection(c)} className="ocard bg-white border border-[var(--border)] rounded-2xl overflow-hidden cursor-pointer transition hover:shadow-[0_8px_26px_rgba(0,0,0,0.09)] hover:-translate-y-0.5 relative group">
                <div className="relative">
                  <Mosaic thumbs={c.thumbs} />
                  {c.origin === "ai" && (
                    <span title="Born from a Groundwork suggestion" className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[rgba(26,26,26,0.72)] flex items-center justify-center">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--accent-ember)" strokeWidth="2"><path d="m12 3 1.6 5L19 9.5l-5 1.6L12 16l-1.6-4.9L5 9.5 10.4 8z" /></svg>
                    </span>
                  )}
                  <div className="absolute top-2 left-2">
                    <button onClick={e => { e.stopPropagation(); setMenuOpen(menuOpen === c.id ? null : c.id); }} className="w-6 h-6 rounded-full bg-[rgba(255,255,255,0.85)] text-[#555] hover:text-main text-sm leading-none flex items-center justify-center opacity-0 group-hover:opacity-100 transition">···</button>
                    {menuOpen === c.id && (
                      <div className="absolute left-0 top-full mt-1 bg-surface border border-main rounded-lg shadow-xl z-50 w-[120px] overflow-hidden">
                        <button onClick={e => { e.stopPropagation(); setMenuOpen(null); openCollection(c); }} className="w-full text-left px-3 py-2 text-xs text-main hover:bg-accent-soft">Open</button>
                        <button onClick={e => { e.stopPropagation(); setMenuOpen(null); deleteCollection(c.id); }} className="w-full text-left px-3 py-2 text-xs text-red-500 hover:bg-red-50">Delete</button>
                      </div>
                    )}
                  </div>
                </div>
                <div className="p-[15px]">
                  <div className="flex items-center gap-2">
                    {c.origin === "ai"
                      ? <span className="inline-flex items-center gap-1 text-[8px] font-semibold tracking-[0.08em] uppercase px-2 py-[3px] rounded-full bg-[var(--accent-ember-tint)] text-[var(--accent-ember-deep)]" style={{ fontFamily: "var(--font-mono,monospace)" }}><svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m12 3 1.6 5L19 9.5l-5 1.6L12 16l-1.6-4.9L5 9.5 10.4 8z" /></svg>AI curated</span>
                      : <span className="inline-flex items-center gap-1 text-[8px] font-semibold tracking-[0.08em] uppercase px-2 py-[3px] rounded-full bg-[var(--ink-150,#ececec)] text-[var(--text2,#666)]" style={{ fontFamily: "var(--font-mono,monospace)" }}><svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="3.2" /><path d="M5.5 20a6.5 6.5 0 0 1 13 0" /></svg>By you</span>}
                    <span className="ml-auto text-[9.5px] text-hint">{c.entryCount} {c.entryCount === 1 ? "piece" : "pieces"}</span>
                  </div>
                  <h4 className="text-sm font-bold text-main leading-[1.3] mt-2.5">{c.name}</h4>
                  {c.description && <p className="text-[11.5px] text-muted leading-[1.5] mt-1.5 line-clamp-2">{c.description}</p>}
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-[var(--border)]">
                    <span className="text-[9.5px] text-hint">Updated {fmtDate(c.updated_at || c.created_at)}</span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted,#999)" strokeWidth="1.7"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                  </div>
                </div>
              </div>
            ))}
            <div onClick={() => setShowNew(true)} className="ocard bg-white border border-dashed border-[var(--border-strong,#cbc5bb)] rounded-2xl overflow-hidden cursor-pointer transition hover:shadow-[0_8px_26px_rgba(0,0,0,0.09)] flex flex-col">
              <div className="flex-1 min-h-[106px] flex items-center justify-center text-hint">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M12 5v14M5 12h14" /></svg>
              </div>
              <div className="p-[15px] border-t border-[var(--border)]">
                <h4 className="text-sm font-bold text-main">New collection</h4>
                <p className="text-[11.5px] text-muted leading-[1.5] mt-1.5">Group pieces by hand, or ask the AI for the evidence.</p>
              </div>
            </div>
          </div>
        </>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-surface border border-main rounded-xl shadow-lg px-5 py-3 z-50">
          <span className="text-sm text-main font-medium">{toast}</span>
        </div>
      )}
    </div>
  );
}
