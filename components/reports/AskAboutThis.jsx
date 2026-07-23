"use client";
// "Ask about this" (F4). Select text in a saved report and ask the AI about that exact
// passage — why the conclusion was reached, what backs it, how to apply it.
//
// Reading-mode only. The selection pops a dark pill; the panel anchors to it and flips
// above when there isn't room below.
import { useState, useEffect, useRef, useCallback } from "react";

const SUGGESTED = [
  "Why was this conclusion reached?",
  "What data supports this?",
  "How could this insight be applied?",
  "What are the implications?",
];

const PANEL_W = 380;
const PANEL_H = 330;

export default function AskAboutThis({ containerRef, reportTitle, reportText, projectId, brandId, language }) {
  const [sel, setSel] = useState(null);          // { text, rect }
  const [mode, setMode] = useState(null);        // null | 'pill' | 'ask'
  const [question, setQuestion] = useState("");
  const [thread, setThread] = useState([]);      // [{ role, text }]
  const [busy, setBusy] = useState(false);
  const panelRef = useRef(null);

  // Watch selections inside the document only.
  useEffect(() => {
    const onUp = (e) => {
      if (panelRef.current?.contains(e.target)) return;
      const s = window.getSelection();
      const text = s?.toString().trim();
      if (!text || text.length < 8) { if (mode !== "ask") { setMode(null); setSel(null); } return; }
      const node = s.anchorNode;
      if (!node || !containerRef.current?.contains(node.nodeType === 3 ? node.parentNode : node)) return;
      const rect = s.getRangeAt(0).getBoundingClientRect();
      setSel({ text, rect });
      setMode("pill");
    };
    document.addEventListener("mouseup", onUp);
    return () => document.removeEventListener("mouseup", onUp);
  }, [containerRef, mode]);

  const close = useCallback(() => { setMode(null); setSel(null); setThread([]); setQuestion(""); }, []);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [close]);

  const ask = async (q) => {
    const text = (q || question).trim();
    if (!text || busy || !sel) return;
    setQuestion("");
    setThread((t) => [...t, { role: "user", text }]);
    setBusy(true);
    try {
      // The passage is the subject; the report is the context. Answer from what the report
      // and its evidence actually say — never invent supporting data.
      const system = `You are the analyst's assistant inside a competitive-intelligence report titled "${reportTitle || "Report"}".
The user has selected a passage and is asking about it. Answer about THAT passage specifically.
Ground every answer in the report's own content and reasoning. If the report does not support an answer, say so plainly rather than inventing evidence.
Be concise — 2-4 sentences unless the question genuinely needs more. No preamble, no restating the question.\nAnswer in ${language || "the same language as the passage"} — the report's language, not English.`;
      const context = `REPORT (for context):\n${String(reportText || "").slice(0, 12000)}\n\nSELECTED PASSAGE:\n"""${sel.text}"""`;
      const res = await fetch("/api/ai", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system, max_tokens: 700, project_id: projectId, brand_id: brandId, skip_framework: true,
          messages: [...thread.map((m) => ({ role: m.role === "user" ? "user" : "assistant", content: m.text })),
                     { role: "user", content: `${context}\n\nQUESTION: ${text}` }],
        }),
      });
      const d = await res.json();
      if (d.error) throw new Error(d.error);
      const answer = d.content?.map((c) => c.text || "").join("") || "No answer.";
      setThread((t) => [...t, { role: "assistant", text: answer }]);
    } catch (e) {
      setThread((t) => [...t, { role: "assistant", text: `Couldn't answer: ${e.message || "unknown error"}` }]);
    }
    setBusy(false);
  };

  if (!sel || !mode) return null;

  const r = sel.rect;
  const flipUp = r.bottom + PANEL_H > window.innerHeight;
  const left = Math.min(Math.max(12, r.left), window.innerWidth - PANEL_W - 12);

  if (mode === "pill") {
    return (
      <div style={{ position: "fixed", top: r.top - 46, left: Math.max(12, r.left), zIndex: 90 }}>
        <button onClick={() => setMode("ask")}
          style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "var(--ink-800)", color: "var(--brand-cream)", border: "none", borderRadius: 10, padding: "10px 16px", cursor: "pointer", fontFamily: "var(--font-mono)", fontSize: 11.5, boxShadow: "0 8px 24px rgba(0,0,0,.22)" }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--accent-ember)" strokeWidth="1.8"><path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2z" /></svg>
          Ask about this
        </button>
      </div>
    );
  }

  return (
    <div ref={panelRef}
      style={{ position: "fixed", left, top: flipUp ? undefined : r.bottom + 10, bottom: flipUp ? window.innerHeight - r.top + 10 : undefined,
        width: PANEL_W, maxHeight: PANEL_H, zIndex: 90, display: "flex", flexDirection: "column",
        background: "var(--brand-white)", border: "1px solid var(--border-hairline)", borderRadius: 16,
        boxShadow: "0 16px 44px rgba(0,0,0,.2)", overflow: "hidden", animation: "gwrise .16s ease" }}>

      <div style={{ background: "var(--ink-800)", padding: "12px 14px", flex: "none" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: ".16em", textTransform: "uppercase", color: "rgba(255,247,240,.6)" }}>Report assistant</span>
          <button onClick={close} style={{ background: "none", border: "none", color: "rgba(255,247,240,.6)", cursor: "pointer", fontSize: 15, lineHeight: 1, padding: 0 }}>×</button>
        </div>
        <p style={{ fontFamily: "var(--font-body)", fontStyle: "italic", fontSize: 12.5, lineHeight: 1.45, color: "var(--brand-cream)", margin: "8px 0 0",
          display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>“{sel.text}”</p>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 14 }}>
        {thread.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {SUGGESTED.map((q) => (
              <button key={q} onClick={() => ask(q)}
                style={{ textAlign: "left", background: "var(--paper)", border: "1px solid var(--border-hairline)", borderRadius: 9, padding: "9px 11px", cursor: "pointer", fontFamily: "var(--font-body)", fontSize: 12.5, color: "var(--ink-800)" }}>{q}</button>
            ))}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {thread.map((m, i) => (
              <div key={i} style={{ fontFamily: "var(--font-body)", fontSize: 13, lineHeight: 1.55,
                color: m.role === "user" ? "var(--text-muted)" : "var(--ink-900)",
                paddingLeft: m.role === "assistant" ? 10 : 0,
                borderLeft: m.role === "assistant" ? "2px solid var(--accent-ember-tint)" : "none" }}>
                {m.text}
              </div>
            ))}
            {busy && <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--accent-ember-deep)" }} className="animate-pulse">Thinking…</div>}
          </div>
        )}
      </div>

      <div style={{ flex: "none", borderTop: "1px solid var(--border-hairline)", padding: 10, display: "flex", gap: 8 }}>
        <input value={question} onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") ask(); }}
          placeholder="Ask a follow-up…"
          style={{ flex: 1, minWidth: 0, background: "var(--paper)", border: "1px solid var(--border-hairline)", borderRadius: 9, padding: "9px 11px", fontFamily: "var(--font-body)", fontSize: 13, color: "var(--ink-900)", outline: "none" }} />
        <button onClick={() => ask()} disabled={busy || !question.trim()} className="gw-ember-btn"
          style={{ flex: "none", background: "var(--accent-ember)", color: "#fff", border: "none", borderRadius: 9, padding: "9px 15px", cursor: "pointer", fontFamily: "var(--font-body)", fontSize: 12.5, fontWeight: 600, opacity: busy || !question.trim() ? 0.45 : 1 }}>Send</button>
      </div>
    </div>
  );
}
