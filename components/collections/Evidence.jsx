"use client";
// The "evidence" — why a set of pieces deserves to be a collection, plus the key
// learnings it carries. Shared surface: it rides on manual collections AND on AI
// suggestions (Phase 4), so it lives as its own component, not inline in the detail.
//
// Three states, per handoff view 02:
//   filled  — has a `why` and/or learnings; two-column read view with Edit / Regenerate
//   empty   — nothing yet; a dashed invitation to Write it or Ask Groundwork
//   editing — the form (a why textarea + learning inputs), Cancel / Save
//
// Shape: rationale = { why: string, learnings: string[] }. The parent owns
// persistence (onSave) and AI generation (onAskAI); this component owns only the
// local edit buffer and which state is showing.
import { useState, useEffect } from "react";

const EYEBROW = { fontFamily: "var(--font-mono,monospace)", fontSize: 8, letterSpacing: "0.16em", textTransform: "uppercase" };

function hasContent(r) {
  return !!(r && (String(r.why || "").trim() || (Array.isArray(r.learnings) && r.learnings.some(l => String(l || "").trim()))));
}

const Sparkle = ({ size = 9 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m12 3 1.6 5L19 9.5l-5 1.6L12 16l-1.6-4.9L5 9.5 10.4 8z"/></svg>
);

export default function Evidence({ rationale, busy = false, onSave, onAskAI }) {
  const filled = hasContent(rationale);
  const [mode, setMode] = useState(filled ? "filled" : "empty");
  const [why, setWhy] = useState(rationale?.why || "");
  const [learnings, setLearnings] = useState(rationale?.learnings?.length ? [...rationale.learnings] : [""]);

  // When the parent swaps in new rationale (e.g. after AI fills it), reflect it —
  // but never yank the user out of the form they're typing in.
  useEffect(() => {
    if (mode === "editing") return;
    setWhy(rationale?.why || "");
    setLearnings(rationale?.learnings?.length ? [...rationale.learnings] : [""]);
    setMode(hasContent(rationale) ? "filled" : "empty");
  }, [rationale]); // eslint-disable-line react-hooks/exhaustive-deps

  const startEdit = () => {
    setWhy(rationale?.why || "");
    setLearnings(rationale?.learnings?.length ? [...rationale.learnings] : [""]);
    setMode("editing");
  };

  const save = () => {
    const clean = learnings.map(l => String(l || "").trim()).filter(Boolean);
    onSave?.({ why: String(why || "").trim(), learnings: clean });
    setMode(hasContent({ why, learnings }) ? "filled" : "empty");
  };

  const setLearning = (i, v) => setLearnings(ls => {
    const next = [...ls];
    next[i] = v;
    // keep one trailing empty row to add another
    if (i === next.length - 1 && v.trim()) next.push("");
    return next;
  });

  // ── EDITING ────────────────────────────────────────────────────────────────
  if (mode === "editing") {
    return (
      <div className="mt-1 mb-6 bg-surface border border-[var(--accent-ember-tint)] rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-2.5">
          <span style={EYEBROW} className="text-hint">Why this is a collection</span>
          <button onClick={() => onAskAI?.()} disabled={busy} className="ml-auto text-[10px] text-[var(--accent-ember-deep)] hover:underline disabled:opacity-50">Ask Groundwork instead</button>
        </div>
        <textarea value={why} onChange={e => setWhy(e.target.value)} placeholder="What connects these entries?"
          className="w-full min-h-[88px] resize-y text-[13px] leading-relaxed text-main bg-white border border-[var(--border)] rounded-lg px-3 py-2.5 outline-none focus:border-[var(--accent-ember-deep)] transition" />
        <div style={EYEBROW} className="text-hint mt-3.5 mb-2">Key learnings</div>
        <div className="flex flex-col gap-1.5">
          {learnings.map((l, i) => (
            <div key={i} className="flex items-center gap-2.5">
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: l.trim() ? "var(--accent-ember)" : "var(--ink-300,#ccc)" }} />
              <input value={l} onChange={e => setLearning(i, e.target.value)} placeholder={i === 0 ? "Learning 1" : "Add another…"}
                className="w-full text-[12.5px] text-main bg-white border border-[var(--border)] rounded-lg px-3 py-2 outline-none focus:border-[var(--accent-ember-deep)] transition" />
            </div>
          ))}
        </div>
        <div className="mt-3.5 flex gap-2 justify-end">
          <button onClick={() => setMode(filled ? "filled" : "empty")} className="text-[11px] text-muted bg-transparent border border-[var(--border)] rounded-lg px-3.5 py-2 hover:text-main transition">Cancel</button>
          <button onClick={save} className="text-[11px] font-medium text-white bg-[var(--ink-800,#1a1a1a)] border-none rounded-lg px-4 py-2 hover:brightness-110 transition">Save</button>
        </div>
      </div>
    );
  }

  // ── EMPTY ──────────────────────────────────────────────────────────────────
  if (mode === "empty") {
    return (
      <div className="mt-1 mb-6 bg-surface border border-dashed border-[var(--border-strong,#cbc5bb)] rounded-2xl px-5 py-5 flex items-center gap-5 flex-wrap">
        <div className="flex-1 min-w-[260px]">
          <h3 className="text-[13.5px] font-semibold text-main m-0">No evidence yet</h3>
          <p className="text-xs text-muted leading-relaxed mt-1.5 max-w-[520px]">Say what connects these entries and what you learned. It travels with the collection into the deck and the report.</p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button onClick={startEdit} className="text-[11px] text-muted bg-transparent border border-[var(--border-strong,#cbc5bb)] rounded-lg px-3.5 py-2 hover:text-main transition">Write it</button>
          <button onClick={() => onAskAI?.()} disabled={busy} className="inline-flex items-center gap-1.5 text-[11px] font-medium text-white bg-[var(--accent-ember-deep)] border-none rounded-lg px-3.5 py-2 hover:brightness-95 disabled:opacity-60 transition whitespace-nowrap">
            {busy ? <><svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="30 70" strokeLinecap="round"/></svg>Thinking…</> : <><Sparkle size={13} />Ask Groundwork</>}
          </button>
        </div>
      </div>
    );
  }

  // ── FILLED ─────────────────────────────────────────────────────────────────
  const rows = (rationale?.learnings || []).filter(l => String(l || "").trim());
  return (
    <div className="mt-1 mb-6 bg-surface border border-[var(--border)] rounded-2xl p-6 grid gap-7 items-start" style={{ gridTemplateColumns: "1.5fr 1fr" }}>
      <div>
        <div className="flex items-center gap-2 mb-2.5">
          <span style={EYEBROW} className="text-hint">Why this is a collection</span>
          <span className="inline-flex items-center gap-1 text-[8px] tracking-[0.08em] text-[var(--accent-ember-deep)]"><Sparkle />AI</span>
          <button onClick={startEdit} className="ml-auto text-[10px] text-muted hover:text-main transition">Edit</button>
          <button onClick={() => onAskAI?.()} disabled={busy} className="text-[10px] text-[var(--accent-ember-deep)] hover:underline disabled:opacity-50">{busy ? "…" : "Regenerate"}</button>
        </div>
        {rationale?.why && <p className="text-[13.5px] leading-[1.65] text-main m-0">{rationale.why}</p>}
      </div>
      <div>
        <div style={EYEBROW} className="text-hint mb-3">Key learnings</div>
        <div className="flex flex-col gap-2.5">
          {rows.length ? rows.map((l, i) => (
            <div key={i} className="flex gap-2.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-ember)] flex-shrink-0 mt-1.5" />
              <p className="text-[12.5px] leading-snug text-muted m-0">{l}</p>
            </div>
          )) : <p className="text-[12px] text-hint italic m-0">—</p>}
        </div>
      </div>
    </div>
  );
}
