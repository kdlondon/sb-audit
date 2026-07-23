"use client";
// The report document (F4). Applies the v3 deliverable treatment on top of the block
// model: mono breadcrumb, section numerals in the margin, Klamp headings, titled chart
// cards, and text-forward body. Text stays the protagonist; visuals support it.
//
// Falls back to plain markdown for reports saved before the block model existed.
import ReportBlock, { isVisualBlock } from "./ReportBlocks";
import { isV2 } from "@/lib/report-blocks";

const BREADCRUMB = {
  fontFamily: "var(--font-mono)", fontSize: 9.5, letterSpacing: ".22em",
  textTransform: "uppercase", color: "var(--text-muted)",
  paddingBottom: 16, borderBottom: "1px solid var(--paper-edge)", marginBottom: 34,
};

export default function ReportDocument({ report, renderMarkdown, breadcrumb }) {
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
    if (!last || last.key !== key) sections.push({ key, title: null, blocks: [] });
    const cur = sections[sections.length - 1];
    // The first h2 of a section is its title — promoted out of the prose.
    if (b.type === "h2" && cur.title === null && cur.blocks.length === 0) { cur.title = b.text; continue; }
    cur.blocks.push(b);
  }

  let n = 0;
  return (
    <>
      {breadcrumb && <div style={BREADCRUMB}>{breadcrumb}</div>}
      {sections.map((sec, si) => {
        const numeral = sec.title ? String(++n).padStart(2, "0") : null;
        return (
          <section key={si} style={{ marginBottom: 44 }}>
            {sec.title && (
              <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginBottom: 20 }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 15, color: "var(--ink-300)", flex: "none" }}>{numeral}</span>
                <h2 style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 700, letterSpacing: "-.01em", color: "var(--ink-900)", margin: 0 }}>{sec.title}</h2>
              </div>
            )}
            <SectionBody blocks={sec.blocks} renderMarkdown={renderMarkdown} />
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
