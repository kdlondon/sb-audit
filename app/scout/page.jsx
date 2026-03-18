"use client";
/*
 * Supabase migration for scout_saved:
 *
 * CREATE TABLE scout_saved (
 *   id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 *   project_id text,
 *   video_id text,
 *   title text,
 *   channel text,
 *   thumbnail text,
 *   url text,
 *   description text,
 *   year text,
 *   duration text,
 *   view_count integer,
 *   notes text,
 *   saved_by text,
 *   created_at timestamptz DEFAULT now()
 * );
 */
import { useState, useEffect, useRef, useCallback } from "react";
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

const INTENT_OPTIONS = ["Brand Hero", "Brand Tactical", "Client Testimonials", "Product", "Innovation", "Beyond Banking"];

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

const CONTENT_TYPES = [
  { value: "official", label: "Official content", hint: "Ads, campaigns, brand videos" },
  { value: "all", label: "All content", hint: "Everything including commentary, tutorials" },
];

/* ─── HELPERS ─── */

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function formatViews(n) {
  if (!n) return "\u2014";
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

/* ─── MAIN COMPONENT ─── */
export default function ScoutPage() {
  const { projectId, projectName } = useProject();
  const { role } = useRole();
  const router = useRouter();
  const supabase = createClient();

  // Dynamic suggestions from project data
  const [suggestions, setSuggestions] = useState([]);
  useEffect(() => {
    if (!projectId) return;
    (async () => {
      const s = createClient();
      const [{ data: local }, { data: global }] = await Promise.all([
        s.from("audit_entries").select("competitor").eq("project_id", projectId),
        s.from("audit_global").select("brand, country").eq("project_id", projectId),
      ]);
      const brands = new Set();
      (local || []).forEach(e => { if (e.competitor) brands.add(e.competitor); });
      (global || []).forEach(e => { if (e.brand) brands.add(e.brand); });
      const countries = new Set();
      (global || []).forEach(e => { if (e.country) countries.add(e.country); });
      const arr = [];
      const brandArr = [...brands].sort(() => 0.5 - Math.random());
      brandArr.slice(0, 2).forEach(b => arr.push(b));
      if (brandArr[0]) arr.push(`${brandArr[0]} small business`);
      const countryArr = [...countries];
      arr.push(countryArr.length > 0 ? `business banking ${countryArr[Math.floor(Math.random() * countryArr.length)]}` : "business banking UK");
      const disc = ["neobank business account", "SME fintech ads", "challenger bank commercial", "business banking innovation", "small business testimonials"];
      arr.push(disc[Math.floor(Math.random() * disc.length)]);
      setSuggestions(arr.slice(0, 5));
    })();
  }, [projectId]);

  // Search form
  const [brand, setBrand] = useState("");
  const [keywords, setKeywords] = useState("");
  const [category, setCategory] = useState("");
  const [region, setRegion] = useState("");
  const [timeframe, setTimeframe] = useState(365);
  const [maxResults, setMaxResults] = useState(15);
  const [contentType, setContentType] = useState("official");
  const [durationFilter, setDurationFilter] = useState("commercial");

  // Preview
  const [preview, setPreview] = useState(null);

  // Per-video settings
  const [transcripts, setTranscripts] = useState({});
  const [videoScopes, setVideoScopes] = useState({});
  const [videoIntents, setVideoIntents] = useState({});
  const [analystNotes, setAnalystNotes] = useState({});

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
  const showToast = useCallback((msg) => { setToast(msg); setTimeout(() => setToast(""), 4000); }, []);

  // Saved items
  const [savedItems, setSavedItems] = useState([]);
  const [savedTab, setSavedTab] = useState(false);
  const [savedNotes, setSavedNotes] = useState({});

  // Screenshot capture for saved items
  const [capturedImages, setCapturedImages] = useState({}); // keyed by video_id, each an array of URLs
  const [captureActive, setCaptureActive] = useState(null); // video_id or null
  const [captureCount, setCaptureCount] = useState(0);
  const [uploading, setUploading] = useState(false);
  const captureStreamRef = useRef(null);
  const captureVideoRef = useRef(null);
  const videoIframeRef = useRef(null);

  // FIX #1: Store status messages in state — set ONCE, never call randomMsg during render
  const [statusMessage, setStatusMessage] = useState("");

  // Scout Assistant
  const [assistOpen, setAssistOpen] = useState(false);
  const [assistQuery, setAssistQuery] = useState("");
  const assistEndRef = useRef(null);
  const [assistLoading, setAssistLoading] = useState(false);
  const [assistMessages, setAssistMessages] = useState([]);

  // UI state
  const [filtersOpen, setFiltersOpen] = useState(false);
  const searchInputRef = useRef(null);

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
        if (m2) try { parsed = JSON.parse(m2[0]); } catch { /* ignore */ }
      }
      setAssistMessages(prev => [...prev, { role: "assistant", text: raw, parsed, isNew: true }]);
      setTimeout(() => { setAssistMessages(prev => prev.map(m => ({ ...m, isNew: false }))); assistEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, 100);
    } catch (err) {
      setAssistMessages(prev => [...prev, { role: "assistant", text: "Error: " + err.message }]);
    }
    setAssistLoading(false);
  };

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

  // ─── LOAD SAVED ITEMS ───
  useEffect(() => {
    if (!projectId) return;
    (async () => {
      const { data } = await supabase.from("scout_saved").select("*").eq("project_id", projectId).order("created_at", { ascending: false });
      if (data) {
        setSavedItems(data);
        const notes = {};
        data.forEach(d => { if (d.notes) notes[d.id] = d.notes; });
        setSavedNotes(notes);
      }
    })();
  }, [projectId]);

  const savedVideoIds = new Set(savedItems.map(s => s.video_id));

  // ─── UPLOAD & CAPTURE FUNCTIONS ───
  const uploadFile = async (file) => {
    if (!file) return null;
    const ext = file.name?.split(".").pop() || "jpg";
    const path = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}.${ext}`;
    const { error } = await supabase.storage.from("media").upload(path, file);
    if (error) { console.error("Upload error:", error); return null; }
    const { data: { publicUrl } } = supabase.storage.from("media").getPublicUrl(path);
    return publicUrl;
  };

  const startCapture = async (videoId) => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: "browser" },
        preferCurrentTab: true,
      });
      captureStreamRef.current = stream;
      const video = document.createElement("video");
      video.srcObject = stream;
      video.muted = true;
      await video.play();
      captureVideoRef.current = video;
      setCaptureActive(videoId);
      setCaptureCount(0);
      showToast("Capture mode active — click Capture frame anytime");
      stream.getVideoTracks()[0].onended = () => stopCapture();
    } catch (err) {
      if (err.name !== "NotAllowedError") showToast("Could not start capture: " + err.message);
    }
  };

  const stopCapture = () => {
    if (captureStreamRef.current) {
      captureStreamRef.current.getTracks().forEach(t => t.stop());
      captureStreamRef.current = null;
    }
    if (captureVideoRef.current) {
      captureVideoRef.current.pause();
      captureVideoRef.current.srcObject = null;
      captureVideoRef.current = null;
    }
    setCaptureActive(null);
  };

  const captureFrame = async (videoId) => {
    const video = captureVideoRef.current;
    if (!video || video.readyState < 2) return;
    const iframe = videoIframeRef.current;
    if (!iframe) return;
    const rect = iframe.getBoundingClientRect();
    const fullCanvas = document.createElement("canvas");
    fullCanvas.width = video.videoWidth;
    fullCanvas.height = video.videoHeight;
    fullCanvas.getContext("2d").drawImage(video, 0, 0);
    const scaleX = video.videoWidth / window.innerWidth;
    const scaleY = video.videoHeight / window.innerHeight;
    const cropX = Math.round(rect.left * scaleX);
    const cropY = Math.round(rect.top * scaleY);
    const cropW = Math.round(rect.width * scaleX);
    const cropH = Math.round(rect.height * scaleY);
    const canvas = document.createElement("canvas");
    canvas.width = cropW;
    canvas.height = cropH;
    canvas.getContext("2d").drawImage(fullCanvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
    const blob = await new Promise(r => canvas.toBlob(r, "image/jpeg", 0.92));
    const file = new File([blob], `capture_${Date.now()}.jpg`, { type: "image/jpeg" });
    setUploading(true);
    const url = await uploadFile(file);
    if (url) {
      setCapturedImages(prev => ({
        ...prev,
        [videoId]: [...(prev[videoId] || []), url],
      }));
      setCaptureCount(c => c + 1);
      showToast("Frame captured (" + (captureCount + 1) + ")");
    }
    setUploading(false);
  };

  const handleCaptureFileUpload = async (videoId, files) => {
    if (!files.length) return;
    setUploading(true);
    for (const file of files) {
      const url = await uploadFile(file);
      if (url) {
        setCapturedImages(prev => ({
          ...prev,
          [videoId]: [...(prev[videoId] || []), url],
        }));
      }
    }
    setUploading(false);
    showToast(files.length + " image" + (files.length > 1 ? "s" : "") + " added");
  };

  const removeCapturedImage = (videoId, index) => {
    setCapturedImages(prev => ({
      ...prev,
      [videoId]: (prev[videoId] || []).filter((_, i) => i !== index),
    }));
  };

  // Clean up capture on unmount
  useEffect(() => {
    return () => { if (captureStreamRef.current) captureStreamRef.current.getTracks().forEach(t => t.stop()); };
  }, []);

  // Stop capture when leaving saved tab
  useEffect(() => { if (!savedTab) stopCapture(); }, [savedTab]);

  const handleSaveItem = async (v) => {
    const { data: { session } } = await supabase.auth.getSession();
    const entry = {
      project_id: projectId,
      video_id: v.videoId,
      title: v.title || "",
      channel: v.channel || "",
      thumbnail: v.thumbnail || "",
      url: `https://www.youtube.com/watch?v=${v.videoId}`,
      description: v.description || "",
      year: v.year || "",
      duration: v.duration || "",
      view_count: v.viewCount || 0,
      notes: "",
      saved_by: session?.user?.email || "",
    };
    const { data, error } = await supabase.from("scout_saved").insert(entry).select().single();
    if (error) { showToast("Error saving: " + error.message); return; }
    setSavedItems(prev => [data, ...prev]);
    showToast("Saved!");
  };

  const handleRemoveSaved = async (id) => {
    const { error } = await supabase.from("scout_saved").delete().eq("id", id);
    if (error) { showToast("Error removing: " + error.message); return; }
    setSavedItems(prev => prev.filter(s => s.id !== id));
    showToast("Removed from saved");
  };

  const handleUpdateSavedNotes = async (id, notes) => {
    setSavedNotes(prev => ({ ...prev, [id]: notes }));
    await supabase.from("scout_saved").update({ notes }).eq("id", id);
  };

  const handleImportSaved = async (item) => {
    setImporting(true);
    setImportProgress({ current: 1, total: 1, label: `Processing: ${(item.title || "").slice(0, 40)}...` });
    const { data: { session } } = await supabase.auth.getSession();
    const table = scope === "global" ? "audit_global" : "audit_entries";

    // Use user-provided transcript first, then try auto-fetch
    let transcript = transcripts[item.video_id] || "";
    if (!transcript) {
      setImportProgress({ current: 1, total: 1, label: `Fetching transcript: ${(item.title || "").slice(0, 40)}...` });
      try {
        const tRes = await fetch("/api/youtube-scout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "transcript", videoId: item.video_id }),
        });
        const tData = await tRes.json();
        transcript = tData.transcript || "";
      } catch { /* ignore */ }
    }

    // Use captured images if available, otherwise fall back to thumbnail
    const captures = capturedImages[item.video_id] || [];
    const primaryImage = captures.length > 0 ? captures[0] : item.thumbnail;
    const extraImages = captures.length > 1 ? captures.slice(1) : [];

    const entry = {
      id: String(Date.now()) + "_saved",
      project_id: projectId,
      created_by: session?.user?.email || "",
      updated_at: new Date().toISOString(),
      url: item.url,
      image_url: primaryImage,
      image_urls: extraImages.length > 0 ? JSON.stringify(extraImages) : null,
      description: item.title,
      year: item.year || "",
      type: "Video",
      synopsis: item.description || "",
      transcript,
    };

    if (scope === "global") {
      entry.brand = item.channel || "";
      entry.country = REGION_CODES.find(r => r.code === region)?.label || "";
    } else {
      entry.competitor = item.channel || "";
    }

    const notes = savedNotes[item.id] || analystNotes[item.video_id] || "";
    if (notes) entry.analyst_comment = notes;
    const vidIntent = videoIntents[item.video_id];
    if (vidIntent) entry.communication_intent = vidIntent;

    const { error } = await supabase.from(table).insert(entry);
    if (error) { showToast("Import error: " + error.message); setImporting(false); return; }

    if (autoAnalyze && (item.thumbnail || transcript)) {
      setImportProgress({ current: 1, total: 1, label: `AI analyzing: ${(item.title || "").slice(0, 40)}...` });
      try {
        const contextParts = [
          `Brand: ${item.channel || ""}`,
          transcript ? `Transcript: ${transcript.slice(0, 1500)}` : "",
          notes ? `Analyst Notes: ${notes}` : "",
        ].filter(Boolean);

        const analyzeRes = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageUrl: item.thumbnail, context: contextParts.join("\n") }),
        });
        const analysis = await analyzeRes.json();
        if (analysis.success && analysis.analysis) {
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
      } catch { /* ignore */ }
    }

    setImporting(false);
    setImportCount(1);
    setImportDone(true);
    showToast("Imported from saved!");
  };

  // ─── SEARCH ───
  const handleSearch = async () => {
    if (!brand.trim() && !keywords.trim() && !category.trim()) { showToast("Enter a brand, category, or keywords"); return; }

    // FIX #1: Set status message in state ONCE at search start
    setStatusMessage(pickRandom(SEARCH_MESSAGES));
    setSearching(true);
    setVideos([]);
    setSelected(new Set());
    setImportDone(false);

    const parts = [];
    if (brand.trim()) parts.push(brand.trim());
    if (category.trim()) parts.push(category.trim());
    if (keywords.trim()) {
      keywords.split(",").map(k => k.trim()).filter(Boolean).forEach(k => {
        parts.push(k);
      });
    }
    if (contentType === "official") parts.push("official ad commercial campaign");
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
      if (data.error) { showToast("Error: " + data.error); setSearching(false); return; }

      let vids = data.videos || [];
      setVideos(vids.map(v => ({ ...v, score: null, reason: "" })));
      setSearching(false);

      // Now rank with AI
      if (vids.length > 0) {
        // FIX #1: Set ranking message in state ONCE
        setStatusMessage(pickRandom(RANKING_MESSAGES));
        setRanking(true);
        try {
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
            return updated.sort((a, b) => {
              if (a.isOfficial && !b.isOfficial) return -1;
              if (!a.isOfficial && b.isOfficial) return 1;
              return (b.score || 0) - (a.score || 0);
            });
          });
        } catch (err) {
          showToast("Ranking failed: " + err.message);
        } finally {
          // FIX #4: Always clear ranking even on failure
          setRanking(false);
        }
      }
    } catch (err) {
      showToast("Search failed: " + err.message);
      setSearching(false);
      setRanking(false);
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
        } catch { /* ignore */ }
      }

      // Build entry
      const entry = {
        id: String(Date.now()) + "_" + i,
        project_id: projectId,
        created_by: session?.user?.email || "",
        updated_at: new Date().toISOString(),
        url: `https://www.youtube.com/watch?v=${v.videoId}`,
        image_url: (capturedImages[v.videoId]?.length > 0) ? capturedImages[v.videoId][0] : v.thumbnail,
        image_urls: (capturedImages[v.videoId]?.length > 1) ? JSON.stringify(capturedImages[v.videoId].slice(1)) : null,
        description: v.title,
        year: v.year || "",
        type: "Video",
        synopsis: v.description || "",
        transcript,
      };

      // Add communication intent if set
      const vidIntent = videoIntents[v.videoId];
      if (vidIntent) entry.communication_intent = vidIntent;

      // FIX #3: Add analyst notes as analyst_comment
      const note = analystNotes[v.videoId];
      if (note) entry.analyst_comment = note;

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
          // FIX #3: Include analyst notes in AI analysis context
          const contextParts = [
            `Brand: ${v.channel || ""}`,
            transcript ? `Transcript: ${transcript.slice(0, 1500)}` : "",
            note ? `Analyst Notes: ${note}` : "",
          ].filter(Boolean);

          const analyzeRes = await fetch("/api/analyze", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              imageUrl: v.thumbnail,
              context: contextParts.join("\n"),
            }),
          });
          const analysis = await analyzeRes.json();
          if (analysis.success && analysis.analysis) {
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
        } catch { /* ignore */ }
      }
    }

    setImporting(false);
    setImportCount(imported);
    setImportDone(true);
    showToast(`\u2713 ${imported} entries imported`);
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

  const showEmptyState = videos.length === 0 && !searching && !ranking && !importing && !importDone && !savedTab;
  const showResults = (videos.length > 0 || savedTab) && !searching && !importing && !importDone;

  // ─── RENDER ───
  return (
    <AuthGuard><ProjectGuard><Nav />
      <div className="min-h-screen" style={{ background: "var(--bg)" }}>
        {toast && <div className="fixed top-4 right-4 bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium z-50 shadow-lg" style={{ animation: "fadeIn 0.3s" }}>{toast}</div>}
        {preview && <VideoPreview videoId={preview.videoId} title={preview.title} onClose={() => setPreview(null)} />}

        <div className="max-w-5xl mx-auto p-6">

          {/* ─── CONVERSATIONAL HEADER ─── */}
          {showEmptyState && (
            <div className="text-center pt-12 pb-8" style={{ animation: "fadeIn 0.5s" }}>
              <div className="w-16 h-16 mx-auto mb-6 rounded-full flex items-center justify-center" style={{ background: "#0a0f3c" }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              </div>
              <h1 className="text-2xl font-bold text-main mb-2">Scout</h1>
              <p className="text-sm text-muted max-w-md mx-auto">Tell me a brand, a market, or just an idea — I&apos;ll find the competitive content for you</p>
            </div>
          )}

          {/* ─── SEARCH INPUT (chat-style) ─── */}
          <div className={`${!showEmptyState ? "mb-4" : "mb-6"} max-w-2xl mx-auto`}>
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

          {/* ─── SEARCHING STATE (only when no results yet) ─── */}
          {searching && videos.length === 0 && (
            <div className="text-center py-12" style={{ animation: "fadeIn 0.3s" }}>
              <div className="w-12 h-12 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ background: "#0a0f3c" }}>
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="white" strokeWidth="3" fill="none"/><path className="opacity-75" fill="white" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
              </div>
              <p className="text-sm font-medium text-main">{statusMessage}</p>
            </div>
          )}

          {/* FIX #2: Ranking banner — shown above results while ranking is in progress */}
          {ranking && videos.length > 0 && (
            <div className="mb-4 flex items-center gap-3 px-4 py-3 bg-surface border border-main rounded-xl" style={{ animation: "fadeIn 0.3s" }}>
              <svg className="animate-spin h-4 w-4 text-accent flex-shrink-0" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
              <p className="text-sm font-medium text-main">{statusMessage}</p>
              <p className="text-xs text-muted">Scoring {videos.length} videos</p>
            </div>
          )}

          {/* ─── RESULTS ─── */}
          {showResults && (
            <div>
              {/* Results / Saved toggle */}
              <div className="flex items-center gap-2 mb-4">
                <button onClick={() => setSavedTab(false)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${!savedTab ? "bg-[#0019FF] text-white" : "bg-surface border border-main text-muted hover:text-main"}`}>
                  Results ({filteredVideos.length})
                </button>
                <button onClick={() => setSavedTab(true)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${savedTab ? "bg-[#0019FF] text-white" : "bg-surface border border-main text-muted hover:text-main"}`}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill={savedTab ? "white" : "none"} stroke={savedTab ? "white" : "currentColor"} strokeWidth="2"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/></svg>
                  Saved ({savedItems.length})
                </button>
              </div>

              {/* ─── SAVED VIEW ─── */}
              {savedTab && (
                <div className="space-y-3 mb-6">
                  {savedItems.length === 0 && (
                    <div className="text-center py-12 text-sm text-muted">No saved items yet. Click the bookmark icon on any result to save it.</div>
                  )}
                  {savedItems.map(item => {
                    const isExpanded = selected.has(item.video_id);
                    return (
                      <div key={item.id} onClick={() => toggleSelect(item.video_id)}
                        className={`bg-surface border rounded-xl p-4 flex gap-4 cursor-pointer transition ${isExpanded ? "border-[var(--accent)] ring-1 ring-[var(--accent)]" : "border-main hover:border-[var(--accent)]"}`}>
                        {/* Thumbnail */}
                        <div className="w-40 h-24 flex-shrink-0 rounded-lg overflow-hidden bg-surface2 relative cursor-pointer group/thumb"
                          onClick={e => { e.stopPropagation(); setPreview({ videoId: item.video_id, title: item.title }); }}>
                          {item.thumbnail && <img src={item.thumbnail} className="w-full h-full object-cover" alt="" />}
                          <div className="absolute inset-0 bg-black/0 group-hover/thumb:bg-black/30 transition flex items-center justify-center">
                            <div className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center shadow-lg opacity-0 group-hover/thumb:opacity-100 transition">
                              <svg width="14" height="14" viewBox="0 0 20 20" fill="#0a0a0a"><polygon points="6,3 17,10 6,17" /></svg>
                            </div>
                          </div>
                          {item.duration && (
                            <span className="absolute bottom-1 right-1 bg-black/80 text-white text-[10px] px-1.5 py-0.5 rounded font-mono">
                              {formatDuration(item.duration)}
                            </span>
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-semibold text-main leading-snug line-clamp-2">{item.title}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            <p className="text-xs text-muted">{item.channel}</p>
                            <span className="text-xs text-hint">&middot; {formatViews(item.view_count)} views &middot; {item.year}</span>
                          </div>
                          {item.notes && <p className="text-[11px] text-hint mt-1 italic">{item.notes}</p>}
                          <button onClick={e => { e.stopPropagation(); setPreview({ videoId: item.video_id, title: item.title }); }}
                            className="text-[11px] text-accent hover:underline mt-1 inline-block">Watch video</button>

                          {/* Expanded settings — same as search results */}
                          {isExpanded && (
                            <div className="mt-3 pt-3 border-t border-main space-y-3" onClick={e => e.stopPropagation()}>
                              {/* Scope */}
                              <div className="flex items-center gap-3">
                                <label className="text-[10px] text-muted uppercase font-semibold">Import to:</label>
                                <div className="flex bg-surface2 rounded-lg p-0.5">
                                  <button onClick={() => setVideoScopes(prev => ({ ...prev, [item.video_id]: "local" }))}
                                    className={`px-3 py-1 rounded-md text-xs font-medium transition ${(videoScopes[item.video_id] || scope) === "local" ? "bg-surface text-accent shadow-sm" : "text-muted"}`}>Local</button>
                                  <button onClick={() => setVideoScopes(prev => ({ ...prev, [item.video_id]: "global" }))}
                                    className={`px-3 py-1 rounded-md text-xs font-medium transition ${(videoScopes[item.video_id] || scope) === "global" ? "bg-surface text-accent shadow-sm" : "text-muted"}`}>Global</button>
                                </div>
                              </div>
                              {/* Intent */}
                              <div className="flex items-center gap-3">
                                <label className="text-[10px] text-muted uppercase font-semibold">Intent:</label>
                                <select value={videoIntents[item.video_id] || ""} onChange={ev => setVideoIntents(prev => ({ ...prev, [item.video_id]: ev.target.value }))}
                                  className="px-2 py-1 bg-surface border border-main rounded text-xs text-main">
                                  <option value="">— Select —</option>
                                  {INTENT_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                                </select>
                              </div>
                              {/* Video embed + Screenshot capture */}
                              {item.video_id && (
                                <div>
                                  <label className="text-[10px] text-muted uppercase font-semibold mb-1 block">Video & Screenshot Capture</label>
                                  <iframe ref={captureActive === item.video_id ? videoIframeRef : undefined}
                                    width="100%" height="280" style={{ maxWidth: 560, display: "block" }}
                                    src={`https://www.youtube.com/embed/${item.video_id}?rel=0`}
                                    frameBorder="0" allowFullScreen className="rounded-lg" />
                                  {/* Capture tools bar */}
                                  <div className="flex items-center gap-2 mt-2">
                                    {captureActive === item.video_id ? (
                                      <>
                                        <button onClick={() => captureFrame(item.video_id)} disabled={uploading}
                                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition disabled:opacity-50 hover:opacity-90"
                                          style={{ background: "#dc2626" }}>
                                          <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                                          {uploading ? "Saving..." : "Capture frame"}
                                        </button>
                                        {captureCount > 0 && <span className="text-[10px] text-muted">{captureCount} captured</span>}
                                        <button onClick={stopCapture}
                                          className="px-3 py-1.5 text-xs text-muted hover:text-main border border-main rounded-lg transition">
                                          Stop
                                        </button>
                                      </>
                                    ) : (
                                      <>
                                        <button onClick={() => startCapture(item.video_id)}
                                          className="flex items-center gap-1.5 px-3 py-1.5 bg-surface border border-main rounded-lg text-xs font-medium text-muted hover:text-main hover:border-[var(--accent)] transition">
                                          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="5"/><circle cx="8" cy="8" r="2" fill="currentColor"/></svg>
                                          Capture stills
                                        </button>
                                        <div className="h-4 w-px bg-surface2" />
                                        <label className="flex items-center gap-1.5 px-3 py-1.5 bg-surface border border-main rounded-lg text-xs font-medium text-muted hover:text-main hover:border-[var(--accent)] transition cursor-pointer">
                                          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 10v3a1 1 0 01-1 1H3a1 1 0 01-1-1v-3M11 5l-3-3-3 3M8 2v8"/></svg>
                                          Upload images
                                          <input type="file" accept="image/*" multiple onChange={e => handleCaptureFileUpload(item.video_id, [...e.target.files])} className="hidden" />
                                        </label>
                                      </>
                                    )}
                                  </div>
                                  {captureActive === item.video_id && (
                                    <p className="text-[10px] text-muted mt-1">
                                      Play the video and click <strong>Capture frame</strong> at the moments you want. Each click saves a still.
                                    </p>
                                  )}
                                  {/* Filmstrip of captured screenshots */}
                                  {(capturedImages[item.video_id] || []).length > 0 && (
                                    <div className="flex gap-2 items-center mt-2 overflow-x-auto pb-1">
                                      {capturedImages[item.video_id].map((url, i) => (
                                        <div key={i} className="relative group flex-shrink-0">
                                          <img src={url} className="w-16 h-16 object-cover rounded cursor-pointer opacity-80 hover:opacity-100 transition border border-white/10" alt=""
                                            onClick={() => window.open(url, "_blank")} />
                                          <button onClick={() => removeCapturedImage(item.video_id, i)}
                                            className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                                            x
                                          </button>
                                        </div>
                                      ))}
                                      <span className="text-[10px] text-hint flex-shrink-0">{capturedImages[item.video_id].length} still{capturedImages[item.video_id].length !== 1 ? "s" : ""}</span>
                                    </div>
                                  )}
                                </div>
                              )}
                              {/* Transcript */}
                              <div>
                                <div className="flex justify-between items-center mb-1">
                                  <label className="text-[10px] text-muted uppercase font-semibold">Transcript / Copy</label>
                                  <span className="text-[9px] text-hint">Paste here for better AI analysis</span>
                                </div>
                                <textarea value={transcripts[item.video_id] || ""} onChange={e => setTranscripts(prev => ({ ...prev, [item.video_id]: e.target.value }))}
                                  rows={3} placeholder="Paste the video transcript or ad copy here..."
                                  className="w-full px-3 py-2 bg-surface2 border border-main rounded-lg text-xs text-main resize-y focus:outline-none focus:border-[var(--accent)]" />
                              </div>
                              {/* Analyst Notes */}
                              <div>
                                <div className="flex justify-between items-center mb-1">
                                  <label className="text-[10px] text-muted uppercase font-semibold">Analyst Notes</label>
                                  <span className="text-[9px] text-hint">Your observations, sent to AI on import</span>
                                </div>
                                <textarea value={savedNotes[item.id] || ""} onChange={e => handleUpdateSavedNotes(item.id, e.target.value)}
                                  rows={2} placeholder="Add your notes about this video..."
                                  className="w-full px-3 py-2 bg-surface2 border border-main rounded-lg text-xs text-main resize-y focus:outline-none focus:border-[var(--accent)]" />
                              </div>
                              {/* Actions */}
                              <div className="flex items-center gap-2">
                                <button onClick={() => handleImportSaved(item)}
                                  className="px-3 py-1.5 text-white rounded-lg text-xs font-semibold hover:opacity-90 transition" style={{ background: "#0019FF" }}>
                                  Import {autoAnalyze ? "+ AI Analyze" : ""}
                                </button>
                                <button onClick={() => handleRemoveSaved(item.id)}
                                  className="px-3 py-1.5 border border-red-200 text-red-600 rounded-lg text-xs font-semibold hover:bg-red-50 transition">Remove</button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Results header */}
              {!savedTab && <><div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <p className="text-sm text-main font-medium">Found {filteredVideos.length} pieces</p>
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
                      {/* Checkbox + Save */}
                      <div className="flex flex-col items-center gap-2 pt-1">
                        <input type="checkbox" checked={isSelected} disabled={isDuplicate}
                          onChange={() => toggleSelect(v.videoId)}
                          onClick={e => e.stopPropagation()}
                          className="rounded border-gray-300 text-accent" />
                        <button
                          title={savedVideoIds.has(v.videoId) ? "Saved" : "Save for later"}
                          onClick={e => { e.stopPropagation(); if (!savedVideoIds.has(v.videoId)) handleSaveItem(v); }}
                          className={`w-6 h-6 flex items-center justify-center rounded transition ${savedVideoIds.has(v.videoId) ? "text-[#0019FF]" : "text-gray-400 hover:text-[#0019FF]"}`}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill={savedVideoIds.has(v.videoId) ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/></svg>
                        </button>
                      </div>

                      {/* Thumbnail */}
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
                          {savedVideoIds.has(v.videoId) && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-semibold">Saved</span>
                          )}
                          <span className="text-xs text-hint">&middot; {formatViews(v.viewCount)} views &middot; {v.year}</span>
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
                            {/* Video embed + Screenshot capture */}
                            <div>
                              <label className="text-[10px] text-muted uppercase font-semibold mb-1 block">Video & Screenshot Capture</label>
                              <iframe ref={captureActive === v.videoId ? videoIframeRef : undefined}
                                width="100%" height="260" style={{ maxWidth: 520, display: "block" }}
                                src={`https://www.youtube.com/embed/${v.videoId}?rel=0`}
                                frameBorder="0" allowFullScreen className="rounded-lg" />
                              <div className="flex items-center gap-2 mt-2">
                                {captureActive === v.videoId ? (
                                  <>
                                    <button onClick={() => captureFrame(v.videoId)} disabled={uploading}
                                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition disabled:opacity-50 hover:opacity-90"
                                      style={{ background: "#dc2626" }}>
                                      <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                                      {uploading ? "Saving..." : "Capture frame"}
                                    </button>
                                    {captureCount > 0 && <span className="text-[10px] text-muted">{captureCount} captured</span>}
                                    <button onClick={stopCapture} className="px-3 py-1.5 text-xs text-muted hover:text-main border border-main rounded-lg transition">Stop</button>
                                  </>
                                ) : (
                                  <>
                                    <button onClick={() => startCapture(v.videoId)}
                                      className="flex items-center gap-1.5 px-3 py-1.5 bg-surface border border-main rounded-lg text-xs font-medium text-muted hover:text-main hover:border-[var(--accent)] transition">
                                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="5"/><circle cx="8" cy="8" r="2" fill="currentColor"/></svg>
                                      Capture stills
                                    </button>
                                    <label className="flex items-center gap-1.5 px-3 py-1.5 bg-surface border border-main rounded-lg text-xs font-medium text-muted hover:text-main hover:border-[var(--accent)] transition cursor-pointer">
                                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 10v3a1 1 0 01-1 1H3a1 1 0 01-1-1v-3M11 5l-3-3-3 3M8 2v8"/></svg>
                                      Upload images
                                      <input type="file" accept="image/*" multiple onChange={e => handleCaptureFileUpload(v.videoId, [...e.target.files])} className="hidden" />
                                    </label>
                                  </>
                                )}
                              </div>
                              {(capturedImages[v.videoId] || []).length > 0 && (
                                <div className="flex gap-2 items-center mt-2 overflow-x-auto pb-1">
                                  {capturedImages[v.videoId].map((url, i) => (
                                    <div key={i} className="relative group flex-shrink-0">
                                      <img src={url} className="w-16 h-16 object-cover rounded cursor-pointer opacity-80 hover:opacity-100 transition border border-white/10" alt=""
                                        onClick={() => window.open(url, "_blank")} />
                                      <button onClick={() => removeCapturedImage(v.videoId, i)}
                                        className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition">×</button>
                                    </div>
                                  ))}
                                  <span className="text-[10px] text-hint flex-shrink-0">{capturedImages[v.videoId].length} stills</span>
                                </div>
                              )}
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
                            {/* FIX #3: Analyst Notes */}
                            <div>
                              <div className="flex justify-between items-center mb-1">
                                <label className="text-[10px] text-muted uppercase font-semibold">Analyst Notes</label>
                                <span className="text-[9px] text-hint">Your observations, sent to AI on import</span>
                              </div>
                              <textarea
                                value={analystNotes[v.videoId] || ""}
                                onChange={e => setAnalystNotes(prev => ({ ...prev, [v.videoId]: e.target.value }))}
                                rows={2}
                                placeholder="Add your notes about this video..."
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
              </>}
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

          {/* Saved items shortcut from empty state */}
          {showEmptyState && savedItems.length > 0 && (
            <div className="text-center mb-6">
              <button onClick={() => setSavedTab(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-surface border border-main rounded-full text-xs text-muted hover:text-accent hover:border-[var(--accent)] transition">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/></svg>
                View saved items ({savedItems.length})
              </button>
            </div>
          )}

          {/* Quick suggestions carousel when no results */}
          {showEmptyState && (() => {
            const items = suggestions.length > 0 ? suggestions : ["Starling Bank", "Tide business", "RBC small business", "Monzo business account", "BBVA SME"];
            const looped = [...items, ...items, ...items];
            return (
              <div className="max-w-2xl mx-auto">
                <p className="text-[10px] text-hint uppercase font-semibold tracking-wider mb-3 text-center">Try searching for</p>
                <div className="relative overflow-hidden group/carousel">
                  <div className="absolute left-0 top-0 bottom-0 w-16 z-10 pointer-events-none" style={{ background: "linear-gradient(to right, var(--bg), transparent)" }} />
                  <div className="absolute right-0 top-0 bottom-0 w-16 z-10 pointer-events-none" style={{ background: "linear-gradient(to left, var(--bg), transparent)" }} />
                  <div className="flex gap-2.5 py-1 group-hover/carousel:[animation-play-state:paused]"
                    style={{ animation: "scoutCarousel 25s linear infinite", width: "max-content" }}>
                    {looped.map((q, i) => (
                      <button key={`${q}-${i}`} onClick={() => { setBrand(q); setTimeout(() => handleSearch(), 150); }}
                        className="px-4 py-2 bg-surface border border-main rounded-full text-xs text-muted hover:text-accent hover:border-[var(--accent)] hover:bg-accent-soft transition whitespace-nowrap flex-shrink-0">{q}</button>
                    ))}
                  </div>
                </div>
                <style>{`@keyframes scoutCarousel { 0% { transform: translateX(0); } 100% { transform: translateX(-33.33%); } }`}</style>
              </div>
            );
          })()}
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
                                <span className="text-accent mt-0.5">&bull;</span>
                                <div>
                                  <a href={b.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-main hover:text-accent transition underline underline-offset-2 decoration-dotted">{b.name}</a>
                                  <span className="text-muted ml-1">&mdash; {b.desc}</span>
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
                        const formatted = line.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
                        const isBullet = /^[\s]*[-\u2022\u00b7]/.test(line);
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
// force-redeploy 1773848494
