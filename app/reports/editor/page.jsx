"use client";
import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { useProject } from "@/lib/project-context";
import { useRole } from "@/lib/role-context";
import Nav from "@/components/Nav";
import AuthGuard from "@/components/AuthGuard";
import ProjectGuard from "@/components/ProjectGuard";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

/* ─── MARKDOWN TOOLBAR ─── */
function ToolbarButton({ label, icon, action, textareaRef }) {
  const handleClick = () => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const text = ta.value;
    const selected = text.substring(start, end);
    const { before, after, placeholder } = action;
    const insert = selected || placeholder || "";
    const newText = text.substring(0, start) + before + insert + after + text.substring(end);
    ta.value = newText;
    ta.focus();
    const cursorPos = start + before.length + insert.length;
    ta.setSelectionRange(cursorPos, cursorPos);
    // Trigger React onChange
    const ev = new Event("input", { bubbles: true });
    ta.dispatchEvent(ev);
  };
  return (
    <button onClick={handleClick} title={label}
      className="px-2 py-1 text-xs text-muted hover:text-main hover:bg-surface2 rounded transition">
      {icon}
    </button>
  );
}

/* ─── MAIN COMPONENT ─── */
function EditorContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reportId = searchParams.get("id");
  const { projectId } = useProject();
  const { role } = useRole();
  const supabase = createClient();
  const textareaRef = useRef(null);

  // State
  const [report, setReport] = useState(null);
  const [content, setContent] = useState("");
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState("write"); // write | preview
  const [saved, setSaved] = useState(true);
  const [saving, setSaving] = useState(false);

  // Copilot
  const [copilotOpen, setCopilotOpen] = useState(true);
  const [copilotLoading, setCopilotLoading] = useState(false);
  const [suggestions, setSuggestions] = useState(null);
  const [lastSection, setLastSection] = useState("");
  const copilotTimer = useRef(null);

  // Knowledge
  const [knowledgeFiles, setKnowledgeFiles] = useState([]);
  const [uploading, setUploading] = useState(false);

  // Audit data for copilot context
  const [auditSummary, setAuditSummary] = useState("");

  // @ mention system
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionPos, setMentionPos] = useState({ top: 0, left: 0 });
  const [mentionStart, setMentionStart] = useState(-1); // cursor position of @
  const [allEntries, setAllEntries] = useState([]);

  /* ─── LOAD REPORT ─── */
  useEffect(() => {
    if (!reportId || !projectId) return;
    (async () => {
      const { data } = await supabase.from("saved_reports").select("*").eq("id", reportId).single();
      if (data) {
        setReport(data);
        setContent(data.content || "");
        setTitle(data.title || "");
      }

      // Load knowledge files
      const { data: kFiles } = await supabase.from("report_knowledge").select("*").eq("report_id", reportId);
      setKnowledgeFiles(kFiles || []);

      // Load all entries for @ mentions and copilot
      const scope = data?.scope || "local";
      const [localRes, globalRes] = await Promise.all([
        supabase.from("audit_entries").select("id,competitor,description,year,type,rating,image_url,url,communication_intent,primary_territory,tone_of_voice,brand_archetype,portrait,journey_phase,insight,idea").eq("project_id", projectId),
        supabase.from("audit_global").select("id,brand,description,year,type,rating,image_url,url,communication_intent,primary_territory,tone_of_voice,brand_archetype,portrait,journey_phase,insight,idea").eq("project_id", projectId),
      ]);
      const allE = [
        ...(localRes.data || []).map(e => ({ ...e, brand: e.competitor })),
        ...(globalRes.data || []),
      ];
      setAllEntries(allE);
      const entries = allE;
      const summary = (entries || []).map(e =>
        `${e.competitor || e.brand}: "${e.description}" (${e.year}, ${e.type}) — Insight: ${e.insight || "N/A"}, Territory: ${e.primary_territory || "N/A"}, Portrait: ${e.portrait || "N/A"}, Intent: ${e.communication_intent || "N/A"}, Rating: ${e.rating || "N/A"}`
      ).join("\n");
      setAuditSummary(summary);

      setLoading(false);
    })();
  }, [reportId, projectId]);

  /* ─── AUTOSAVE ─── */
  const saveContent = useCallback(async () => {
    if (!reportId) return;
    setSaving(true);
    await supabase.from("saved_reports").update({
      content,
      title,
      updated_at: new Date().toISOString(),
    }).eq("id", reportId);
    setSaving(false);
    setSaved(true);
  }, [content, title, reportId]);

  // Autosave every 5 seconds when content changes
  useEffect(() => {
    if (saved) return;
    const timer = setTimeout(saveContent, 5000);
    return () => clearTimeout(timer);
  }, [content, saved, saveContent]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        saveContent();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [saveContent]);

  /* ─── COPILOT ─── */
  const getCurrentSection = () => {
    if (!textareaRef.current) return "";
    const ta = textareaRef.current;
    const pos = ta.selectionStart;
    const text = ta.value;

    // Find the ## heading above cursor
    const before = text.substring(0, pos);
    const headingMatch = before.match(/(?:^|\n)(#{1,3}\s+.+)(?:\n|$)/g);
    const lastHeading = headingMatch ? headingMatch[headingMatch.length - 1].trim() : "";

    // Find text from last heading to next heading or end
    const headingPos = text.lastIndexOf(lastHeading, pos);
    if (headingPos === -1) return text.substring(Math.max(0, pos - 500), Math.min(text.length, pos + 500));

    const afterHeading = text.substring(headingPos);
    const nextHeading = afterHeading.substring(1).search(/\n#{1,3}\s/);
    const sectionText = nextHeading === -1 ? afterHeading : afterHeading.substring(0, nextHeading + 1);
    return sectionText.substring(0, 1500);
  };

  const fetchCopilotSuggestions = async (section) => {
    if (!section.trim() || section === lastSection) return;
    setLastSection(section);
    setCopilotLoading(true);

    const knowledgeContext = knowledgeFiles.map(f => `[${f.file_name}]: ${(f.extracted_text || "").substring(0, 3000)}`).join("\n\n");

    // Get section headings from content
    const headings = content.match(/^#{1,3}\s+.+$/gm) || [];

    try {
      const res = await fetch("/api/ai/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentSection: section,
          reportTitle: title,
          sectionHeadings: headings.join(" | "),
          auditSummary,
          knowledgeContext: knowledgeContext || undefined,
        }),
      });
      const data = await res.json();
      if (!data.error) setSuggestions(data);
    } catch {}
    setCopilotLoading(false);
  };

  const handleCursorChange = () => {
    if (copilotTimer.current) clearTimeout(copilotTimer.current);
    copilotTimer.current = setTimeout(() => {
      const section = getCurrentSection();
      if (section.trim()) fetchCopilotSuggestions(section);
    }, 1200);
  };

  const insertAtCursor = (text) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const pos = ta.selectionStart;
    const before = content.substring(0, pos);
    const after = content.substring(pos);
    const newContent = before + text + after;
    setContent(newContent);
    setSaved(false);
    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(pos + text.length, pos + text.length);
    }, 50);
  };

  /* ─── KNOWLEDGE FILE UPLOAD ─── */
  const uploadKnowledgeFile = async (file) => {
    if (!file) return;
    setUploading(true);

    // Upload to Supabase storage
    const path = `knowledge/${projectId}/${reportId}/${Date.now()}_${file.name}`;
    const { error: uploadError } = await supabase.storage.from("media").upload(path, file);
    if (uploadError) { setUploading(false); return; }

    // Extract text
    let extractedText = "";
    if (file.name.endsWith(".txt")) {
      extractedText = await file.text();
    } else if (file.name.endsWith(".md")) {
      extractedText = await file.text();
    } else {
      // For PDF/docx, read as text (basic — full extraction would need pdfjs-dist)
      try { extractedText = await file.text(); } catch {}
    }

    // Save to database
    const { data: saved } = await supabase.from("report_knowledge").insert({
      report_id: reportId,
      project_id: projectId,
      file_name: file.name,
      storage_path: path,
      extracted_text: extractedText.substring(0, 50000),
      file_size: file.size,
    }).select().single();

    if (saved) setKnowledgeFiles(prev => [...prev, saved]);
    setUploading(false);
  };

  const deleteKnowledgeFile = async (id, path) => {
    await supabase.from("report_knowledge").delete().eq("id", id);
    await supabase.storage.from("media").remove([path]);
    setKnowledgeFiles(prev => prev.filter(f => f.id !== id));
  };

  /* ─── GENERATE SHOWCASE FROM REPORT ─── */
  const [generatingShowcase, setGeneratingShowcase] = useState(false);

  const generateShowcase = async () => {
    setGeneratingShowcase(true);
    const isAgnostic = report?.template_type === "agnostic_snapshot";

    const creativeSystemPrompt = `You are a senior creative strategist at Knots & Dots. Transform this competitive intelligence report into a cinematic showcase presentation.

STRUCTURE:
1. type:"title" — Opening. Fields: title, subtitle, client, objective
2. type:"key_findings" — Summary. Fields: title, findings (array of {number, heading, summary})
3. Multiple type:"finding" — One per key insight. Fields: title, body (markdown), brand, year, country, territory, image_url, media_url, media_type, entry_id
4. type:"takeaways" — Strategic considerations. Fields: title, takeaways (array of strings)
5. type:"closing" — Final slide. Fields: title, subtitle

RULES:
- Extract the most compelling findings from the report
- Transform analytical prose into bold, provocative slide headlines
- Keep body text concise
- ALL output in English
- Return ONLY valid JSON: {"title":"...","slides":[...]}`;

    const csSystemPrompt = `You are reformatting an Agnostic Competitor Snapshot report into a structured slide deck.

CRITICAL: Do NOT generate new analysis or narrative. EXTRACT the content that already exists in the report and map it to the slide fields below. The report already has sections 01 through 07 — each maps directly to a slide. Shorten text for scannability but preserve the original findings, not invent new ones.

This is framework-agnostic. No portraits, entry doors, journey phases, richness definitions, moments that matter, or client lifecycle.

MAPPING — Report section → Slide:
- Report "## 01 — Understanding the Audience" → SLIDE 2 (cs_audience): extract the Demographic, Psychographic, Tension, and Human Insight fields exactly as written in the report. Tighten for slide format.
- Report "## 02 — The Brand Response" → SLIDE 3 (cs_brand_response): extract the Creative Proposition, Brand Archetype, Brand Role, Emotional Positioning Statement, Rational Positioning Statement, Brand Territory, and Key Differentiators exactly from the report.
- Report "## 03 — Proof Points & Communication Strategy" → SLIDE 4 (cs_proof_points): extract Primary Proof Point, Secondary Proof Points, Communication Focus, and Tone & Voice from the report.
- Report "## 04 — Product Communication" → SLIDE 5 (cs_product): extract Approach, Key Product Messages, Channels & Formats, and Gap from the report.
- Report "## 05 — Beyond Banking & Innovation" → SLIDE 6 (cs_beyond_banking): extract Beyond Banking, Innovation, and White Space from the report.
- Report "## 06 — Brand Assessment" → SLIDE 7 (cs_brand_assessment): extract the Strengths and Weaknesses. If the report has a combined assessment, split into brand-focused items.
- Report "## 07 — Communication Assessment" → SLIDE 8 (cs_comm_assessment): extract the Strengths and Weaknesses focused on communication.

Return a JSON object with EXACTLY 9 slides:

SLIDE 1: type:"cs_title" — Fields: brand (string — the brand name from the report), scope (string — "Local Audit", "Global Benchmark", or "Local + Global"), date ("${new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" })}"), entry_count (number — count from the report if mentioned, otherwise 0), subtitle ("Competitive Communication Snapshot")

SLIDE 2: type:"cs_audience" — Fields: demographic (string — short scannable text), psychographic (string — 2-3 short lines), tension (string — 1-2 sentences), human_insight (string — first-person quote 20-35 words, in the voice of the target audience)

SLIDE 3: type:"cs_brand_response" — Fields: creative_proposition (string — 3-6 words), proposition_description (string — one line), brand_archetype (string — name + one sentence), brand_role (string — one sentence), emotional_positioning (string — 5-10 words), rational_positioning (string — 15-25 words), brand_territory (string — primary + secondary), key_differentiators (array of 3 strings)

SLIDE 4: type:"cs_proof_points" — Fields: creative_proposition (string — same as slide 3), primary_proof (string — 1-2 sentences), secondary_proofs (array of 3 strings), communication_focus (string — 1-2 sentences), tone_voice (array of 3 string labels)

SLIDE 5: type:"cs_product" — Fields: approach (string — one sentence), key_messages (array of 3 strings), channels_formats (string), gap (string — one sentence insight)

SLIDE 6: type:"cs_beyond_banking" — Fields: beyond_banking (string — one paragraph), innovation (string — one paragraph), white_space (string — one sentence insight)

SLIDE 7: type:"cs_brand_assessment" — Fields: strengths (array of 3 {label: string, explanation: string}), weaknesses (array of 2 {label: string, explanation: string}). Assesses the BRAND itself.

SLIDE 8: type:"cs_comm_assessment" — Fields: strengths (array of 3 {label: string, explanation: string}), weaknesses (array of 2 {label: string, explanation: string}). Assesses COMMUNICATION across proof points, product, beyond banking.

SLIDE 9: type:"cs_closing" — Fields: title ("Thank You"), subtitle ("Generated by Knots & Dots — Category Landscape Platform"), date ("${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}")

Return ONLY valid JSON: {"title":"...","slides":[...]}`;

    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          use_opus: true,
          max_tokens: 8000,
          system: isAgnostic ? csSystemPrompt : creativeSystemPrompt,
          messages: [{ role: "user", content: `Transform this report into a ${isAgnostic ? "Competitor Snapshot showcase" : "showcase presentation"}:\n\n${content}` }],
        }),
      });

      const data = await res.json();
      const text = data.content?.[0]?.text || "";
      let parsed;
      try { parsed = JSON.parse(text); } catch {
        const m = text.match(/\{[\s\S]*\}/);
        if (m) parsed = JSON.parse(m[0]); else throw new Error("Could not parse");
      }

      const { data: { session } } = await supabase.auth.getSession();
      const { data: showcase } = await supabase.from("saved_showcases").insert({
        title: parsed.title || title || "Showcase",
        project_id: projectId,
        slides: parsed.slides || [],
        created_by: session?.user?.email || "",
        filters: {
          source_report_id: reportId,
          ...(isAgnostic ? { showcaseType: "competitor_snapshot" } : {}),
        },
      }).select().single();

      if (showcase) router.push(`/showcase?view=${showcase.id}`);
    } catch (err) {
      alert("Error generating showcase: " + err.message);
    }
    setGeneratingShowcase(false);
  };

  /* ─── TOOLBAR ACTIONS ─── */
  const toolbarActions = [
    { label: "Bold", icon: "B", action: { before: "**", after: "**", placeholder: "bold text" } },
    { label: "Italic", icon: "I", action: { before: "_", after: "_", placeholder: "italic" } },
    { label: "Heading 2", icon: "H2", action: { before: "\n## ", after: "\n", placeholder: "Heading" } },
    { label: "Heading 3", icon: "H3", action: { before: "\n### ", after: "\n", placeholder: "Subheading" } },
    { label: "Bullet list", icon: "•", action: { before: "\n- ", after: "", placeholder: "Item" } },
    { label: "Numbered list", icon: "1.", action: { before: "\n1. ", after: "", placeholder: "Item" } },
    { label: "Quote", icon: "Q", action: { before: "\n> ", after: "\n", placeholder: "Quote" } },
  ];

  if (loading) return <div className="min-h-screen flex items-center justify-center"><p className="text-hint">Loading editor...</p></div>;
  if (!report) return <div className="min-h-screen flex items-center justify-center"><p className="text-hint">Report not found</p></div>;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--bg)" }}>
      {/* Section bar */}
      <div className="section-bar px-5 py-2.5 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <button onClick={async() => { if(!saved) await saveContent(); router.push(`/reports?report=${reportId}`); }} className="text-muted hover:text-main text-sm">← Back to report</button>
          <div className="w-px h-5 bg-main opacity-20" />
          <input value={title} onChange={e => { setTitle(e.target.value); setSaved(false); }}
            className="text-lg font-bold text-main bg-transparent border-none focus:outline-none w-[300px]"
            placeholder="Report title" />
          {!saved && <span className="text-[9px] text-hint">Unsaved</span>}
          {saving && <span className="text-[9px] text-accent">Saving...</span>}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={async()=>{await saveContent();router.push(`/reports?report=${reportId}`);}} disabled={saving}
            className="px-3 py-1.5 text-xs bg-accent text-white rounded-lg font-semibold hover:opacity-90 transition">
            {saving?"Saving...":"Save & Close"}
          </button>
          <button onClick={saveContent} disabled={saving}
            className="px-3 py-1.5 text-xs border border-main rounded-lg text-muted hover:text-main transition">
            {saving?"Saving...":"Save"}
          </button>
          <button onClick={generateShowcase} disabled={generatingShowcase}
            className="px-3 py-1.5 text-xs text-white rounded-lg font-medium transition hover:opacity-90 disabled:opacity-50"
            style={{ background: "#0019FF" }}>
            {generatingShowcase ? "Generating..." : "Generate Showcase"}
          </button>
        </div>
      </div>

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Editor panel */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Toolbar */}
          <div className="bg-surface border-b border-main px-4 py-1.5 flex items-center justify-between">
            <div className="flex items-center gap-0.5">
              {toolbarActions.map(t => (
                <ToolbarButton key={t.label} {...t} textareaRef={textareaRef} />
              ))}
            </div>
            <div className="flex bg-surface2 rounded-lg p-0.5">
              <button onClick={() => setMode("write")}
                className={`px-3 py-1 rounded-md text-xs font-medium transition ${mode === "write" ? "bg-surface text-accent shadow-sm" : "text-muted"}`}>
                Write
              </button>
              <button onClick={() => setMode("preview")}
                className={`px-3 py-1 rounded-md text-xs font-medium transition ${mode === "preview" ? "bg-surface text-accent shadow-sm" : "text-muted"}`}>
                Preview
              </button>
            </div>
          </div>

          {/* Editor / Preview */}
          <div className="flex-1 overflow-auto">
            {mode === "write" ? (
              <div className="relative w-full h-full">
              <textarea
                ref={textareaRef}
                value={content}
                onChange={e => {
                  const val = e.target.value;
                  setContent(val); setSaved(false);
                  // Detect @ mention
                  const pos = e.target.selectionStart;
                  const textBefore = val.substring(0, pos);
                  const atMatch = textBefore.match(/@([^\s@]*)$/);
                  if (atMatch) {
                    setMentionOpen(true);
                    setMentionQuery(atMatch[1]);
                    setMentionStart(pos - atMatch[0].length);
                    // Position popup near cursor
                    const ta = e.target;
                    const lineHeight = 22;
                    const lines = textBefore.split("\n");
                    const lineNum = lines.length;
                    const top = Math.min(lineNum * lineHeight + 8, ta.clientHeight - 200);
                    setMentionPos({ top, left: 24 });
                  } else {
                    setMentionOpen(false);
                  }
                }}
                onKeyDown={e => {
                  if (mentionOpen && e.key === "Escape") { setMentionOpen(false); e.preventDefault(); }
                }}
                onKeyUp={handleCursorChange}
                onClick={e => { handleCursorChange(e); setMentionOpen(false); }}
                className="w-full h-full p-6 bg-surface text-sm text-main font-mono leading-relaxed resize-none focus:outline-none"
                placeholder="Start editing your report... Type @ to insert a case reference"
                spellCheck={false}
              />
              {/* @ Mention popup */}
              {mentionOpen && (() => {
                const q = mentionQuery.toLowerCase();
                const results = allEntries.filter(e =>
                  (e.description||"").toLowerCase().includes(q) ||
                  (e.brand||"").toLowerCase().includes(q) ||
                  (e.competitor||"").toLowerCase().includes(q) ||
                  (e.type||"").toLowerCase().includes(q)
                ).slice(0, 8);
                if (results.length === 0 && q.length > 0) return null;
                return (
                  <div className="absolute bg-surface border border-main rounded-xl shadow-2xl z-50 w-[400px] max-h-[280px] overflow-y-auto"
                    style={{ top: mentionPos.top, left: mentionPos.left }}>
                    <p className="text-[9px] text-hint uppercase font-semibold px-3 pt-2 pb-1">Insert case reference</p>
                    {(q.length === 0 ? allEntries.slice(0, 8) : results).map((entry, i) => {
                      const ytMatch = (entry.url||"").match(/(?:youtube\.com\/watch\?.*v=|youtu\.be\/)([^&\s]+)/);
                      const thumb = ytMatch ? `https://img.youtube.com/vi/${ytMatch[1]}/mqdefault.jpg` : entry.image_url;
                      return (
                        <button key={i} className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-accent-soft transition"
                          onMouseDown={e => {
                            e.preventDefault(); // prevent textarea blur
                            const ta = textareaRef.current;
                            if (!ta) return;
                            // Build citation text
                            const label = (entry.description || entry.brand || "source").slice(0, 50).replace(/[\[\]]/g, "");
                            const citation = `[${label}](cite:${entry.id})`;
                            // Replace @query with citation
                            const before = content.substring(0, mentionStart);
                            const after = content.substring(ta.selectionStart);
                            const newContent = before + citation + after;
                            setContent(newContent);
                            setSaved(false);
                            setMentionOpen(false);
                            // Restore focus
                            setTimeout(() => {
                              ta.focus();
                              const newPos = mentionStart + citation.length;
                              ta.setSelectionRange(newPos, newPos);
                            }, 50);
                          }}>
                          {thumb && <img src={thumb} className="w-10 h-8 object-cover rounded flex-shrink-0" alt="" />}
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-main truncate">{entry.description || "—"}</p>
                            <div className="flex gap-2">
                              {entry.brand && <span className="text-[10px] text-accent">{entry.brand}</span>}
                              {entry.year && <span className="text-[10px] text-hint">{entry.year}</span>}
                              {entry.communication_intent && <span className="text-[10px] text-hint">{entry.communication_intent}</span>}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                );
              })()}
              </div>
            ) : (
              <div className="p-6 bg-surface prose prose-sm max-w-none">
                <Markdown remarkPlugins={[remarkGfm]}>{content}</Markdown>
              </div>
            )}
          </div>

          {/* Knowledge files bar */}
          <div className="bg-surface border-t border-main px-4 py-2 flex items-center gap-3">
            <span className="text-[10px] text-muted uppercase font-semibold">Reference docs:</span>
            <div className="flex gap-2 flex-1 overflow-x-auto">
              {knowledgeFiles.map(f => (
                <div key={f.id} className="flex items-center gap-1.5 px-2 py-1 bg-surface2 rounded-lg text-xs text-main group flex-shrink-0">
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 1H4a1 1 0 00-1 1v12a1 1 0 001 1h8a1 1 0 001-1V5L9 1z"/><path d="M9 1v4h4"/></svg>
                  <span className="max-w-[120px] truncate">{f.file_name}</span>
                  <button onClick={() => deleteKnowledgeFile(f.id, f.storage_path)}
                    className="text-hint hover:text-red-400 opacity-0 group-hover:opacity-100 transition">×</button>
                </div>
              ))}
            </div>
            <label className="px-2 py-1 text-xs text-muted hover:text-main border border-dashed border-main rounded-lg cursor-pointer hover:border-[var(--accent)] transition flex-shrink-0">
              {uploading ? "Uploading..." : "+ Add file"}
              <input type="file" accept=".pdf,.docx,.doc,.txt,.md" onChange={e => uploadKnowledgeFile(e.target.files?.[0])} className="hidden" />
            </label>
          </div>
        </div>

        {/* Copilot sidebar */}
        {copilotOpen && (
          <div className="w-[320px] bg-surface border-l border-main flex flex-col overflow-hidden flex-shrink-0">
            <div className="px-4 py-3 border-b border-main flex justify-between items-center flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ background: copilotLoading ? "#d97706" : "#059669" }} />
                <span className="text-xs font-semibold text-main">AI Copilot</span>
              </div>
              <button onClick={() => setCopilotOpen(false)} className="text-hint hover:text-main text-sm">×</button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {copilotLoading && (
                <div className="text-center py-6">
                  <div className="flex justify-center gap-1 mb-2">
                    <span className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                  <p className="text-[10px] text-hint">Reading your section...</p>
                </div>
              )}

              {!copilotLoading && !suggestions && (
                <div className="text-center py-10">
                  <p className="text-xs text-muted">Start editing to activate the copilot</p>
                  <p className="text-[10px] text-hint mt-1">It reads your current section and suggests ideas</p>
                </div>
              )}

              {suggestions && !copilotLoading && (
                <>
                  {/* Related entries */}
                  {suggestions.related_entries?.length > 0 && (
                    <div>
                      <p className="text-[10px] text-muted uppercase font-semibold mb-2">Related entries</p>
                      {suggestions.related_entries.map((e, i) => (
                        <div key={i} className="bg-surface2 rounded-lg p-2.5 mb-1.5 cursor-pointer hover:bg-accent-soft transition group"
                          onClick={() => insertAtCursor(`\n\n> **${e.brand}**: ${e.relevance}\n`)}>
                          <p className="text-xs font-medium text-main">{e.brand}</p>
                          <p className="text-[10px] text-muted mt-0.5">{e.description}</p>
                          <p className="text-[10px] text-hint mt-0.5 italic">{e.relevance}</p>
                          <p className="text-[9px] text-accent mt-1 opacity-0 group-hover:opacity-100">Click to insert</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Alternative angles */}
                  {suggestions.alternative_angles?.length > 0 && (
                    <div>
                      <p className="text-[10px] text-muted uppercase font-semibold mb-2">Consider also</p>
                      {suggestions.alternative_angles.map((a, i) => (
                        <div key={i} className="bg-surface2 rounded-lg p-2.5 mb-1.5 cursor-pointer hover:bg-accent-soft transition group"
                          onClick={() => insertAtCursor(`\n\n${a}\n`)}>
                          <p className="text-xs text-main">{a}</p>
                          <p className="text-[9px] text-accent mt-1 opacity-0 group-hover:opacity-100">Click to insert</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Framework connections */}
                  {suggestions.framework_connections?.length > 0 && (
                    <div>
                      <p className="text-[10px] text-muted uppercase font-semibold mb-2">Framework</p>
                      {suggestions.framework_connections.map((f, i) => (
                        <div key={i} className="bg-surface2 rounded-lg p-2.5 mb-1.5 cursor-pointer hover:bg-accent-soft transition group"
                          onClick={() => insertAtCursor(`\n\n> ${f}\n`)}>
                          <p className="text-xs text-main">{f}</p>
                          <p className="text-[9px] text-accent mt-1 opacity-0 group-hover:opacity-100">Click to insert</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Data points */}
                  {suggestions.data_points?.length > 0 && (
                    <div>
                      <p className="text-[10px] text-muted uppercase font-semibold mb-2">Data points</p>
                      {suggestions.data_points.map((d, i) => (
                        <div key={i} className="bg-surface2 rounded-lg p-2.5 mb-1.5 cursor-pointer hover:bg-accent-soft transition group"
                          onClick={() => insertAtCursor(` ${d} `)}>
                          <p className="text-xs text-main">{d}</p>
                          <p className="text-[9px] text-accent mt-1 opacity-0 group-hover:opacity-100">Click to insert</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* From knowledge */}
                  {suggestions.from_knowledge?.length > 0 && (
                    <div>
                      <p className="text-[10px] text-muted uppercase font-semibold mb-2">From your documents</p>
                      {suggestions.from_knowledge.map((k, i) => (
                        <div key={i} className="bg-surface2 rounded-lg p-2.5 mb-1.5 cursor-pointer hover:bg-accent-soft transition group"
                          onClick={() => insertAtCursor(`\n\n> ${k}\n`)}>
                          <p className="text-xs text-main">{k}</p>
                          <p className="text-[9px] text-accent mt-1 opacity-0 group-hover:opacity-100">Click to insert</p>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Copilot toggle when closed */}
      {!copilotOpen && (
        <button onClick={() => setCopilotOpen(true)}
          className="fixed right-4 top-1/2 -translate-y-1/2 bg-surface border border-main rounded-l-xl px-2 py-4 shadow-lg hover:bg-surface2 transition z-40"
          style={{ writingMode: "vertical-rl" }}>
          <span className="text-[10px] text-muted font-semibold uppercase tracking-wider">AI Copilot</span>
        </button>
      )}
    </div>
  );
}

export default function EditorPage() {
  return (
    <AuthGuard><ProjectGuard><Nav />
      <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><p className="text-hint">Loading...</p></div>}>
        <EditorContent />
      </Suspense>
    </ProjectGuard></AuthGuard>
  );
}
