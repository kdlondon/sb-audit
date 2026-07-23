"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase";
import { useFramework } from "@/lib/framework-context";

const COUNTRIES = ["Spain", "Argentina", "Chile", "Peru", "Colombia", "Mexico", "Ecuador", "Venezuela", "Brazil", "United States", "United Kingdom", "France", "Italy", "Germany", "Portugal"];

const proxied = (u) => (u ? `/api/social/thumb?u=${encodeURIComponent(u)}` : "");

// Redesign console label (mono, uppercase, wide tracking)
const SFP_LABEL = { display: "block", fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 9 };

const KIND_BADGE = {
  reel: "🎬 Reel", carousel: "🖼 Carousel", post: "🖼 Post",
  video: "🎬 Video", slideshow: "🖼 Slideshow",
};

const PLATFORM_META = {
  instagram: { label: "Instagram", placeholder: "@competitor.official  or  instagram.com/competitor" },
  tiktok: { label: "TikTok", placeholder: "@competitor  or  tiktok.com/@competitor" },
};

function timeAgo(ts) {
  if (!ts) return "";
  const d = new Date(ts).getTime();
  if (!d) return "";
  const days = Math.floor((Date.now() - d) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

// Browse a competitor's social feed (Instagram / TikTok) and bulk-import selected
// pieces as audit entries. Shared by Audit (Social tab) and Scout. Project-scoped,
// framework-aware defaults.
export default function SocialFeedPicker({
  platforms = ["instagram", "tiktok"],
  projectId,
  scope = "local",
  defaultCountry = "",
  defaultCategory = "",
  defaultSubCategory = "",
  onImported,
}) {
  const { framework } = useFramework() || {};
  const [pScope, setPScope] = useState(scope);
  const [pBrand, setPBrand] = useState("");
  const [pCountry, setPCountry] = useState(defaultCountry || framework?.primaryMarket || "");
  // Local scope includes the PRINCIPAL brand (the study subject) ahead of competitors.
  const principalName = framework?.principalBrand?.name || framework?.brandName || "";
  const brandOptions = pScope === "global"
    ? (framework?.globalBenchmarks || [])
    : [
        ...(principalName && !(framework?.localCompetitors || []).some(c => c?.name === principalName) ? [{ name: principalName }] : []),
        ...(framework?.localCompetitors || []),
      ];
  const [platform, setPlatform] = useState(platforms[0]);
  const [handle, setHandle] = useState("");
  const [limit, setLimit] = useState(12);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(new Set());
  const [filterKind, setFilterKind] = useState("all");
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  const reset = () => { setPosts([]); setSelected(new Set()); setError(""); setFilterKind("all"); };
  const switchPlatform = (p) => { if (p === platform) return; setPlatform(p); setHandle(""); reset(); };

  const fetchFeed = async () => {
    if (!handle.trim() || loading) return;
    setLoading(true); reset();
    try {
      const res = await fetch("/api/social/feed", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform, handle, limit }),
      });
      const d = await res.json();
      if (d.error) setError(d.error);
      else setPosts(d.posts || []);
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  const toggle = (url) => setSelected((prev) => {
    const n = new Set(prev); n.has(url) ? n.delete(url) : n.add(url); return n;
  });

  const kinds = [...new Set(posts.map((p) => p.kind))];
  const visible = posts.filter((p) => filterKind === "all" || p.kind === filterKind);
  const allSelected = visible.length > 0 && visible.every((p) => selected.has(p.url));
  const toggleAll = () => setSelected((prev) => {
    const n = new Set(prev);
    if (allSelected) visible.forEach((p) => n.delete(p.url));
    else visible.forEach((p) => n.add(p.url));
    return n;
  });

  const importSelected = async () => {
    const chosen = posts.filter((p) => selected.has(p.url));
    if (!chosen.length || importing) return;
    setImporting(true); setProgress({ done: 0, total: chosen.length });
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    const email = session?.user?.email || "";

    let imported = 0;
    let idx = 0;
    const CONC = 3;
    const worker = async () => {
      while (idx < chosen.length) {
        const my = idx++;
        const p = chosen[my];
        try {
          const res = await fetch("/api/social/import", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ platform, url: p.url, thumbnail: p.thumbnail, kind: p.kind }),
          });
          const meta = await res.json().catch(() => ({}));
          const owner = pBrand || p.owner || handle.replace(/^@/, "").trim();
          const caption = p.caption || "";
          const entry = {
            id: `${Date.now()}_${my}_${Math.random().toString(36).slice(2, 5)}`,
            project_id: projectId,
            scope: pScope,
            type: "Social post",
            url: p.url,
            brand_name: owner,
            description: "",
            synopsis: caption,
            image_url: meta?.thumbnail || "",
            transcript: meta?.transcript || "",
            year: p.year || "",
            country: pCountry || "",
            category: defaultCategory || "",
            sub_category: defaultSubCategory || "",
            created_by: email,
            brand_id: null,
            organization_id: null,
            updated_at: new Date().toISOString(),
            // Namespaced under "_" keys so the framework's dynamic-dimension renderer skips them.
            custom_dimensions: {
              _social: {
                format: p.kind || "",
                platform: ({ instagram: "Instagram", tiktok: "TikTok", facebook: "Facebook", linkedin: "LinkedIn", youtube: "YouTube" }[platform] || ""),
              },
              _meta: {
                platform,
                caption,
                likes: p.likes ?? null,
                comments: p.comments ?? null,
                views: p.views ?? null,
                followers: p.followers ?? null,   // profile follower count → engagement RATE
                posted_at: p.timestamp || "",
                hashtags: p.hashtags || [],
              },
            },
          };
          if (pScope === "global") entry.brand = owner; else entry.competitor = owner;
          const { error } = await supabase.from("creative_source").insert(entry);
          if (!error) imported++;
        } catch {}
        setProgress((prev) => ({ ...prev, done: prev.done + 1 }));
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONC, chosen.length) }, worker));
    setImporting(false);
    setSelected(new Set());
    if (onImported) onImported(imported);
  };

  return (
    <div className="space-y-3">
      {/* Scope + brand + country — entries import with the REAL brand/scope/country */}
      <div className="flex flex-wrap items-end gap-2 pb-3 border-b border-main">
        <div>
          <label className="block text-[9px] text-hint uppercase font-semibold mb-0.5">Scope</label>
          <div className="flex bg-surface2 rounded-lg p-0.5">
            {[["local", "Local"], ["global", "Global"]].map(([s, l]) => (
              <button key={s} onClick={() => { setPScope(s); setPBrand(""); }} className={`px-3 py-1 rounded-md text-xs font-medium transition ${pScope === s ? "bg-surface text-accent shadow-sm" : "text-muted"}`}>{l}</button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-[9px] text-hint uppercase font-semibold mb-0.5">Brand</label>
          <select value={pBrand} onChange={(e) => setPBrand(e.target.value)} className="px-2 py-1.5 bg-surface2 border border-main rounded text-sm text-main min-w-[150px]">
            <option value="">— Select brand —</option>
            {brandOptions.map((b) => <option key={b.name} value={b.name}>{b.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[9px] text-hint uppercase font-semibold mb-0.5">Country</label>
          <input list="sfp-countries" value={pCountry} onChange={(e) => setPCountry(e.target.value)} placeholder="Country" className="px-2 py-1.5 bg-surface2 border border-main rounded text-sm text-main w-[130px]" />
          <datalist id="sfp-countries">{COUNTRIES.map((c) => <option key={c} value={c} />)}</datalist>
        </div>
      </div>
      {/* Platform tabs */}
      {platforms.length > 1 && (
        <div className="flex bg-surface2 rounded-lg p-0.5 w-fit">
          {platforms.map((p) => (
            <button key={p} onClick={() => switchPlatform(p)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition ${platform === p ? "bg-surface text-accent shadow-sm" : "text-muted"}`}>
              {PLATFORM_META[p]?.label || p}
            </button>
          ))}
        </div>
      )}

      {/* Handle input (redesign console: OPTION → ACTION) */}
      <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <label style={SFP_LABEL}>{PLATFORM_META[platform]?.label || platform} handle</label>
          <div style={{ display: "flex", alignItems: "center", background: "var(--paper)", border: "1px solid var(--border-strong)", borderRadius: 9, padding: "0 13px" }}>
            <span style={{ fontFamily: "var(--font-body)", fontSize: 15, color: "var(--text-muted)", flex: "none" }}>@</span>
            <input
              value={handle.replace(/^@/, "")}
              onChange={(e) => setHandle(e.target.value.replace(/^@/, ""))}
              onKeyDown={(e) => e.key === "Enter" && fetchFeed()}
              placeholder={(PLATFORM_META[platform]?.placeholder || "@profile").replace(/^@/, "")}
              style={{ flex: 1, minWidth: 0, background: "transparent", border: "none", outline: "none", padding: "11px 0 11px 3px", fontFamily: "var(--font-body)", fontSize: 15, color: "var(--ink-900)" }}
            />
          </div>
        </div>
        <div style={{ flex: "none" }}>
          <label style={SFP_LABEL}>Posts to fetch</label>
          <input
            type="number" min={1} max={50} value={limit}
            onChange={(e) => { const n = Number(e.target.value); setLimit(Number.isFinite(n) ? Math.max(1, Math.min(50, n)) : 12); }}
            style={{ width: 88, textAlign: "center", background: "var(--paper)", border: "1px solid var(--border-strong)", borderRadius: 9, padding: "11px 8px", fontFamily: "var(--font-numeral)", fontSize: 15, color: "var(--ink-900)", outline: "none" }}
          />
        </div>
        <button onClick={fetchFeed} disabled={loading || !handle.trim()} className="gw-ember-btn"
          style={{ flex: "none", display: "flex", alignItems: "center", gap: 8, background: "var(--accent-ember-deep)", color: "#fff", border: "none", borderRadius: 9, padding: "11px 18px", fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 700, cursor: "pointer", opacity: (loading || !handle.trim()) ? 0.4 : 1 }}>
          {loading ? "Fetching…" : "Fetch feed"}
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h13M13 6l6 6-6 6" /></svg>
        </button>
      </div>

      {error && <div className="text-xs text-red-500 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{error}</div>}
      {loading && <div className="text-xs text-accent animate-pulse">Fetching the profile's latest posts… (may take ~15–30s)</div>}

      {posts.length > 0 && (
        <>
          {/* Toolbar */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex gap-1 flex-wrap">
              <button onClick={() => setFilterKind("all")}
                className={`px-2 py-1 rounded text-[11px] font-medium ${filterKind === "all" ? "bg-accent text-white" : "bg-surface2 text-muted hover:text-main"}`}>All</button>
              {kinds.map((k) => (
                <button key={k} onClick={() => setFilterKind(k)}
                  className={`px-2 py-1 rounded text-[11px] font-medium ${filterKind === k ? "bg-accent text-white" : "bg-surface2 text-muted hover:text-main"}`}>
                  {KIND_BADGE[k] || k}
                </button>
              ))}
            </div>
            <button onClick={toggleAll} className="text-[11px] text-accent hover:underline">
              {allSelected ? "Deselect all" : "Select all"}
            </button>
          </div>

          {/* Grid */}
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-[420px] overflow-auto pr-1">
            {visible.map((p) => {
              const sel = selected.has(p.url);
              return (
                <button key={p.url} onClick={() => toggle(p.url)}
                  className={`relative text-left rounded-lg overflow-hidden border-2 transition ${sel ? "border-accent" : "border-transparent hover:border-main"}`}>
                  <div className="aspect-square bg-surface2 overflow-hidden">
                    {p.thumbnail
                      ? <img src={proxied(p.thumbnail)} alt="" loading="lazy" className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center text-hint text-xs">no image</div>}
                  </div>
                  <div className="absolute top-1 left-1 text-[9px] bg-black/60 text-white px-1.5 py-0.5 rounded">{KIND_BADGE[p.kind] || p.kind}</div>
                  <div className={`absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center text-[11px] ${sel ? "bg-accent text-white" : "bg-black/50 text-white/80"}`}>{sel ? "✓" : ""}</div>
                  <div className="p-1.5">
                    <div className="text-[10px] text-main line-clamp-2 leading-tight">{p.caption ? p.caption.split("\n")[0] : "—"}</div>
                    <div className="text-[9px] text-hint mt-0.5 flex gap-2">
                      {p.likes != null && <span>❤ {p.likes.toLocaleString()}</span>}
                      <span>{timeAgo(p.timestamp)}</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Import bar */}
          <div className="flex items-center justify-between gap-3 pt-1 border-t border-main">
            <span className="text-xs text-muted">{selected.size} selected</span>
            <button onClick={importSelected} disabled={importing || selected.size === 0}
              className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50">
              {importing
                ? `Importing ${progress.done}/${progress.total}…`
                : `Import ${selected.size || ""} as entries →`}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
