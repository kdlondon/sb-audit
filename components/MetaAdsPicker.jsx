"use client";
// Scout · Meta Ads tab. Search a brand's Meta Ad Library, preview its ads, import the ones
// worth auditing. Ads enter tagged source_type='paid' / source_platform='meta_ads' with the
// observed `_ads` block — a distinct kind of evidence, not a social post.
//
// Self-contained: runs the actor once per search (via /api/ads/meta), holds the normalized
// ads, and imports the selected ones (deduped server-side by native library id).
import { useState } from "react";
import { useRole } from "@/lib/role-context";

const clean = (s) => String(s || "").trim();
const fmtDate = (d) => (d ? String(d).slice(0, 10) : "—");

export default function MetaAdsPicker({ projectId, scope = "global", brandId = null, defaultCountry = "", onImported }) {
  const { userEmail, activeOrg } = useRole() || {};

  const [query, setQuery] = useState("");
  const [country, setCountry] = useState((defaultCountry || "").toUpperCase());
  const [ads, setAds] = useState([]);
  const [sel, setSel] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [err, setErr] = useState("");
  const [note, setNote] = useState("");

  // Accept a pasted Ad Library URL, or build a keyword search from brand + country.
  const buildUrl = () => {
    const q = clean(query);
    if (/^https?:\/\//i.test(q)) return q;
    const c = (country || "ES").toUpperCase();
    return `https://www.facebook.com/ads/library/?active_status=all&ad_type=all&media_type=all&search_type=keyword_unordered&country=${c}&q=${encodeURIComponent(q)}`;
  };

  const search = async () => {
    if (!clean(query) || loading) return;
    setLoading(true); setErr(""); setNote(""); setAds([]); setSel(new Set());
    try {
      const res = await fetch("/api/ads/meta", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "search", url: buildUrl(), limit: 30, country: (country || "").toUpperCase() }),
      });
      const data = await res.json();
      if (data.error) { setErr(data.error); setLoading(false); return; }
      const list = data.ads || [];
      setAds(list);
      setSel(new Set(list.map((a) => a.library_id))); // preselect all
      if (!list.length) setNote("No se encontraron anuncios. Prueba otra marca, país, o pega la URL de Ad Library de la página.");
    } catch (e) { setErr(`No se pudo buscar — ${e.message || "error de red"}.`); }
    setLoading(false);
  };

  const toggle = (id) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const importSel = async () => {
    const chosen = ads.filter((a) => sel.has(a.library_id));
    if (!chosen.length || importing) return;
    setImporting(true); setErr(""); setNote("");
    try {
      const res = await fetch("/api/ads/meta", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "import", project_id: projectId, scope, brand_id: brandId,
          organization_id: activeOrg?.id || null, created_by: userEmail || "",
          country: (country || "").toUpperCase(), ads: chosen,
        }),
      });
      const data = await res.json();
      if (data.error) { setErr(data.error); setImporting(false); return; }
      const msg = `${data.imported} importado${data.imported === 1 ? "" : "s"}${data.skipped ? ` · ${data.skipped} omitido${data.skipped === 1 ? "" : "s"} (duplicado)` : ""}`;
      setNote(msg);
      onImported?.(data.imported);
      // Drop imported from selection so re-import doesn't double-count.
      if (data.imported) setSel(new Set());
    } catch (e) { setErr(`No se pudo importar — ${e.message || "error de red"}.`); }
    setImporting(false);
  };

  return (
    <div>
      {/* Search row */}
      <label className="text-[10px] font-mono uppercase tracking-[0.14em] text-hint block mb-1.5">Marca o URL de Ad Library</label>
      <div className="flex gap-2.5 items-center flex-wrap">
        <input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") search(); }}
          placeholder="Una marca (ej. Iberia) o pega la URL de su Ad Library…"
          className="flex-1 min-w-[240px] px-3 py-2.5 bg-surface border border-main rounded-lg text-sm text-main focus:outline-none focus:border-[var(--accent)]" />
        <input value={country} onChange={(e) => setCountry(e.target.value.toUpperCase())} maxLength={2} placeholder="País (ES)"
          className="w-[92px] px-3 py-2.5 bg-surface border border-main rounded-lg text-sm text-main uppercase focus:outline-none focus:border-[var(--accent)]" title="Código de país de 2 letras (ES, MX, PE…)" />
        <button onClick={search} disabled={loading} className="gw-ember-btn inline-flex items-center gap-2 bg-[var(--accent-ember)] text-white rounded-lg px-4 py-2.5 text-sm font-semibold disabled:opacity-60 whitespace-nowrap">
          {loading ? <><svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="30 70" strokeLinecap="round" /></svg>Buscando…</> : "Buscar anuncios"}
        </button>
      </div>
      <p className="text-[11px] text-hint mt-1.5">Publicidad pagada · corre el Ad Library de Meta (≈$0.17 por búsqueda). Entra etiquetada como <b>paid</b>.</p>

      {err && <div className="mt-3 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{err}</div>}
      {note && <div className="mt-3 text-xs text-[var(--accent-ember-deep)] bg-[#fdf6f2] border border-[var(--accent-ember-tint)] rounded-lg px-3 py-2">{note}</div>}

      {/* Results */}
      {ads.length > 0 && (
        <>
          <div className="flex items-center gap-3 mt-5 mb-3 flex-wrap">
            <span className="text-[9px] tracking-[0.16em] text-hint uppercase font-mono">{ads.length} anuncios · {sel.size} seleccionados</span>
            <button onClick={() => setSel(sel.size === ads.length ? new Set() : new Set(ads.map((a) => a.library_id)))} className="text-[11px] text-muted hover:text-main underline">
              {sel.size === ads.length ? "Ninguno" : "Todos"}
            </button>
            <button onClick={importSel} disabled={importing || !sel.size}
              className="ml-auto inline-flex items-center gap-2 bg-[var(--ink-800,#1a1a1a)] text-white rounded-lg px-4 py-2 text-xs font-semibold disabled:opacity-50 whitespace-nowrap">
              {importing ? "Importando…" : `Importar ${sel.size} como entries`}
            </button>
          </div>
          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(230px,1fr))" }}>
            {ads.map((a) => {
              const on = sel.has(a.library_id);
              return (
                <div key={a.library_id} onClick={() => toggle(a.library_id)}
                  className={`bg-white border rounded-xl overflow-hidden cursor-pointer transition ${on ? "border-[var(--accent-ember)] shadow-[0_0_0_1px_var(--accent-ember)]" : "border-[var(--border)] hover:border-[#bbb]"}`}>
                  <div className="relative h-[130px] bg-surface2 overflow-hidden">
                    {a.thumbnail ? <img src={a.thumbnail} alt="" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = "none"; }} /> : <div className="w-full h-full flex items-center justify-center text-hint text-xs">Sin previsualización</div>}
                    <span className={`absolute top-2 left-2 w-5 h-5 rounded-md flex items-center justify-center ${on ? "bg-[var(--accent-ember-deep)] text-white" : "bg-white/85 border border-[var(--border)]"}`}>
                      {on && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 6 9 17l-5-5" /></svg>}
                    </span>
                    <span className="absolute top-2 right-2 text-[8px] font-mono uppercase tracking-wide px-1.5 py-0.5 rounded bg-[rgba(26,26,26,0.72)] text-white">{a.creative_format || "AD"}</span>
                    {a.is_active && <span className="absolute bottom-2 left-2 text-[8px] font-mono uppercase px-1.5 py-0.5 rounded bg-green-600 text-white">Activo</span>}
                  </div>
                  <div className="p-2.5">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-[10px] font-semibold text-main truncate">{a.advertiser_name}</span>
                      <span className="ml-auto text-[9px] text-hint whitespace-nowrap">{a.days_running != null ? `${a.days_running}d` : ""}{a.variant_count > 1 ? ` · ${a.variant_count}v` : ""}</span>
                    </div>
                    <p className="text-[11px] text-muted leading-snug line-clamp-2 min-h-[28px]">{a.ad_text || a.title || "—"}</p>
                    <div className="flex items-center gap-1 mt-2 flex-wrap">
                      {(a.serving_platforms || []).slice(0, 3).map((p) => <span key={p} className="text-[8px] font-mono uppercase text-hint bg-surface2 rounded px-1 py-0.5">{p.slice(0, 2)}</span>)}
                      <span className="ml-auto text-[8.5px] text-hint">{fmtDate(a.start_date)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
