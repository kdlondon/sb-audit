"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase";

const proxied = (u) => (u ? `/api/social/thumb?u=${encodeURIComponent(u)}` : "");

const KIND_BADGE = {
  reel: "🎬 Reel", carousel: "🖼 Carrusel", post: "🖼 Post",
  video: "🎬 Vídeo", slideshow: "🖼 Slideshow",
};

const PLATFORM_META = {
  instagram: { label: "Instagram", placeholder: "@competidor.oficial  o  instagram.com/competidor" },
  tiktok: { label: "TikTok", placeholder: "@competidor  o  tiktok.com/@competidor" },
};

function timeAgo(ts) {
  if (!ts) return "";
  const d = new Date(ts).getTime();
  if (!d) return "";
  const days = Math.floor((Date.now() - d) / 86400000);
  if (days <= 0) return "hoy";
  if (days === 1) return "ayer";
  if (days < 30) return `hace ${days} d`;
  if (days < 365) return `hace ${Math.floor(days / 30)} m`;
  return `hace ${Math.floor(days / 365)} a`;
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
          const owner = p.owner || handle.replace(/^@/, "").trim();
          const caption = p.caption || "";
          const entry = {
            id: `${Date.now()}_${my}_${Math.random().toString(36).slice(2, 5)}`,
            project_id: projectId,
            scope,
            type: "Social post",
            url: p.url,
            brand_name: owner,
            description: "",
            synopsis: caption,
            image_url: meta?.thumbnail || "",
            transcript: meta?.transcript || "",
            year: p.year || "",
            country: defaultCountry || "",
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
                posted_at: p.timestamp || "",
                hashtags: p.hashtags || [],
              },
            },
          };
          if (scope === "global") entry.brand = owner; else entry.competitor = owner;
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

      {/* Handle input */}
      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <label className="block text-[10px] text-muted uppercase font-semibold mb-0.5">Perfil de {PLATFORM_META[platform]?.label || platform}</label>
          <input
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && fetchFeed()}
            placeholder={PLATFORM_META[platform]?.placeholder || "@perfil"}
            className="w-full px-3 py-2 bg-surface2 border border-main rounded-lg text-sm text-main"
          />
        </div>
        <select value={limit} onChange={(e) => setLimit(Number(e.target.value))}
          className="px-2 py-2 bg-surface2 border border-main rounded-lg text-sm text-main">
          {[6, 12, 24, 48].map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        <button onClick={fetchFeed} disabled={loading || !handle.trim()}
          className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50">
          {loading ? "Cargando…" : "Traer feed"}
        </button>
      </div>

      {error && <div className="text-xs text-red-500 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{error}</div>}
      {loading && <div className="text-xs text-accent animate-pulse">Trayendo los últimos posts del perfil… (puede tardar ~15–30s)</div>}

      {posts.length > 0 && (
        <>
          {/* Toolbar */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex gap-1 flex-wrap">
              <button onClick={() => setFilterKind("all")}
                className={`px-2 py-1 rounded text-[11px] font-medium ${filterKind === "all" ? "bg-accent text-white" : "bg-surface2 text-muted hover:text-main"}`}>Todos</button>
              {kinds.map((k) => (
                <button key={k} onClick={() => setFilterKind(k)}
                  className={`px-2 py-1 rounded text-[11px] font-medium ${filterKind === k ? "bg-accent text-white" : "bg-surface2 text-muted hover:text-main"}`}>
                  {KIND_BADGE[k] || k}
                </button>
              ))}
            </div>
            <button onClick={toggleAll} className="text-[11px] text-accent hover:underline">
              {allSelected ? "Deseleccionar todo" : "Seleccionar todo"}
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
                      : <div className="w-full h-full flex items-center justify-center text-hint text-xs">sin imagen</div>}
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
            <span className="text-xs text-muted">{selected.size} seleccionado{selected.size === 1 ? "" : "s"}</span>
            <button onClick={importSelected} disabled={importing || selected.size === 0}
              className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50">
              {importing
                ? `Importando ${progress.done}/${progress.total}…`
                : `Importar ${selected.size || ""} como entries →`}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
