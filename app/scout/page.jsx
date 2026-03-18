"use client";
import { useState, useEffect, useRef } from "react";
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
  const [durationFilter, setDurationFilter] = useState("commercial"); // commercial | short | any

  // Preview
  const [preview, setPreview] = useState(null); // { videoId, title }
  // Per-video settings (transcript + scope)
  const [transcripts, setTranscripts] = useState({}); // { videoId: "text" }
  const [videoScopes, setVideoScopes] = useState({}); // { videoId: "local"|"global" }
  const [videoIntents, setVideoIntents] = useState({}); // { videoId: "Brand Hero" etc }
  const [analystNotes, setAnalystNotes] = useState({}); // { videoId: "notes" }
  const INTENT_OPTIONS = ["Brand Hero","Brand Tactical","Client Testimonials","Product","Innovation","Beyond Banking"];

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

  // Scout Assistant
  const [assistOpen, setAssistOpen] = useState(false);
  const [assistQuery, setAssistQuery] = useState("");
  const assistEndRef = useRef(null);
  const [assistLoading, setAssistLoading] = useState(false);
  const [assistMessages, setAssistMessages] = useState([]);

  const askAssistant = async () => {
    if (!assistQuery.trim() || assistLoading) return;
    const q = assistQuery.trim();
    setAssistMessages(prev => [...prev, { role: "user", text: q }]);
    setAssistQuery("");
    setAssistLoading(true);
    setTimeout(() => assistEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          max_tokens: 1500,
          system: `You are a competitive intelligence research assistant for a brand strategy team. The user is using a YouTube Scout tool to find and analyze competitor communications in financial services / banking.

Help them by suggesting specific brands, banks, fintechs, or financial institutions to search for, with context on why each is relevant.

RESPONSE FORMAT — CRITICAL:
Return a JSON object with this structure:
{
  "intro": "Brief intro sentence",
  "groups": [
    {
      "title": "Group name (e.g. Neo-Banking)",
      "brands": [
        { "name": "Brand Name", "url": "https://brand-website.com", "desc": "Brief description of why they're relevant" }
      ]
    }
  ],
  "keywords": ["keyword 1", "keyword 2"],
  "note": "Optional closing note"
}

Rules:
- Group brands by category (3-4 groups max)
- Include the brand's actual website URL
- Keep descriptions to one line
- Include 4-6 search keywords at the end
- Return ONLY valid JSON, no markdown`,
          messages: [
            ...assistMessages.map(m => ({ role: m.role, content: m.text })),
            { role: "user", content: q },
          ],
        }),
      });
      const data = await res.json();
      const raw = data.content?.[0]?.text || "No response";
      let parsed = null;
      try { parsed = JSON.parse(raw); } catch {
        const m2 = raw.match(/\{[\s\S]*\}/);
        if (m2) try { parsed = JSON.parse(m2[0]); } catch {}
      }
      setAssistMessages(prev => [...prev, { role: "assistant", text: raw, parsed, isNew: true }]);
      setTimeout(() => { setAssistMessages(prev => prev.map(m => ({ ...m, isNew: false }))); assistEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, 100);
    } catch (err) {
      setAssistMessages(prev => [...prev, { role: "assistant", text: "Error: " + err.message }]);
    }
    setAssistLoading(false);
  };

  // Dynamic suggestions — generated from project data + AI
  const [suggestions, setSuggestions] = useState([]);
  useEffect(() => {
    if (!projectId) return;
    (async () => {
      const supabaseClient = createClient();
      const [{ data: local }, { data: global }] = await Promise.all([
        supabaseClient.from("audit_entries").select("competitor").eq("project_id", projectId),
        supabaseClient.from("audit_global").select("brand, country").eq("project_id", projectId),
      ]);
      const brands = new Set();
      (local || []).forEach(e => { if (e.competitor) brands.add(e.competitor); });
      (global || []).forEach(e => { if (e.brand) brands.add(e.brand); });
      const countries = new Set();
      (global || []).forEach(e => { if (e.country) countries.add(e.country); });

      // Build smart suggestions from existing data + variations
      const s = [];
      const brandArr = [...brands];
      // Suggest existing brands (pick random 2)
      const shuffled = brandArr.sort(() => 0.5 - Math.random());
      shuffled.slice(0, 2).forEach(b => s.push(b));
      // Suggest brand + context
      if (shuffled[0]) s.push(`${shuffled[0]} small business`);
      // Suggest market exploration
      const countryArr = [...countries];
      if (countryArr.length > 0) s.push(`business banking ${countryArr[Math.floor(Math.random() * countryArr.length)]}`);
      else s.push("business banking UK");
      // Always add a discovery suggestion
      const discoveries = ["neobank business account", "SME fintech ads", "challenger bank commercial", "business banking innovation", "small business testimonials"];
      s.push(discoveries[Math.floor(Math.random() * discoveries.length)]);

      setSuggestions(s.slice(0, 5));
    })();
  }, [projectId]);

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
  const searchingRef = useRef(false);
  const handleSearch = async () => {
    if (searchingRef.current) return; // prevent double-calls
    const searchBrand = brand.trim();
    const searchKeywords = keywords.trim();
    const searchCategory = category.trim();
    if (!searchBrand && !searchKeywords && !searchCategory) { showToast("Enter a brand, category, or keywords"); return; }
    searchingRef.current = true;
    setSearching(true);
    setVideos([]);
    setScoutMessage(SEARCH_MESSAGES[Math.floor(Math.random() * SEARCH_MESSAGES.length)]);
    setSelected(new Set());
    setImportDone(false);

    // Build query — use local vars captured at start to avoid stale state
    const parts = [];
    if (searchBrand) parts.push(searchBrand);
    if (searchCategory) parts.push(searchCategory);
    if (searchKeywords) {
      searchKeywords.split(",").map(k => k.trim()).filter(Boolean).forEach(k => {
        parts.push(k.includes(" ") ? `"${k}"` : k);
      });
    }
    const query = parts.join(" ");
    const publishedAfter = timeframe > 0 ? new Date(Date.now() - timeframe * 86400000).toISOString() : undefined;

    try {
      const res = await fetch("/api/youtube-scout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "search", query, maxResults: durationFilter === "commercial" ? 50 : maxResults,
          publishedAfter, regionCode: region || undefined,
          videoDuration: durationFilter === "any" ? undefined : "short",
          minSeconds: durationFilter === "commercial" ? 15 : undefined,
          maxSeconds: durationFilter === "commercial" ? 90 : undefined,
        }),
      });
      const data = await res.json();
      if (data.error) { showToast("Error: " + data.error); setSearching(false); searchingRef.current = false; return; }

      const vids = data.videos || [];
      if (vids.length === 0) { showToast("No results found"); setSearching(false); searchingRef.current = false; return; }

      const mapped = vids.map(v => ({ ...v, score: null, reason: "" }));
      // CRITICAL: set videos BEFORE clearing searching flag
      // Otherwise there's a render frame with searching=false + videos=[] = empty state
      setVideos(mapped);
      setSearching(false);
      searchingRef.current = false;

      // Rank with AI in background — don't block results display
      setRanking(true);
      try {
        const market = REGION_CODES.find(r => r.code === region)?.label || "";
        const rankRes = await fetch("/api/youtube-scout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "rank", brand: searchBrand || searchCategory, keywords: searchKeywords || searchCategory, market, videos: vids }),
        });
        const rankData = await rankRes.json();
        const rankings = rankData.rankings || [];

        if (rankings.length > 0) {
          setVideos(prev => {
            const updated = [...prev];
            rankings.forEach(r => {
              const idx = (r.index || r.videoIndex || 0) - 1;
              if (idx >= 0 && idx < updated.length) {
                updated[idx] = { ...updated[idx], score: r.score, reason: r.reason || r.rationale || "" };
              }
            });
            return updated.sort((a, b) => {
              if (a.isOfficial && !b.isOfficial) return -1;
              if (!a.isOfficial && b.isOfficial) return 1;
              return (b.score || 0) - (a.score || 0);
            });
          });
        }
      } catch (rankErr) {
        // Ranking failed — results still show unranked
      }
      setRanking(false);
    } catch (err) {
      showToast("Search failed — please try again");
      setSearching(false);
      setRanking(false);
      searchingRef.current = false;
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

      // Add communication intent and analyst notes if set
      const vidIntent = videoIntents[v.videoId];
      if (vidIntent) entry.communication_intent = vidIntent;
      const vidNotes = analystNotes[v.videoId];
      if (vidNotes) entry.analyst_comment = vidNotes;

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
                vidNotes ? `Analyst observations: ${vidNotes}` : "",
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
  const [filtersOpen, setFiltersOpen] = useState(false);
  const searchInputRef = useRef(null);

  // Search messages for conversational UI
  const SEARCH_MESSAGES = [
    "Digging into the content library...",
    "Searching across YouTube...",
    "Looking for interesting campaigns...",
    "Hunting for competitive intelligence...",
  ];
  const RANKING_MESSAGES = [
    "Found some pieces! Let me rank them by relevance...",
    "Scoring each video for strategic value...",
    "Almost there — picking the best ones...",
  ];
  const RESULT_MESSAGES = [
    "Here's what I found! 👇",
    "Take a look at these — some interesting stuff!",
    "Got results! The best ones are at the top.",
  ];
  const randomMsg = (arr) => arr[Math.floor(Math.random() * arr.length)];

  const [scoutMessage, setScoutMessage] = useState("");

  // ─── RENDER ───
  return (
    <AuthGuard><ProjectGuard><Nav />
      <div className="min-h-screen" style={{ background: "var(--bg)" }}>
        {toast && <div className="fixed top-4 right-4 bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium z-50 shadow-lg" style={{ animation: "fadeIn 0.3s" }}>{toast}</div>}
        {preview && <VideoPreview videoId={preview.videoId} title={preview.title} onClose={() => setPreview(null)} />}

        <div className="max-w-5xl mx-auto p-6">

          {/* ─── HEADER + SEARCH (always visible, sticky) ─── */}
          <div className="max-w-2xl mx-auto sticky top-[52px] z-30 pt-4 pb-6 mb-4">
            {/* Background + shadow mask */}
            <div className="absolute inset-0 -top-2 -left-8 -right-8 -bottom-2 -z-10" style={{ background: "var(--bg)", boxShadow: "0 12px 24px -4px rgba(0,0,0,0.12)", borderRadius: "0 0 24px 24px" }} />
            {/* Scout branding — compact when results, full when empty */}
            <div className={`text-center ${videos.length > 0 || searching || ranking || importing || importDone ? "mb-3" : "pt-8 pb-4 mb-4"}`}>
              <div className={`mx-auto rounded-full flex items-center justify-center ${videos.length > 0 || searching || ranking || importing || importDone ? "w-8 h-8 mb-1" : "w-16 h-16 mb-4"}`} style={{ background: "#0a0f3c" }}>
                <svg width={videos.length > 0 || searching || ranking ? "14" : "28"} height={videos.length > 0 || searching || ranking ? "14" : "28"} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              </div>
              <h1 className={`font-bold text-main ${videos.length > 0 || searching || ranking || importing || importDone ? "text-sm" : "text-2xl mb-2"}`}>Scout</h1>
              {!(videos.length > 0 || searching || ranking || importing || importDone) && (
                <p className="text-sm text-muted max-w-md mx-auto">Tell me a brand, a market, or just an idea — I'll find the competitive content for you</p>
              )}
            </div>
            <div className="bg-surface border border-main rounded-2xl shadow-sm overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-3">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" strokeWidth="1.5" className="flex-shrink-0"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input ref={searchInputRef} value={brand} onChange={e => setBrand(e.target.value)}
                  placeholder="Search a brand, market, or topic..."
                  className="flex-1 text-sm text-main bg-transparent focus:outline-none placeholder:text-hint"
                  onKeyDown={e => { if (e.key === "Enter") handleSearch(); }} />
                <button onClick={handleSearch} disabled={searching || !brand.trim()}
                  className="px-4 py-1.5 text-white rounded-lg text-xs font-semibold hover:opacity-90 disabled:opacity-30 transition flex-shrink-0"
                  style={{ background: "#0019FF" }}>
                  {searching ? "Searching..." : "Scout"}
                </button>
              </div>

              {/* Advanced filters — collapsed by default */}
              <div className="border-t border-main">
                <button onClick={() => setFiltersOpen(!filtersOpen)}
                  className="w-full px-4 py-2 flex items-center justify-between text-[10px] text-muted hover:text-main transition">
                  <span className="uppercase font-semibold tracking-wider">Advanced filters</span>
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" className={`transition ${filtersOpen ? "rotate-180" : ""}`}><path d="M2 4l3 3 3-3" /></svg>
                </button>
                {filtersOpen && (
                  <div className="px-4 pb-4 space-y-3" style={{ animation: "fadeIn 0.2s" }}>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[9px] text-hint uppercase font-semibold mb-1">Category / Keywords</label>
                        <input value={keywords} onChange={e => setKeywords(e.target.value)} placeholder="E.g., business banking, SME"
                          className="w-full px-2 py-1.5 bg-surface2 border border-main rounded text-xs text-main focus:outline-none" />
                      </div>
                      <div>
                        <label className="block text-[9px] text-hint uppercase font-semibold mb-1">Market</label>
                        <select value={region} onChange={e => setRegion(e.target.value)}
                          className="w-full px-2 py-1.5 bg-surface2 border border-main rounded text-xs text-main">
                          {REGION_CODES.map(r => <option key={r.code} value={r.code}>{r.label}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[9px] text-hint uppercase font-semibold mb-1">Timeframe</label>
                        <select value={timeframe} onChange={e => setTimeframe(Number(e.target.value))}
                          className="w-full px-2 py-1.5 bg-surface2 border border-main rounded text-xs text-main">
                          {TIMEFRAMES.map(t => <option key={t.days} value={t.days}>{t.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[9px] text-hint uppercase font-semibold mb-1">Max results</label>
                        <select value={maxResults} onChange={e => setMaxResults(Number(e.target.value))}
                          className="w-full px-2 py-1.5 bg-surface2 border border-main rounded text-xs text-main">
                          {[10, 15, 20, 30, 50].map(n => <option key={n} value={n}>{n}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[9px] text-hint uppercase font-semibold mb-1">Duration</label>
                        <select value={durationFilter} onChange={e => setDurationFilter(e.target.value)}
                          className="w-full px-2 py-1.5 bg-surface2 border border-main rounded text-xs text-main">
                          <option value="commercial">Commercials (15-90s)</option>
                          <option value="short">Short (&lt;4 min)</option>
                          <option value="any">Any length</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input type="checkbox" checked={contentType === "official"} onChange={e => setContentType(e.target.checked ? "official" : "all")} className="rounded border-gray-300 text-accent" />
                          <span className="text-[10px] text-muted">Official content only</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input type="checkbox" checked={autoAnalyze} onChange={e => setAutoAnalyze(e.target.checked)} className="rounded border-gray-300 text-accent" />
                          <span className="text-[10px] text-muted">AI analyze on import</span>
                        </label>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ─── SEARCHING STATE ─── */}
          {searching && (
            <div className="text-center py-12" style={{ animation: "fadeIn 0.3s" }}>
              <div className="w-12 h-12 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ background: "#0a0f3c" }}>
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="white" strokeWidth="3" fill="none"/><path className="opacity-75" fill="white" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
              </div>
              <p className="text-sm font-medium text-main">{scoutMessage}</p>
            </div>
          )}

          {/* Ranking indicator — shown above results, not replacing them */}
          {ranking && videos.length > 0 && (
            <div className="flex items-center gap-3 bg-accent-soft border border-[var(--accent)] rounded-xl px-4 py-3 mb-4" style={{ animation: "fadeIn 0.3s" }}>
              <svg className="animate-spin h-4 w-4 text-accent flex-shrink-0" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
              <p className="text-xs text-accent font-medium">Ranking {videos.length} results by relevance...</p>
            </div>
          )}

          {/* Results */}
          {videos.length > 0 && !searching && !importing && !importDone && (
            <div>
              {/* Conversational results header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <p className="text-sm text-main font-medium">Found {filteredVideos.length} pieces 👇</p>
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
                          {v.isOfficial && (
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
                            {/* Communication Intent */}
                            <div className="flex items-center gap-3">
                              <label className="text-[10px] text-muted uppercase font-semibold">Intent:</label>
                              <select value={videoIntents[v.videoId] || ""} onChange={ev => setVideoIntents(prev => ({ ...prev, [v.videoId]: ev.target.value }))}
                                className="px-2 py-1 bg-surface border border-main rounded text-xs text-main">
                                <option value="">— Select —</option>
                                {INTENT_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                              </select>
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
                            {/* Analyst Notes */}
                            <div>
                              <div className="flex justify-between items-center mb-1">
                                <label className="text-[10px] text-muted uppercase font-semibold">Analyst Notes</label>
                                <span className="text-[9px] text-hint">Your observations — sent to AI</span>
                              </div>
                              <textarea
                                value={analystNotes[v.videoId] || ""}
                                onChange={e => setAnalystNotes(prev => ({ ...prev, [v.videoId]: e.target.value }))}
                                rows={2}
                                placeholder="What stands out? Strategic observations..."
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
                <button onClick={() => { setImportDone(false); setVideos([]); setSelected(new Set()); setBrand(""); setKeywords(""); }}
                  className="px-5 py-2 border border-main rounded-lg text-sm text-muted hover:text-main">
                  New search
                </button>
              </div>
            </div>
          )}

          {/* Quick suggestions when no results */}
          {videos.length === 0 && !searching && !ranking && !importing && !importDone && suggestions.length > 0 && (
            <div className="max-w-2xl mx-auto">
              <p className="text-[10px] text-hint uppercase font-semibold tracking-wider mb-2 text-center">Try searching for</p>
              <div className="flex flex-wrap justify-center gap-2">
                {suggestions.map(q => (
                  <button key={q} onClick={() => { setBrand(q); setTimeout(() => handleSearch(), 100); }}
                    className="px-3 py-1.5 bg-surface border border-main rounded-full text-xs text-muted hover:text-accent hover:border-[var(--accent)] transition">{q}</button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      {/* ─── SCOUT ASSISTANT BUBBLE ─── */}
      <div className="fixed bottom-6 right-6 z-50">
        {assistOpen && (
          <div className="absolute bottom-16 right-0 w-[360px] bg-surface border border-main rounded-2xl shadow-2xl overflow-hidden" style={{ maxHeight: "60vh" }}>
            <div className="px-4 py-3 flex justify-between items-center" style={{ background: "#0a0f3c" }}>
              <div>
                <h3 className="text-sm font-bold text-white">Scout Assistant</h3>
                <p className="text-[9px] text-white/40">Ask me who to search for</p>
              </div>
              <button onClick={() => setAssistOpen(false)} className="text-white/40 hover:text-white w-6 h-6 flex items-center justify-center rounded-full hover:bg-white/10">×</button>
            </div>
            <div className="overflow-y-auto p-3 space-y-3" style={{ maxHeight: "calc(60vh - 110px)" }}>
              {assistMessages.length === 0 && (
                <div className="text-center py-4">
                  <p className="text-xs text-muted mb-3">Try asking:</p>
                  <div className="space-y-1.5">
                    {["Who competes in SME banking here?","Top fintechs for small business","Neobanks worth exploring","What brands should I look at next?"].map(q => (
                      <button key={q} onClick={() => { setAssistQuery(q); }} className="block w-full text-left px-3 py-2 rounded-lg bg-surface2 text-xs text-main hover:bg-accent-soft transition">{q}</button>
                    ))}
                  </div>
                </div>
              )}
              {assistMessages.map((m, i) => (
                <div key={i} className={`${m.role === "user" ? "text-right" : ""}`} style={{ animation: "fadeIn 0.3s ease-out" }}>
                  {m.role === "user" ? (
                    <div className="inline-block max-w-[90%] px-3 py-2 rounded-xl rounded-br-sm text-xs text-white" style={{ background: "#0019FF" }}>{m.text}</div>
                  ) : m.parsed ? (
                    <div className="space-y-3 text-xs" style={{ animation: "fadeIn 0.5s ease-out" }}>
                      {m.parsed.intro && <p className="text-muted">{m.parsed.intro}</p>}
                      {(m.parsed.groups || []).map((g, gi) => (
                        <div key={gi}>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-accent mb-1.5">{g.title}</p>
                          <div className="space-y-1">
                            {(g.brands || []).map((b, bi) => (
                              <div key={bi} className="flex items-start gap-2 pl-1">
                                <span className="text-accent mt-0.5">•</span>
                                <div>
                                  <a href={b.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-main hover:text-accent transition underline underline-offset-2 decoration-dotted">{b.name}</a>
                                  <span className="text-muted ml-1">— {b.desc}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                      {m.parsed.keywords?.length > 0 && (
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-accent mb-1.5">Search Keywords</p>
                          <div className="flex flex-wrap gap-1">
                            {m.parsed.keywords.map((kw, ki) => (
                              <span key={ki} className="px-2 py-1 bg-accent-soft text-accent rounded-full text-[10px] font-medium cursor-pointer hover:bg-[#0019FF] hover:text-white transition"
                                onClick={() => { setBrand(""); setKeywords(kw); setAssistOpen(false); }}>
                                {kw}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {m.parsed.note && <p className="text-muted italic text-[10px] pt-1 border-t border-main">{m.parsed.note}</p>}
                    </div>
                  ) : (
                    <div className="bg-surface2 rounded-xl rounded-bl-sm px-3 py-2 text-xs text-main leading-relaxed">
                      {m.text.split("\n").map((line, li) => {
                        // Bold **text**
                        const formatted = line.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
                        const isBullet = /^[\s]*[-•·]/.test(line);
                        return <p key={li} className={`${isBullet ? "pl-2" : ""} ${li > 0 ? "mt-1" : ""}`} dangerouslySetInnerHTML={{ __html: formatted || "&nbsp;" }} />;
                      })}
                    </div>
                  )}
                </div>
              ))}
              {assistLoading && (
                <div className="flex gap-1 px-3 py-2">
                  <span className="w-2 h-2 bg-accent rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-2 h-2 bg-accent rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-2 h-2 bg-accent rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              )}
              <div ref={assistEndRef} />
            </div>
            <div className="border-t border-main p-2 flex gap-2">
              <input value={assistQuery} onChange={e => setAssistQuery(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") askAssistant(); }}
                placeholder="Ask about brands, markets..."
                className="flex-1 px-3 py-2 bg-surface2 border border-main rounded-lg text-xs text-main focus:outline-none focus:border-[var(--accent)]" />
              <button onClick={askAssistant} disabled={assistLoading || !assistQuery.trim()}
                className="px-3 py-2 bg-[#0019FF] text-white rounded-lg text-xs font-semibold hover:opacity-90 disabled:opacity-50">
                Send
              </button>
            </div>
          </div>
        )}
        <button onClick={() => setAssistOpen(!assistOpen)}
          className="w-12 h-12 rounded-full shadow-lg flex items-center justify-center hover:scale-105 transition"
          style={{ background: "#0019FF" }}>
          {assistOpen ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5"><path d="M12 2a7 7 0 017 7c0 3-2 5.5-4 7l-1 4h-4l-1-4c-2-1.5-4-4-4-7a7 7 0 017-7z"/><circle cx="12" cy="9" r="2" fill="white"/></svg>
          )}
        </button>
      </div>
    </ProjectGuard></AuthGuard>
  );
}
