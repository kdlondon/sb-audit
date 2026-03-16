"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase";
import { useProject } from "@/lib/project-context";
import { useRole } from "@/lib/role-context";
import { useRouter } from "next/navigation";
import Nav from "@/components/Nav";
import AuthGuard from "@/components/AuthGuard";
import ProjectGuard from "@/components/ProjectGuard";

const REGION_CODES = [
  { code: "", label: "All regions" },
  { code: "US", label: "United States" }, { code: "CA", label: "Canada" },
  { code: "GB", label: "United Kingdom" }, { code: "AU", label: "Australia" },
  { code: "DE", label: "Germany" }, { code: "FR", label: "France" },
  { code: "ES", label: "Spain" }, { code: "MX", label: "Mexico" },
  { code: "BR", label: "Brazil" }, { code: "JP", label: "Japan" },
  { code: "IN", label: "India" }, { code: "IT", label: "Italy" },
  { code: "NL", label: "Netherlands" }, { code: "SE", label: "Sweden" },
  { code: "CH", label: "Switzerland" }, { code: "NZ", label: "New Zealand" },
];

const TIMEFRAMES = [
  { label: "Last 30 days", days: 30 }, { label: "Last 90 days", days: 90 },
  { label: "Last 6 months", days: 180 }, { label: "Last year", days: 365 },
  { label: "Last 2 years", days: 730 }, { label: "All time", days: 0 },
];

function formatViews(n) {
  if (!n) return "—";
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(0) + "K";
  return String(n);
}

function formatDuration(iso) {
  if (!iso) return "";
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return "";
  const h = m[1] ? m[1] + ":" : "";
  const min = (m[2] || "0").padStart(h ? 2 : 1, "0");
  const sec = (m[3] || "0").padStart(2, "0");
  return `${h}${min}:${sec}`;
}

function ScoreBadge({ score }) {
  const color = score >= 8 ? "#059669" : score >= 5 ? "#d97706" : "#dc2626";
  const bg = score >= 8 ? "#ecfdf5" : score >= 5 ? "#fffbeb" : "#fef2f2";
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold"
      style={{ color, background: bg, border: `1px solid ${color}22` }}>
      {score}/10
    </span>
  );
}

/* ─── VIDEO PREVIEW MODAL ─── */
function VideoPreview({ videoId, title, onClose }) {
  if (!videoId) return null;
  return (
    <div className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center" onClick={onClose}>
      <button className="absolute top-5 right-5 text-white/60 hover:text-white text-3xl w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 transition" onClick={onClose}>×</button>
      <div className="w-[85vw] max-w-[1000px]" onClick={e => e.stopPropagation()}>
        <iframe width="100%" style={{ aspectRatio: "16/9" }} src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`}
          frameBorder="0" allowFullScreen allow="autoplay; encrypted-media" className="rounded-xl" />
        {title && <p className="text-white/70 text-sm mt-3 text-center">{title}</p>}
      </div>
    </div>
  );
}

const CONTENT_TYPES = [
  { value: "official", label: "Official content", hint: "Ads, campaigns, brand videos" },
  { value: "all", label: "All content", hint: "Everything including commentary, tutorials" },
];

export default function ScoutPage() {
  const { projectId, projectName } = useProject();
  const { role } = useRole();
  const router = useRouter();
  const supabase = createClient();

  // Search form
  const [brand, setBrand] = useState("");
  const [keywords, setKeywords] = useState("");
  const [category, setCategory] = useState("");
  const [region, setRegion] = useState("");
  const [timeframe, setTimeframe] = useState(365);
  const [maxResults, setMaxResults] = useState(15);
  const [contentType, setContentType] = useState("official");

  // Preview
  const [preview, setPreview] = useState(null); // { videoId, title }
  // Per-video settings (transcript + scope)
  const [transcripts, setTranscripts] = useState({}); // { videoId: "text" }
  const [videoScopes, setVideoScopes] = useState({}); // { videoId: "local"|"global" }

  // Results
  const [videos, setVideos] = useState([]);
  const [searching, setSearching] = useState(false);
  const [ranking, setRanking] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [minScore, setMinScore] = useState(0);

  // Import
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0, label: "" });
  const [importDone, setImportDone] = useState(false);
  const [importCount, setImportCount] = useState(0);
  const [autoAnalyze, setAutoAnalyze] = useState(true);
  const [scope, setScope] = useState("global");

  // Toast
  const [toast, setToast] = useState("");
  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 4000); };

  // Existing URLs for duplicate detection
  const [existingUrls, setExistingUrls] = useState(new Set());
  useEffect(() => {
    if (!projectId) return;
    (async () => {
      const table = scope === "global" ? "audit_global" : "audit_entries";
      const { data } = await supabase.from(table).select("url").eq("project_id", projectId);
      setExistingUrls(new Set((data || []).map(e => e.url).filter(Boolean)));
    })();
  }, [projectId, scope]);

  // ─── SEARCH ───
  const handleSearch = async () => {
    if (!brand.trim() && !keywords.trim() && !category.trim()) { showToast("Enter a brand, category, or keywords"); return; }
    setSearching(true);
    setVideos([]);
    setSelected(new Set());
    setImportDone(false);

    // Build query with strict keyword matching
    const parts = [];
    if (brand.trim()) parts.push(brand.trim());
    if (category.trim()) parts.push(`"${category.trim()}"`); // exact match
    if (keywords.trim()) {
      // Wrap multi-word keywords in quotes for exact matching
      keywords.split(",").map(k => k.trim()).filter(Boolean).forEach(k => {
        parts.push(k.includes(" ") ? `"${k}"` : k);
      });
    }
    if (contentType === "official") parts.push("official ad commercial");
    const query = parts.join(" ");
    const publishedAfter = timeframe > 0 ? new Date(Date.now() - timeframe * 86400000).toISOString() : undefined;

    try {
      const res = await fetch("/api/youtube-scout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "search", query, maxResults, publishedAfter, regionCode: region || undefined }),
      });
      const data = await res.json();
      if (data.error) { showToast("Error: " + data.error); setSearching(false); return; }

      let vids = data.videos || [];
      setVideos(vids.map(v => ({ ...v, score: null, reason: "" })));
      setSearching(false);

      // Now rank with AI
      if (vids.length > 0) {
        setRanking(true);
        const market = REGION_CODES.find(r => r.code === region)?.label || "";
        const rankRes = await fetch("/api/youtube-scout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "rank", brand: brand || category, keywords: keywords || category, market, videos: vids }),
        });
        const rankData = await rankRes.json();
        const rankings = rankData.rankings || [];

        setVideos(prev => {
          const updated = [...prev];
          rankings.forEach(r => {
            const idx = (r.index || r.videoIndex || 0) - 1;
            if (idx >= 0 && idx < updated.length) {
              updated[idx] = { ...updated[idx], score: r.score, reason: r.reason || r.rationale || "" };
            }
          });
          // Sort by score descending
          return updated.sort((a, b) => (b.score || 0) - (a.score || 0));
        });
        setRanking(false);
      }
    } catch (err) {
      showToast("Search failed: " + err.message);
      setSearching(false);
    }
  };

  // ─── IMPORT ───
  const handleImport = async () => {
    const toImport = videos.filter(v => selected.has(v.videoId));
    if (toImport.length === 0) return;

    setImporting(true);
    setImportProgress({ current: 0, total: toImport.length, label: "" });
    const { data: { session } } = await supabase.auth.getSession();
    let imported = 0;

    for (let i = 0; i < toImport.length; i++) {
      const v = toImport[i];
      // Per-video scope (falls back to global scope selector)
      const vidScope = videoScopes[v.videoId] || scope;
      const table = vidScope === "global" ? "audit_global" : "audit_entries";

      setImportProgress({ current: i + 1, total: toImport.length, label: `Processing: ${v.title.slice(0, 40)}...` });

      // Use user-provided transcript or try auto-fetch
      let transcript = transcripts[v.videoId] || "";
      if (!transcript) {
        setImportProgress({ current: i + 1, total: toImport.length, label: `Fetching transcript: ${v.title.slice(0, 40)}...` });
        try {
          const tRes = await fetch("/api/youtube-scout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "transcript", videoId: v.videoId }),
          });
          const tData = await tRes.json();
          transcript = tData.transcript || "";
        } catch {}
      }

      // Build entry
      const entry = {
        id: String(Date.now()) + "_" + i,
        project_id: projectId,
        created_by: session?.user?.email || "",
        updated_at: new Date().toISOString(),
        url: `https://www.youtube.com/watch?v=${v.videoId}`,
        image_url: v.thumbnail,
        description: v.title,
        year: v.year || "",
        type: "Video",
        synopsis: v.description || "",
        transcript,
      };

      if (vidScope === "global") {
        entry.brand = v.channel || "";
        entry.country = REGION_CODES.find(r => r.code === region)?.label || "";
      } else {
        entry.competitor = v.channel || "";
      }

      // Insert
      const { error } = await supabase.from(table).insert(entry);
      if (error) { console.error("Insert error:", error); continue; }
      imported++;

      // Auto-analyze with AI
      if (autoAnalyze && (v.thumbnail || transcript)) {
        setImportProgress({ current: i + 1, total: toImport.length, label: `AI analyzing: ${v.title.slice(0, 40)}...` });
        try {
          const analyzeRes = await fetch("/api/analyze", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              imageUrl: v.thumbnail,
              context: [
                `Brand: ${v.channel || ""}`,
                transcript ? `Transcript: ${transcript.slice(0, 1500)}` : "",
              ].filter(Boolean).join("\n"),
            }),
          });
          const analysis = await analyzeRes.json();
          if (analysis.success && analysis.analysis) {
            // Update the entry with AI-generated fields
            const updates = {};
            const a = analysis.analysis;
            const fields = ["insight", "idea", "primary_territory", "secondary_territory",
              "synopsis", "communication_intent", "entry_door", "experience_reflected", "portrait", "richness_definition",
              "journey_phase", "client_lifecycle", "moment_acquisition", "moment_deepening",
              "moment_unexpected", "bank_role", "pain_point_type", "pain_point",
              "language_register", "main_vp", "brand_attributes", "emotional_benefit",
              "rational_benefit", "r2b", "channel", "cta", "tone_of_voice", "representation",
              "industry_shown", "business_size", "brand_archetype", "diff_claim",
              "execution_style", "main_slogan", "rating", "funnel"];
            fields.forEach(f => { if (a[f]) updates[f] = a[f]; });
            if (Object.keys(updates).length > 0) {
              await supabase.from(table).update(updates).eq("id", entry.id);
            }
          }
        } catch {}
      }
    }

    setImporting(false);
    setImportCount(imported);
    setImportDone(true);
    showToast(`✓ ${imported} entries imported`);
  };

  // ─── TOGGLE ───
  const toggleSelect = (videoId) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(videoId)) next.delete(videoId); else next.add(videoId);
      return next;
    });
  };

  const selectAll = () => {
    const filtered = videos.filter(v => (v.score || 0) >= minScore);
    setSelected(new Set(filtered.map(v => v.videoId)));
  };

  const filteredVideos = minScore > 0 ? videos.filter(v => (v.score || 0) >= minScore) : videos;

  // ─── RENDER ───
  return (
    <AuthGuard><ProjectGuard><Nav />
      <div className="min-h-screen" style={{ background: "var(--bg)" }}>
        {toast && <div className="fixed top-4 right-4 bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium z-50 shadow-lg">{toast}</div>}
        {preview && <VideoPreview videoId={preview.videoId} title={preview.title} onClose={() => setPreview(null)} />}

        <div className="max-w-5xl mx-auto p-6">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-xl font-bold text-main">YouTube Scout</h1>
            <p className="text-xs text-muted mt-1">Search, discover, and import competitive content automatically</p>
          </div>

          {/* Search Form */}
          <div className="bg-surface border border-main rounded-xl p-6 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-[10px] text-muted uppercase font-semibold mb-1">Brand / Company <span className="text-hint font-normal">(optional)</span></label>
                <input value={brand} onChange={e => setBrand(e.target.value)} placeholder="E.g., Starling Bank"
                  className="w-full px-3 py-2 bg-surface border border-main rounded-lg text-sm text-main focus:outline-none focus:border-[var(--accent)]"
                  onKeyDown={e => e.key === "Enter" && handleSearch()} />
              </div>
              <div>
                <label className="block text-[10px] text-muted uppercase font-semibold mb-1">Category / Industry <span className="text-hint font-normal">(optional)</span></label>
                <input value={category} onChange={e => setCategory(e.target.value)} placeholder="E.g., business banking, fintech, insurance"
                  className="w-full px-3 py-2 bg-surface border border-main rounded-lg text-sm text-main focus:outline-none focus:border-[var(--accent)]"
                  onKeyDown={e => e.key === "Enter" && handleSearch()} />
              </div>
              <div>
                <label className="block text-[10px] text-muted uppercase font-semibold mb-1">Keywords <span className="text-hint font-normal">(comma-separated, strict match)</span></label>
                <input value={keywords} onChange={e => setKeywords(e.target.value)} placeholder="E.g., business banking, SME, entrepreneur"
                  className="w-full px-3 py-2 bg-surface border border-main rounded-lg text-sm text-main focus:outline-none focus:border-[var(--accent)]"
                  onKeyDown={e => e.key === "Enter" && handleSearch()} />
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div>
                <label className="block text-[10px] text-muted uppercase font-semibold mb-1">Market</label>
                <select value={region} onChange={e => setRegion(e.target.value)}
                  className="w-full px-3 py-2 bg-surface border border-main rounded-lg text-sm text-main">
                  {REGION_CODES.map(r => <option key={r.code} value={r.code}>{r.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-muted uppercase font-semibold mb-1">Timeframe</label>
                <select value={timeframe} onChange={e => setTimeframe(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-surface border border-main rounded-lg text-sm text-main">
                  {TIMEFRAMES.map(t => <option key={t.days} value={t.days}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-muted uppercase font-semibold mb-1">Max results</label>
                <select value={maxResults} onChange={e => setMaxResults(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-surface border border-main rounded-lg text-sm text-main">
                  {[10, 15, 20, 30, 50].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-muted uppercase font-semibold mb-1">Import to</label>
                <select value={scope} onChange={e => setScope(e.target.value)}
                  className="w-full px-3 py-2 bg-surface border border-main rounded-lg text-sm text-main">
                  <option value="global">Global benchmarks</option>
                  <option value="local">Local audit</option>
                </select>
              </div>
            </div>

            {/* Content type */}
            <div className="flex items-center gap-4 mb-4">
              <label className="text-[10px] text-muted uppercase font-semibold">Content type:</label>
              <div className="flex gap-2">
                {CONTENT_TYPES.map(ct => (
                  <button key={ct.value} onClick={() => setContentType(ct.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition border ${
                      contentType === ct.value ? "border-[var(--accent)] bg-accent-soft text-accent" : "border-main text-muted hover:text-main"
                    }`}>
                    {ct.label}
                    <span className="text-hint font-normal ml-1">— {ct.hint}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={autoAnalyze} onChange={e => setAutoAnalyze(e.target.checked)}
                  className="rounded border-gray-300 text-accent" />
                <span className="text-xs text-muted">Auto-analyze with AI after import</span>
              </label>
              <button onClick={handleSearch} disabled={searching || (!brand.trim() && !keywords.trim() && !category.trim())}
                className="px-6 py-2 text-white rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition"
                style={{ background: "#0019FF" }}>
                {searching ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                    Searching...
                  </span>
                ) : "Search YouTube"}
              </button>
            </div>
          </div>

          {/* AI Ranking indicator */}
          {ranking && (
            <div className="bg-accent-soft border border-[var(--accent)] rounded-xl p-4 mb-6 flex items-center gap-3">
              <svg className="animate-spin h-5 w-5 text-accent" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
              <div>
                <p className="text-sm font-medium text-accent">AI is ranking results by relevance...</p>
                <p className="text-xs text-muted">Scoring {videos.length} videos for competitive intelligence value</p>
              </div>
            </div>
          )}

          {/* Results */}
          {videos.length > 0 && !importing && !importDone && (
            <div>
              {/* Controls bar */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <p className="text-sm text-main font-medium">{filteredVideos.length} results</p>
                  {videos.some(v => v.score !== null) && (
                    <div className="flex items-center gap-2">
                      <label className="text-[10px] text-muted">Min score:</label>
                      <select value={minScore} onChange={e => setMinScore(Number(e.target.value))}
                        className="px-2 py-1 bg-surface border border-main rounded text-xs text-main">
                        <option value={0}>All</option>
                        <option value={5}>5+</option>
                        <option value={7}>7+</option>
                        <option value={8}>8+</option>
                      </select>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={selectAll} className="text-xs text-accent hover:underline">Select all ({filteredVideos.length})</button>
                  <button onClick={() => setSelected(new Set())} className="text-xs text-muted hover:text-main">Clear</button>
                </div>
              </div>

              {/* Video cards */}
              <div className="space-y-3 mb-6">
                {filteredVideos.map(v => {
                  const isDuplicate = existingUrls.has(`https://www.youtube.com/watch?v=${v.videoId}`);
                  const isSelected = selected.has(v.videoId);
                  return (
                    <div key={v.videoId}
                      onClick={() => !isDuplicate && toggleSelect(v.videoId)}
                      className={`bg-surface border rounded-xl p-4 flex gap-4 cursor-pointer transition ${
                        isDuplicate ? "opacity-50 border-main cursor-not-allowed" :
                        isSelected ? "border-[var(--accent)] ring-1 ring-[var(--accent)]" : "border-main hover:border-[var(--accent)]"
                      }`}>
                      {/* Checkbox */}
                      <div className="flex items-start pt-1">
                        <input type="checkbox" checked={isSelected} disabled={isDuplicate}
                          onChange={() => toggleSelect(v.videoId)}
                          onClick={e => e.stopPropagation()}
                          className="rounded border-gray-300 text-accent" />
                      </div>

                      {/* Thumbnail — click to preview */}
                      <div className="w-40 h-24 flex-shrink-0 rounded-lg overflow-hidden bg-surface2 relative cursor-pointer group/thumb"
                        onClick={e => { e.stopPropagation(); setPreview({ videoId: v.videoId, title: v.title }); }}>
                        {v.thumbnail && <img src={v.thumbnail} className="w-full h-full object-cover" alt="" />}
                        <div className="absolute inset-0 bg-black/0 group-hover/thumb:bg-black/30 transition flex items-center justify-center">
                          <div className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center shadow-lg opacity-0 group-hover/thumb:opacity-100 transition">
                            <svg width="14" height="14" viewBox="0 0 20 20" fill="#0a0a0a"><polygon points="6,3 17,10 6,17" /></svg>
                          </div>
                        </div>
                        {v.duration && (
                          <span className="absolute bottom-1 right-1 bg-black/80 text-white text-[10px] px-1.5 py-0.5 rounded font-mono">
                            {formatDuration(v.duration)}
                          </span>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="text-sm font-semibold text-main leading-snug line-clamp-2">{v.title}</h3>
                          {v.score !== null && <ScoreBadge score={v.score} />}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <p className="text-xs text-muted">{v.channel}</p>
                          {v.channel && brand && v.channel.toLowerCase().includes(brand.toLowerCase().split(" ")[0]) && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200 font-semibold">Official</span>
                          )}
                          <span className="text-xs text-hint">· {formatViews(v.viewCount)} views · {v.year}</span>
                        </div>
                        {v.reason && <p className="text-[11px] text-hint mt-1 italic">{v.reason}</p>}
                        <button onClick={e => { e.stopPropagation(); setPreview({ videoId: v.videoId, title: v.title }); }}
                          className="text-[11px] text-accent hover:underline mt-1 inline-block">Watch video</button>
                        {isDuplicate && <p className="text-[10px] text-amber-500 font-medium mt-1">Already imported</p>}

                        {/* Settings area — shows when selected */}
                        {isSelected && !isDuplicate && (
                          <div className="mt-3 pt-3 border-t border-main space-y-3" onClick={e => e.stopPropagation()}>
                            {/* Scope selector */}
                            <div className="flex items-center gap-3">
                              <label className="text-[10px] text-muted uppercase font-semibold">Import to:</label>
                              <div className="flex bg-surface2 rounded-lg p-0.5">
                                <button onClick={() => setVideoScopes(prev => ({ ...prev, [v.videoId]: "local" }))}
                                  className={`px-3 py-1 rounded-md text-xs font-medium transition ${(videoScopes[v.videoId] || scope) === "local" ? "bg-surface text-accent shadow-sm" : "text-muted"}`}>
                                  Local
                                </button>
                                <button onClick={() => setVideoScopes(prev => ({ ...prev, [v.videoId]: "global" }))}
                                  className={`px-3 py-1 rounded-md text-xs font-medium transition ${(videoScopes[v.videoId] || scope) === "global" ? "bg-surface text-accent shadow-sm" : "text-muted"}`}>
                                  Global
                                </button>
                              </div>
                            </div>
                            {/* Transcript */}
                            <div>
                              <div className="flex justify-between items-center mb-1">
                                <label className="text-[10px] text-muted uppercase font-semibold">Transcript / Copy</label>
                                <span className="text-[9px] text-hint">Paste here for better AI analysis</span>
                              </div>
                              <textarea
                                value={transcripts[v.videoId] || ""}
                                onChange={e => setTranscripts(prev => ({ ...prev, [v.videoId]: e.target.value }))}
                                rows={3}
                                placeholder="Paste the video transcript or ad copy here..."
                                className="w-full px-3 py-2 bg-surface2 border border-main rounded-lg text-xs text-main resize-y focus:outline-none focus:border-[var(--accent)]"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Import bar */}
              {selected.size > 0 && (
                <div className="sticky bottom-4 bg-surface border border-main rounded-xl p-4 shadow-lg flex items-center justify-between">
                  <p className="text-sm text-main font-medium">{selected.size} video{selected.size > 1 ? "s" : ""} selected</p>
                  <button onClick={handleImport}
                    className="px-6 py-2 text-white rounded-lg text-sm font-semibold hover:opacity-90 transition"
                    style={{ background: "#0019FF" }}>
                    Import {selected.size} {autoAnalyze ? "+ AI Analyze" : ""}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Import progress */}
          {importing && (
            <div className="bg-surface border border-main rounded-xl p-8 text-center">
              <svg className="animate-spin h-8 w-8 mx-auto mb-4 text-accent" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
              <h3 className="text-lg font-bold text-main mb-2">Importing entries...</h3>
              <p className="text-sm text-muted mb-4">{importProgress.label}</p>
              <div className="w-full bg-surface2 rounded-full h-2 mb-2">
                <div className="h-2 rounded-full transition-all duration-300" style={{ width: `${(importProgress.current / importProgress.total) * 100}%`, background: "#0019FF" }} />
              </div>
              <p className="text-xs text-hint">{importProgress.current} of {importProgress.total}</p>
            </div>
          )}

          {/* Import complete */}
          {importDone && (
            <div className="bg-surface border border-main rounded-xl p-8 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ background: "#ecfdf5" }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <h3 className="text-lg font-bold text-main mb-2">{importCount} entries imported</h3>
              <p className="text-sm text-muted mb-6">
                {autoAnalyze ? "All entries have been analyzed by AI and fields pre-filled." : "Entries created with basic metadata. Run AI analysis from the Audit page."}
              </p>
              <div className="flex justify-center gap-3">
                <button onClick={() => router.push("/audit")}
                  className="px-5 py-2 text-white rounded-lg text-sm font-semibold" style={{ background: "#0019FF" }}>
                  View in Audit
                </button>
                <button onClick={() => { setImportDone(false); setVideos([]); setSelected(new Set()); }}
                  className="px-5 py-2 border border-main rounded-lg text-sm text-muted hover:text-main">
                  New search
                </button>
              </div>
            </div>
          )}

          {/* Empty state */}
          {videos.length === 0 && !searching && !importing && !importDone && (
            <div className="text-center py-16 text-hint">
              <div className="w-16 h-16 mx-auto mb-6 rounded-full flex items-center justify-center" style={{ background: "#0a0f3c" }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              </div>
              <p className="text-lg mb-2">Search for competitive content</p>
              <p className="text-sm">Enter a brand name to find their YouTube ads, campaigns, and branded content</p>
            </div>
          )}
        </div>
      </div>
    </ProjectGuard></AuthGuard>
  );
}
