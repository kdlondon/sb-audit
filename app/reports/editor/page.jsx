"use client";
import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { useProject } from "@/lib/project-context";
import { useRole } from "@/lib/role-context";
import AuthGuard from "@/components/AuthGuard";
import ProjectGuard from "@/components/ProjectGuard";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";

/* ─── Markdown ↔ HTML helpers ─── */
function mdToHtml(md) {
  if (!md) return "";
  return md
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/_(.+?)_/g, "<em>$1</em>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/\[([^\]]+)\]\(cite:([^)]+)\)/g, '<a href="cite:$2" data-cite="$2">$1</a>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>[\s\S]*?<\/li>)/g, "<ul>$1</ul>")
    .replace(/<\/ul>\s*<ul>/g, "")
    .replace(/\n\n/g, "</p><p>")
    .replace(/\n/g, "<br>")
    .replace(/^(?!<)/, "<p>")
    .replace(/(?!>)$/, "</p>")
    .replace(/<p><h/g, "<h").replace(/<\/h([123])><\/p>/g, "</h$1>")
    .replace(/<p><ul>/g, "<ul>").replace(/<\/ul><\/p>/g, "</ul>");
}

function htmlToMd(html) {
  if (!html) return "";
  return html
    .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, "\n\n# $1\n\n")
    .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, "\n\n## $1\n\n")
    .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, "\n\n### $1\n\n")
    .replace(/<strong>([\s\S]*?)<\/strong>/gi, "**$1**")
    .replace(/<b>([\s\S]*?)<\/b>/gi, "**$1**")
    .replace(/<em>([\s\S]*?)<\/em>/gi, "*$1*")
    .replace(/<i>([\s\S]*?)<\/i>/gi, "*$1*")
    .replace(/<u>([\s\S]*?)<\/u>/gi, "$1")
    .replace(/<li>([\s\S]*?)<\/li>/gi, "- $1\n")
    .replace(/<\/?[uo]l[^>]*>/gi, "\n")
    .replace(/<a[^>]*data-cite="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, "[$2](cite:$1)")
    .replace(/<a[^>]*href="cite:([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, "[$2](cite:$1)")
    .replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, "[$2]($1)")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>\s*<p[^>]*>/gi, "\n\n")
    .replace(/<\/?p[^>]*>/gi, "")
    .replace(/<\/?div[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ").replace(/&#39;/g, "'").replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/* ─── Toolbar Button ─── */
function TBar({ editor }) {
  if (!editor) return null;
  const btn = (active, onClick, label, icon) => (
    <button onClick={onClick} title={label}
      className={`px-2 py-1 text-xs rounded transition ${active ? "bg-accent-soft text-accent font-bold" : "text-muted hover:text-main hover:bg-surface2"}`}>
      {icon}
    </button>
  );
  return (
    <div className="flex items-center gap-0.5 flex-wrap">
      {btn(editor.isActive("bold"), () => editor.chain().focus().toggleBold().run(), "Bold", "B")}
      {btn(editor.isActive("italic"), () => editor.chain().focus().toggleItalic().run(), "Italic", <em>I</em>)}
      {btn(editor.isActive("underline"), () => editor.chain().focus().toggleUnderline().run(), "Underline", <u>U</u>)}
      <div className="w-px h-4 bg-main mx-1" />
      {btn(editor.isActive("heading", { level: 2 }), () => editor.chain().focus().toggleHeading({ level: 2 }).run(), "Heading 2", "H2")}
      {btn(editor.isActive("heading", { level: 3 }), () => editor.chain().focus().toggleHeading({ level: 3 }).run(), "Heading 3", "H3")}
      <div className="w-px h-4 bg-main mx-1" />
      {btn(editor.isActive("bulletList"), () => editor.chain().focus().toggleBulletList().run(), "Bullet list", "•")}
      {btn(editor.isActive("orderedList"), () => editor.chain().focus().toggleOrderedList().run(), "Numbered list", "1.")}
      <div className="w-px h-4 bg-main mx-1" />
      {btn(editor.isActive("blockquote"), () => editor.chain().focus().toggleBlockquote().run(), "Quote", "❝")}
      {btn(false, () => editor.chain().focus().setHorizontalRule().run(), "Divider", "—")}
    </div>
  );
}

/* ─── MAIN COMPONENT ─── */
function EditorContent2() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reportId = searchParams.get("id");
  const { projectId, brandId } = useProject() || {};
  const filterField = brandId ? "brand_id" : "project_id";
  const filterValue = brandId || projectId;
  const { role } = useRole() || {};
  const supabase = createClient();

  const [report, setReport] = useState(null);
  const [markdownContent, setMarkdownContent] = useState("");
  const markdownRef = useRef("");
  const [title, setTitle] = useState("");
  const titleRef = useRef("");
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState("visual");

  // @ mention
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionIdx, setMentionIdx] = useState(0);
  const [allEntries, setAllEntries] = useState([]);

  // TipTap editor
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Link.configure({ openOnClick: false, protocols: ["cite"], HTMLAttributes: { class: "text-accent underline decoration-dotted cursor-pointer" } }),
      Underline,
    ],
    editorProps: {
      attributes: { class: "prose prose-sm md:prose-base max-w-none focus:outline-none min-h-[400px] dark:prose-invert prose-headings:text-[var(--text)] prose-p:text-[var(--text2)] prose-strong:text-[var(--text)] prose-li:text-[var(--text2)] prose-h2:border-b prose-h2:border-[var(--border)] prose-h2:pb-2 prose-h2:mt-8 prose-h3:mt-6" },
      handleKeyDown: (view, event) => {
        if (event.key === "@") {
          event.preventDefault();
          setMentionOpen(true);
          setMentionQuery("");
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor }) => {
      setSaved(false);
      const md = htmlToMd(editor.getHTML());
      setMarkdownContent(md);
      markdownRef.current = md;
    },
  });

  /* ─── LOAD ─── */
  useEffect(() => {
    if (!reportId || !projectId) return;
    (async () => {
      const { data } = await supabase.from("saved_reports").select("*").eq("id", reportId).single();
      if (data) {
        setReport(data);
        setMarkdownContent(data.content || "");
        markdownRef.current = data.content || "";
        setTitle(data.title || "");
        titleRef.current = data.title || "";
        // Set editor content
        if (editor) editor.commands.setContent(mdToHtml(data.content || ""));
      }
      // Load entries for @ mentions
      const { data: csData } = await supabase.from("creative_source").select("id,brand_name,scope,competitor,brand,description,year,type,rating,image_url,url,communication_intent").eq(filterField, filterValue);
      setAllEntries((csData || []).map(e => ({ ...e, brand: e.brand_name || e.competitor || e.brand })));
      setLoading(false);
    })();
  }, [reportId, projectId, editor]);

  const [saveError, setSaveError] = useState(null);
  const editorRef = useRef(editor);
  editorRef.current = editor;
  const modeRef = useRef(mode);
  modeRef.current = mode;

  /* ─── SAVE ─── */
  const saveContent = useCallback(async () => {
    if (!reportId) return;
    setSaving(true);
    setSaveError(null);

    // Always sync latest content from TipTap editor before saving
    if (modeRef.current === "visual" && editorRef.current) {
      const freshMd = htmlToMd(editorRef.current.getHTML());
      markdownRef.current = freshMd;
    }

    const md = markdownRef.current;
    const t = titleRef.current;

    try {
      // Save via server API route (bypasses RLS)
      const res = await fetch("/api/save-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: reportId, content: md, title: t }),
      });
      const result = await res.json();
      if (!res.ok || result.error) {
        setSaveError(result.error || "Save failed");
        setSaving(false);
        return;
      }
      setSaving(false);
      setSaved(true);
    } catch (e) {
      setSaveError(e.message || "Save crashed");
      setSaving(false);
    }
  }, [reportId]);

  // Autosave every 8 seconds
  useEffect(() => {
    if (saved) return;
    const timer = setTimeout(saveContent, 8000);
    return () => clearTimeout(timer);
  }, [saved, saveContent]);

  // Cmd+S
  useEffect(() => {
    const handler = (e) => { if ((e.metaKey || e.ctrlKey) && e.key === "s") { e.preventDefault(); saveContent(); } };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [saveContent]);

  // Switch modes
  const switchToSource = () => {
    if (editor) setMarkdownContent(htmlToMd(editor.getHTML()));
    setMode("source");
  };
  const switchToVisual = () => {
    if (editor) editor.commands.setContent(mdToHtml(markdownContent));
    setMode("visual");
  };

  // Insert citation from mention popup
  const insertCitation = (entry) => {
    const label = (entry.description || entry.brand || "source").slice(0, 50).replace(/[\[\]]/g, "");
    if (mode === "visual" && editor) {
      editor.chain().focus().insertContent(`<a href="cite:${entry.id}" data-cite="${entry.id}">${label}</a> `).run();
    } else {
      setMarkdownContent(prev => prev + `\n[${label}](cite:${entry.id})`);
    }
    setSaved(false);
    setMentionOpen(false);
    setMentionQuery("");
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><p className="text-hint">Loading editor...</p></div>;
  if (!report) return <div className="min-h-screen flex items-center justify-center"><p className="text-hint">Report not found</p></div>;

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: "var(--bg)" }}>
      {/* Top bar */}
      <div className="px-5 py-2.5 flex justify-between items-center flex-shrink-0 bg-surface border-b border-main">
        <div className="flex items-center gap-3">
          <button onClick={async () => { if (!saved) await saveContent(); router.push(`/reports?report=${reportId}`); }}
            className="text-muted hover:text-main text-sm">← Back to report</button>
          <div className="w-px h-5 bg-main opacity-20" />
          <input value={title} onChange={e => { setTitle(e.target.value); titleRef.current=e.target.value; setSaved(false); }}
            className="text-lg font-bold text-main bg-transparent border-none focus:outline-none w-[300px]"
            placeholder="Report title" />
          {!saved && <span className="text-[9px] text-hint">Unsaved</span>}
          {saving && <span className="text-[9px] text-accent">Saving...</span>}
          {saveError && <span className="text-[9px] text-red-500 font-semibold">ERROR: {saveError}</span>}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={async () => { await saveContent(); router.push(`/reports?report=${reportId}`); }} disabled={saving}
            className="px-3 py-1.5 text-xs bg-accent text-white rounded-lg font-semibold hover:opacity-90 transition">
            {saving ? "Saving..." : "Save & Close"}
          </button>
          <button onClick={saveContent} disabled={saving}
            className="px-3 py-1.5 text-xs border border-main rounded-lg text-muted hover:text-main transition">
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-surface border-b border-main px-4 py-1.5 flex items-center gap-3 flex-shrink-0">
        <div className="flex bg-surface2 rounded-lg p-0.5">
          <button onClick={switchToVisual}
            className={`px-3 py-1 rounded-md text-xs font-medium transition ${mode === "visual" ? "bg-surface text-accent shadow-sm" : "text-muted"}`}>
            Visual
          </button>
          <button onClick={switchToSource}
            className={`px-3 py-1 rounded-md text-xs font-medium transition ${mode === "source" ? "bg-surface text-accent shadow-sm" : "text-muted"}`}>
            Source
          </button>
        </div>
        {mode === "visual" && <TBar editor={editor} />}
        <div className="flex-1" />
        <button onClick={() => { setMentionOpen(!mentionOpen); setMentionQuery(""); }}
          className="px-3 py-1 text-xs border border-main rounded-lg text-muted hover:text-accent hover:border-[var(--accent)] transition flex items-center gap-1.5">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
          Insert case
        </button>
      </div>

      {/* Editor area */}
      <div className="flex-1 overflow-auto relative">
        {mode === "visual" ? (
          <div className="p-8 max-w-4xl mx-auto bg-surface min-h-full">
            <EditorContent editor={editor} />
          </div>
        ) : (
          <textarea
            value={markdownContent}
            onChange={e => { setMarkdownContent(e.target.value); markdownRef.current=e.target.value; setSaved(false); }}
            className="w-full h-full p-6 bg-surface text-sm text-main font-mono leading-relaxed resize-none focus:outline-none"
            spellCheck={false}
          />
        )}

        {/* Case reference popup */}
        {mentionOpen && (() => {
          const q = mentionQuery.toLowerCase();
          const results = q.length > 0
            ? allEntries.filter(e => (e.description || "").toLowerCase().includes(q) || (e.brand || "").toLowerCase().includes(q) || (e.communication_intent || "").toLowerCase().includes(q)).slice(0, 10)
            : allEntries.slice(0, 10);
          return (
            <div className="fixed top-[140px] left-1/2 -translate-x-1/2 bg-surface border border-main rounded-xl shadow-2xl z-50 w-[450px]">
              <div className="p-3 border-b border-main">
                <div className="flex items-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-hint"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
                  <input autoFocus value={mentionQuery} onChange={e => { setMentionQuery(e.target.value); setMentionIdx(0); }}
                    onKeyDown={e => {
                      if (e.key === "ArrowDown") { e.preventDefault(); setMentionIdx(i => Math.min(i + 1, results.length - 1)); }
                      else if (e.key === "ArrowUp") { e.preventDefault(); setMentionIdx(i => Math.max(i - 1, 0)); }
                      else if (e.key === "Enter" && results.length > 0) { e.preventDefault(); insertCitation(results[mentionIdx]); }
                      else if (e.key === "Escape") { setMentionOpen(false); }
                    }}
                    placeholder="Search cases by name, brand, type..."
                    className="flex-1 text-sm text-main bg-transparent focus:outline-none" />
                  <button onClick={() => setMentionOpen(false)} className="text-hint hover:text-main text-sm">×</button>
                </div>
              </div>
              <div className="max-h-[300px] overflow-y-auto">
                {results.length === 0 && <p className="text-xs text-hint text-center py-6">No cases found</p>}
                {results.map((entry, i) => {
                  const ytMatch = (entry.url || "").match(/(?:youtube\.com\/watch\?.*v=|youtu\.be\/)([^&\s]+)/);
                  const thumb = ytMatch ? `https://img.youtube.com/vi/${ytMatch[1]}/mqdefault.jpg` : entry.image_url;
                  return (
                    <button key={i} className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition border-b border-main last:border-0 ${i === mentionIdx ? "bg-accent-soft" : "hover:bg-accent-soft"}`}
                      onClick={() => insertCitation(entry)}
                      onMouseEnter={() => setMentionIdx(i)}>
                      {thumb && <img src={thumb} className="w-12 h-9 object-cover rounded flex-shrink-0" alt="" />}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-main truncate">{entry.description || "—"}</p>
                        <div className="flex gap-2 mt-0.5">
                          {entry.brand && <span className="text-[10px] text-accent">{entry.brand}</span>}
                          {entry.year && <span className="text-[10px] text-hint">{entry.year}</span>}
                          {entry.communication_intent && <span className="text-[10px] text-hint">{entry.communication_intent}</span>}
                          {entry.rating && <span className="text-[10px] text-amber-500">{"★".repeat(Number(entry.rating))}</span>}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}

export default function EditorPage() {
  return (
    <AuthGuard><ProjectGuard>
      <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><p className="text-hint">Loading...</p></div>}>
        <EditorContent2 />
      </Suspense>
    </ProjectGuard></AuthGuard>
  );
}
