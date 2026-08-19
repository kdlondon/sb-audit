"use client";
// Scout · Meta Ads tab. Search a brand's Meta Ad Library, preview its ads, import the ones
// worth auditing. Ads enter tagged source_type='paid' / source_platform='meta_ads' with the
// observed `_ads` block — a distinct kind of evidence, not a social post.
//
// A brand-name search can return ads from several advertisers (Meta's page-name search is
// fuzzy), so the results are grouped BY ADVERTISER with filter chips — the analyst picks the
// right one and only that advertiser's ads are shown/imported. Pasting an exact Ad Library
// page URL (view_all_page_id=…) returns a single advertiser and skips the ambiguity.
import { useState, useMemo } from "react";
import { useRole } from "@/lib/role-context";

const clean = (s) => String(s || "").trim();
const fmtDate = (d) => (d ? String(d).slice(0, 10) : "—");

// The Ad Library needs a 2-letter ISO country code (ES), not a name (Spain). Frameworks
// store either, so normalize: pass-through a 2-letter code, else map a common name.
const COUNTRY_ISO = {
  spain: "ES", "españa": "ES", mexico: "MX", "méxico": "MX", peru: "PE", "perú": "PE",
  colombia: "CO", argentina: "AR", chile: "CL", ecuador: "EC", "united states": "US", usa: "US",
  "estados unidos": "US", "united kingdom": "GB", uk: "GB", france: "FR", francia: "FR",
  germany: "DE", alemania: "DE", italy: "IT", italia: "IT", portugal: "PT", brazil: "BR", brasil: "BR",
  netherlands: "NL", belgium: "BE", ireland: "IE", canada: "CA", "canadá": "CA",
};
const isoCountry = (v) => { const s = clean(v); if (/^[A-Za-z]{2}$/.test(s)) return s.toUpperCase(); return COUNTRY_ISO[s.toLowerCase()] || ""; };

// Serving-platform abbreviations shown on the card → full names.
const PLAT_NAME = { FACEBOOK: "Facebook", INSTAGRAM: "Instagram", MESSENGER: "Messenger", AUDIENCE_NETWORK: "Audience Network", THREADS: "Threads" };

export default function MetaAdsPicker({ projectId, scope = "global", brandId = null, defaultCountry = "", onImported }) {
  const { userEmail, activeOrg } = useRole() || {};

  const [query, setQuery] = useState("");
  const [country, setCountry] = useState(isoCountry(defaultCountry));
  const [destScope, setDestScope] = useState(scope === "local" ? "local" : "global");
  const [ads, setAds] = useState([]);
  const [activeAdv, setActiveAdv] = useState("");
  const [sel, setSel] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [err, setErr] = useState("");
  const [note, setNote] = useState("");
  const [onlyActive, setOnlyActive] = useState(false);
  const [sortBy, setSortBy] = useState("date"); // date | duration

  // Build the actor's input URL. Exact paths (a page): a pasted URL (Facebook page or Ad
  // Library), or a numeric Page ID → view_all_page_id. A plain brand NAME is only best-effort:
  // this actor does a keyword-ish search, so it returns ads that mention the word rather than
  // the brand's page. The advertiser chips below let the analyst pick, but the reliable input
  // is the page URL / Page ID.
  const buildUrl = () => {
    const q = clean(query);
    const c = isoCountry(country) || "ES";
    if (/^https?:\/\//i.test(q)) return q;                       // page URL or Ad Library URL
    if (/^\d{6,}$/.test(q)) return `https://www.facebook.com/ads/library/?active_status=all&ad_type=all&media_type=all&search_type=page&view_all_page_id=${q}&country=${c}`; // Page ID
    return `https://www.facebook.com/ads/library/?active_status=all&ad_type=all&media_type=all&search_type=page&q=${encodeURIComponent(q)}&country=${c}`; // best-effort name
  };

  // Distinct advertisers in the result set, by ad count (desc).
  const advertisers = useMemo(() => {
    const m = new Map();
    for (const a of ads) { const n = a.advertiser_name || "—"; m.set(n, (m.get(n) || 0) + 1); }
    return [...m.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  }, [ads]);

  const visible = useMemo(() => ads.filter((a) => (a.advertiser_name || "—") === activeAdv), [ads, activeAdv]);

  // What the grid actually renders: the active advertiser's ads, optionally active-only, sorted.
  const shown = useMemo(() => {
    let list = onlyActive ? visible.filter((a) => a.is_active) : visible;
    list = [...list].sort(sortBy === "duration"
      ? (a, b) => (b.days_running || 0) - (a.days_running || 0)
      : (a, b) => String(b.start_date || "").slice(0, 10).localeCompare(String(a.start_date || "").slice(0, 10)));
    return list;
  }, [visible, onlyActive, sortBy]);

  const pickAdvertiser = (list, q) => {
    if (!list.length) return "";
    const ql = clean(q).toLowerCase();
    // Prefer the advertiser whose name matches the query; else the most frequent.
    const match = list.find((x) => x.name.toLowerCase().includes(ql)) || list[0];
    return match.name;
  };

  const selectAdvertiser = (name) => {
    setActiveAdv(name);
    setSel(new Set(ads.filter((a) => (a.advertiser_name || "—") === name).map((a) => a.library_id)));
  };

  const search = async () => {
    if (!clean(query) || loading) return;
    setLoading(true); setErr(""); setNote(""); setAds([]); setActiveAdv(""); setSel(new Set());
    try {
      const res = await fetch("/api/ads/meta", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "search", url: buildUrl(), limit: 30, country: isoCountry(country) }),
      });
      const data = await res.json();
      if (data.error) { setErr(data.error); setLoading(false); return; }
      // Newest first — Meta's Ad Library orders by launch date; match it (YYYY-MM-DD sorts chronologically).
      const list = (data.ads || []).slice().sort((a, b) => String(b.start_date || "").slice(0, 10).localeCompare(String(a.start_date || "").slice(0, 10)));
      setAds(list);
      if (list.length) {
        const advs = (() => { const m = new Map(); for (const a of list) { const n = a.advertiser_name || "—"; m.set(n, (m.get(n) || 0) + 1); } return [...m.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count); })();
        const first = pickAdvertiser(advs, query);
        setActiveAdv(first);
        setSel(new Set(list.filter((a) => (a.advertiser_name || "—") === first).map((a) => a.library_id)));
        if (advs.length > 1) setNote(`Se encontraron ${advs.length} anunciantes. Elige el correcto en los chips de arriba.`);
      } else {
        setNote("No se encontraron anuncios. Prueba otra marca, país, o pega la URL de Ad Library de la página (con view_all_page_id).");
      }
    } catch (e) { setErr(`No se pudo buscar — ${e.message || "error de red"}.`); }
    setLoading(false);
  };

  const toggle = (id) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const importSel = async () => {
    const chosen = shown.filter((a) => sel.has(a.library_id));
    if (!chosen.length || importing) return;
    setImporting(true); setErr(""); setNote("");
    try {
      const res = await fetch("/api/ads/meta", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "import", project_id: projectId, scope: destScope, brand_id: brandId,
          organization_id: activeOrg?.id || null, created_by: userEmail || "",
          country: isoCountry(country), ads: chosen,
        }),
      });
      const data = await res.json();
      if (data.error) { setErr(data.error); setImporting(false); return; }
      setNote(`${data.imported} importado${data.imported === 1 ? "" : "s"}${data.skipped ? ` · ${data.skipped} omitido${data.skipped === 1 ? "" : "s"} (duplicado)` : ""}`);
      onImported?.(data.imported);
      if (data.imported) setSel(new Set());
    } catch (e) { setErr(`No se pudo importar — ${e.message || "error de red"}.`); }
    setImporting(false);
  };

  const selVisible = shown.filter((a) => sel.has(a.library_id)).length;

  return (
    <div>
      {/* Search row */}
      <label className="text-[10px] font-mono uppercase tracking-[0.14em] text-hint block mb-1.5">Marca o URL de Ad Library</label>
      <div className="flex gap-2.5 items-center flex-wrap">
        <input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") search(); }}
          placeholder="Pega la URL / Page ID de la página, o el nombre de la marca…"
          className="flex-1 min-w-[240px] px-3 py-2.5 bg-surface border border-main rounded-lg text-sm text-main focus:outline-none focus:border-[var(--accent)]" />
        <input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="País (ES)"
          className="w-[110px] px-3 py-2.5 bg-surface border border-main rounded-lg text-sm text-main focus:outline-none focus:border-[var(--accent)]" title="País: código ISO de 2 letras (ES, MX, PE…) o nombre (Spain)" />
        <button onClick={search} disabled={loading} className="gw-ember-btn inline-flex items-center gap-2 bg-[var(--accent-ember)] text-white rounded-lg px-4 py-2.5 text-sm font-semibold disabled:opacity-60 whitespace-nowrap">
          {loading ? <><svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="30 70" strokeLinecap="round" /></svg>Buscando…</> : "Buscar anuncios"}
        </button>
      </div>
      <p className="text-[11px] text-hint mt-1.5">Publicidad pagada · corre el Ad Library de Meta (≈$0.17 por búsqueda). <b>Para la marca exacta</b>, pega la URL de su página (<code>facebook.com/marca</code>) o de su Ad Library (<code>view_all_page_id=…</code>), o su Page ID. El nombre suelto es aproximado (el scraper busca por palabra).</p>

      {err && <div className="mt-3 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{err}</div>}
      {note && <div className="mt-3 text-xs text-[var(--accent-ember-deep)] bg-[#fdf6f2] border border-[var(--accent-ember-tint)] rounded-lg px-3 py-2">{note}</div>}

      {/* Advertiser filter chips */}
      {advertisers.length > 0 && (
        <div className="flex items-center gap-2 mt-4 flex-wrap">
          <span className="text-[9px] font-mono uppercase tracking-[0.14em] text-hint">Anunciante:</span>
          {advertisers.map((adv) => {
            const on = adv.name === activeAdv;
            return (
              <button key={adv.name} onClick={() => selectAdvertiser(adv.name)}
                className={`text-[11px] px-2.5 py-1 rounded-full border transition ${on ? "bg-[var(--ink-800,#1a1a1a)] text-white border-[var(--ink-800,#1a1a1a)]" : "text-muted border-[var(--border)] hover:text-main"}`}>
                {adv.name} <span className="opacity-60">· {adv.count}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Results (only the active advertiser) */}
      {visible.length > 0 && (
        <>
          <div className="flex items-center gap-3 mt-4 mb-3 flex-wrap">
            <span className="text-[9px] tracking-[0.16em] text-hint uppercase font-mono">{shown.length} anuncios de {activeAdv} · {selVisible} seleccionados</span>
            <label className="inline-flex items-center gap-1.5 text-[10px] text-muted cursor-pointer">
              <input type="checkbox" checked={onlyActive} onChange={(e) => setOnlyActive(e.target.checked)} className="accent-[var(--accent-ember)]" />Solo activos
            </label>
            <span className="inline-flex items-center gap-1.5">
              <span className="text-[9px] font-mono uppercase tracking-[0.12em] text-hint">Orden:</span>
              {[["date", "Fecha"], ["duration", "Tiempo activo"]].map(([v, l]) => (
                <button key={v} onClick={() => setSortBy(v)} className={`text-[10px] px-2 py-0.5 rounded-full border transition ${sortBy === v ? "bg-[var(--ink-800,#1a1a1a)] text-white border-[var(--ink-800,#1a1a1a)]" : "text-muted border-[var(--border)] hover:text-main"}`}>{l}</button>
              ))}
            </span>
            <span className="inline-flex items-center gap-1.5 ml-1">
              <span className="text-[9px] font-mono uppercase tracking-[0.12em] text-hint">Destino:</span>
              {[["local", "Local audit"], ["global", "Global benchmarks"]].map(([v, l]) => (
                <button key={v} onClick={() => setDestScope(v)} className={`text-[10px] px-2 py-0.5 rounded-full border transition ${destScope === v ? "bg-[var(--ink-800,#1a1a1a)] text-white border-[var(--ink-800,#1a1a1a)]" : "text-muted border-[var(--border)] hover:text-main"}`}>{l}</button>
              ))}
            </span>
            <button onClick={() => setSel(selVisible === shown.length ? new Set() : new Set(shown.map((a) => a.library_id)))} className="text-[11px] text-muted hover:text-main underline">
              {selVisible === shown.length ? "Ninguno" : "Todos"}
            </button>
            <button onClick={importSel} disabled={importing || !selVisible}
              className="ml-auto inline-flex items-center gap-2 bg-[var(--ink-800,#1a1a1a)] text-white rounded-lg px-4 py-2 text-xs font-semibold disabled:opacity-50 whitespace-nowrap">
              {importing ? "Importando…" : `Importar ${selVisible} como entries`}
            </button>
          </div>
          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(230px,1fr))" }}>
            {shown.map((a) => {
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
                    <span className={`absolute bottom-2 left-2 text-[8px] font-mono uppercase px-1.5 py-0.5 rounded text-white ${a.is_active ? "bg-green-600" : "bg-[#8a8a8a]"}`}>{a.is_active ? "Activo" : "Inactivo"}</span>
                  </div>
                  <div className="p-2.5">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-[10px] font-semibold text-main truncate">{a.advertiser_name}</span>
                      <span className="ml-auto text-[9px] text-hint whitespace-nowrap">{a.days_running != null ? `${a.days_running}d` : ""}{a.variant_count > 1 ? ` · ${a.variant_count}v` : ""}</span>
                    </div>
                    <p className="text-[11px] text-muted leading-snug line-clamp-2 min-h-[28px]">{a.ad_text || a.title || "—"}</p>
                    <div className="flex items-center gap-1 mt-2 flex-wrap">
                      {(a.serving_platforms || []).slice(0, 4).map((p) => <span key={p} title={PLAT_NAME[p] || p} className="text-[8px] font-mono uppercase text-hint bg-surface2 rounded px-1 py-0.5">{p.slice(0, 2)}</span>)}
                      <span className="ml-auto text-[8.5px] text-hint whitespace-nowrap" title={`${fmtDate(a.start_date)} → ${a.is_active ? "activo" : fmtDate(a.end_date)}`}>{fmtDate(a.start_date)} → {a.is_active ? "hoy" : fmtDate(a.end_date)}</span>
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
