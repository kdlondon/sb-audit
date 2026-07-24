"use client";
// The report document (F4). Applies the v3 deliverable treatment on top of the block
// model: mono breadcrumb, section numerals in the margin, Klamp headings, titled chart
// cards, and text-forward body. Text stays the protagonist; visuals support it.
//
// Falls back to plain markdown for reports saved before the block model existed.
import { useState } from "react";
import ReportBlock, { isVisualBlock } from "./ReportBlocks";
import { isV2 } from "@/lib/report-blocks";

const BREADCRUMB = {
  fontFamily: "var(--font-mono)", fontSize: 9.5, letterSpacing: ".22em",
  textTransform: "uppercase", color: "var(--text-muted)",
  paddingBottom: 16, borderBottom: "1px solid var(--paper-edge)", marginBottom: 34,
};

const norm = (t) => String(t || "").toLowerCase().replace(/[^a-z0-9áéíóúñü]+/gi, " ").trim();

export default function ReportDocument({ report, renderMarkdown, breadcrumb, onRegenerate, regeneratingKey, notice, onUndo, onDismissNotice }) {
  const doc = report?.content_blocks;
  if (!isV2(doc)) {
    return (
      <>
        {breadcrumb && <div style={BREADCRUMB}>{breadcrumb}</div>}
        {renderMarkdown(report?.content || "")}
      </>
    );
  }

  // Group blocks into sections so each can carry its numeral and heading.
  const sections = [];
  for (const b of doc.blocks) {
    const key = b.sectionKey || "_";
    const last = sections[sections.length - 1];
    if (!last || last.key !== key) sections.push({ key, title: null, lead: null, eyebrow: null, blocks: [] });
    const cur = sections[sections.length - 1];
    // The first h2 of a section is its title — promoted out of the prose.
    if (b.type === "h2" && cur.title === null && cur.blocks.length === 0) { cur.title = b.text; continue; }
    // Reports generated before the titles were de-duplicated store BOTH the card's English
    // label and the heading the engine wrote. If a second heading opens the section, it is
    // that generated one — prefer it and drop the label, rather than printing both.
    if (b.type === "h2" && cur.blocks.length === 0) { cur.title = b.text; continue; }
    if (b.type === "lead") { cur.lead = b.data?.text || null; cur.eyebrow = b.data?.eyebrow || null; continue; }
    // A heading that merely restates the section title (any level, any case) is a
    // duplicate — engines often open with "# EXECUTIVE READ" under a section already
    // called Executive read.
    if ((b.type === "h2" || b.type === "h3") && cur.blocks.length === 0 && norm(b.text) === norm(cur.title)) continue;
    cur.blocks.push(b);
  }

  let n = 0;
  return (
    <>
      {breadcrumb && <div style={BREADCRUMB}>{breadcrumb}</div>}
      {sections.map((sec, si) => {
        const numeral = sec.title ? String(++n).padStart(2, "0") : null;
        return (
          <section key={si} style={{ marginBottom: 56, paddingBottom: 56, borderBottom: si === sections.length - 1 ? "none" : "1px solid var(--border-hairline)" }}>
            {sec.title && (
              /* Every section opens identically — numeral, eyebrow, title, one-line lead —
                 so a seven-section read stays navigable and never flattens into one wall. */
              <div style={{ display: "flex", alignItems: "flex-start", gap: 22, marginBottom: 24 }}>
                <span style={{ fontFamily: "var(--font-numeral)", fontWeight: 700, fontSize: 40, lineHeight: .9, color: "var(--ink-200)", flex: "none" }}>{numeral}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {sec.eyebrow && (
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".18em", textTransform: "uppercase", color: "var(--accent-ember-deep)" }}>{sec.eyebrow}</div>
                  )}
                  <h2 style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 700, letterSpacing: "-.01em", lineHeight: 1.15, color: "var(--ink-900)", margin: sec.eyebrow ? "9px 0 0" : 0 }}>{sec.title}</h2>
                  {sec.lead && (
                    <p style={{ fontFamily: "var(--font-body)", fontStyle: "italic", fontSize: 16, lineHeight: 1.45, color: "var(--text-secondary)", margin: "12px 0 0", maxWidth: 640 }}>{sec.lead}</p>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flex: "none" }}>
                  {notice?.key === sec.key && (
                    <SectionFlag notice={notice} onUndo={onUndo} onDismiss={onDismissNotice} />
                  )}
                  {onRegenerate && sec.key !== "_" && (
                    <RegenerateControl sectionKey={sec.key} busy={regeneratingKey === sec.key} onRegenerate={onRegenerate} />
                  )}
                </div>
              </div>
            )}
            <div style={{ animation: regeneratingKey === sec.key ? "gwpulse .9s ease-in-out infinite" : undefined }}>
              <SectionBody blocks={sec.blocks} renderMarkdown={renderMarkdown} />
            </div>
          </section>
        );
      })}
    </>
  );
}

// Visuals render as components; consecutive text blocks are batched back into markdown so
// links, citations and emphasis keep behaving exactly as they did.
function SectionBody({ blocks, renderMarkdown }) {
  const out = [];
  let buf = [];
  const flush = (k) => {
    if (!buf.length) return;
    out.push(<div key={`t${k}`} className="gw-report-prose">{renderMarkdown(buf.join("\n\n"))}</div>);
    buf = [];
  };
  blocks.forEach((b, i) => {
    if (isVisualBlock(b)) { flush(i); out.push(<ReportBlock key={b.id || i} block={b} />); return; }
    if (b.type === "h2") buf.push(`### ${b.text}`);        // inner headings sit below the section title
    else if (b.type === "h3") buf.push(`#### ${b.text}`);
    else if (b.type === "bullets") buf.push((b.items || []).map((x) => `- ${x}`).join("\n"));
    else if (b.type === "numbered") buf.push((b.items || []).map((x, n) => `${n + 1}. ${x}`).join("\n"));
    else if (b.type === "quote") buf.push(`> ${b.text}`);
    else if (b.text) buf.push(b.text);
  });
  flush("end");
  return <>{out}</>;
}

// Per-section regenerate. The analyst says what to change BEFORE it runs — the instruction
// is passed to the engine as direction for that section only.
function RegenerateControl({ sectionKey, busy, onRegenerate }) {
  const [open, setOpen] = useState(false);
  const [instr, setInstr] = useState("");
  const submit = () => { onRegenerate(sectionKey, instr.trim()); setOpen(false); setInstr(""); };

  if (busy) {
    return (
      <span style={{ flex: "none", display: "inline-flex", alignItems: "center", gap: 7, fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--accent-ember-deep)" }}>
        <span style={{ width: 11, height: 11, borderRadius: "50%", border: "2px solid var(--accent-ember-tint)", borderTopColor: "var(--accent-ember)", animation: "gwspin .8s linear infinite" }} />
        Regenerating…
      </span>
    );
  }
  return (
    <span style={{ flex: "none", position: "relative" }}>
      <button onClick={() => setOpen((v) => !v)} className="gw-tbtn" title="Regenerate this section"
        style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "var(--brand-white)", border: "1px solid var(--border-hairline)", borderRadius: 8, padding: "6px 11px", cursor: "pointer", fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--text-secondary)" }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M21 12a9 9 0 1 1-3-6.7M21 4v5h-5" /></svg>
        Regenerate
      </button>
      {open && (
        <div onClick={(e) => e.stopPropagation()}
          style={{ position: "absolute", right: 0, top: "100%", marginTop: 8, zIndex: 40, width: 340, background: "var(--brand-white)", border: "1px solid var(--border-hairline)", borderRadius: 14, boxShadow: "0 16px 44px rgba(0,0,0,.16)", padding: 14, textAlign: "left" }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 9 }}>Tell the AI what to change</div>
          <textarea autoFocus value={instr} onChange={(e) => setInstr(e.target.value)} rows={3}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit(); }}
            placeholder="e.g. focus on the gap between what Iberia says and what it does; shorter, more concrete"
            style={{ width: "100%", background: "var(--paper)", border: "1px solid var(--border-hairline)", borderRadius: 9, padding: "9px 11px", fontFamily: "var(--font-body)", fontSize: 13, color: "var(--ink-900)", outline: "none", resize: "vertical", lineHeight: 1.5 }} />
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 10 }}>
            <button onClick={() => setOpen(false)} style={{ background: "var(--brand-white)", border: "1px solid var(--border-hairline)", borderRadius: 8, padding: "7px 12px", cursor: "pointer", fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--text-secondary)" }}>Cancel</button>
            <button onClick={submit} className="gw-ember-btn"
              style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "var(--accent-ember)", color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontFamily: "var(--font-body)", fontSize: 12.5, fontWeight: 600 }}>
              Regenerate
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h13M13 6l6 6-6 6" /></svg>
            </button>
          </div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--ink-300)", marginTop: 8 }}>Leave empty to simply rewrite it. ⌘↵ to run.</div>
        </div>
      )}
    </span>
  );
}

// The regeneration notice belongs to its section, not to the page — so Undo visibly
// reverts THAT section and nothing else.
function SectionFlag({ notice, onUndo, onDismiss }) {
  const failed = /failed|could not/i.test(notice.text || "");
  return (
    <span style={{ flex: "none", display: "inline-flex", alignItems: "center", gap: 9, padding: "5px 11px", borderRadius: 14,
      background: "var(--accent-ember-tint)", color: "#7a3a24", fontFamily: "var(--font-mono)", fontSize: 10.5, animation: "gwrise .16s ease" }}>
      {!failed && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>}
      <span style={{ maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{notice.text}</span>
      {notice.prevDoc && (
        <button onClick={onUndo} style={{ background: "transparent", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit", fontSize: "inherit", color: "#7a3a24", textDecoration: "underline" }}>Undo</button>
      )}
      <button onClick={onDismiss} title="Dismiss" style={{ background: "transparent", border: "none", padding: 0, cursor: "pointer", color: "#7a3a24", fontSize: 13, lineHeight: 1 }}>×</button>
    </span>
  );
}
