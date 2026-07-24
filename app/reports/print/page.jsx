"use client";
// The report as a real DOCUMENT, not a screenshot.
//
// The old export rasterised the DOM with html2pdf: the text became an image — unselectable,
// unsearchable, soft at zoom — and because a bitmap has no idea where a section begins, it
// was sliced every 297mm, leaving half-empty pages and a cover that was mostly white.
//
// This route renders the report into real printed pages and hands it to the browser's own
// print engine. The text stays text, blocks keep their vector edges, and pagination is the
// browser's job, which it does properly: a section header never sits alone at the foot of a
// page, and a chart is never cut in half.
//
// Structure follows the handoff's document deliverable: cover → numbered sections → closing.
import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Markdown from "react-markdown";
import { createClient } from "@/lib/supabase";
import AuthGuard from "@/components/AuthGuard";
import ReportBlock, { isVisualBlock } from "@/components/reports/ReportBlocks";
import { isV2, fromLegacy } from "@/lib/report-blocks";
import { REPORT_CARDS } from "@/lib/report-cards";
import { caseUrl } from "@/lib/report-citations";

const supabase = createClient();

// A4 with a generous type measure. The cover and closing are full-bleed via named pages,
// which is why they can carry an edge-to-edge colour the body pages never do.
const PRINT_CSS = `
@page { size: A4; margin: 17mm 16mm 16mm; }
@page cover { margin: 0; }
@page closing { margin: 0; }
.gw-doc { background: #fff; color: var(--ink-900); }
.gw-doc .sheet { page: cover; break-after: page; }
.gw-doc .sheet-end { page: closing; break-before: page; }
.gw-doc section { break-inside: auto; }
.gw-doc .sec-head { break-after: avoid; page-break-after: avoid; }
.gw-doc p, .gw-doc li { orphans: 3; widows: 3; }
.gw-doc h2, .gw-doc h3 { break-after: avoid; page-break-after: avoid; }
.gw-doc a { color: var(--accent-ember-deep); text-decoration: none; }
@media screen {
  .gw-doc { max-width: 210mm; margin: 0 auto; box-shadow: 0 2px 24px rgba(0,0,0,.14); padding: 17mm 16mm; }
  .gw-doc .sheet, .gw-doc .sheet-end { margin: -17mm -16mm 24px; }
}
@media print {
  html, body { background: #fff !important; }
  .gw-noprint { display: none !important; }
  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
}
`;

const EYB = { fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".18em", textTransform: "uppercase", color: "var(--ink-500)" };

function PrintContent() {
  const params = useSearchParams();
  const id = params.get("id");
  const [report, setReport] = useState(null);
  const [state, setState] = useState("loading");
  const printed = useRef(false);

  useEffect(() => {
    if (!id) { setState("missing"); return; }
    (async () => {
      const { data, error } = await supabase.from("saved_reports").select("*").eq("id", id).maybeSingle();
      if (error || !data) { setState("missing"); return; }
      setReport(data);
      setState("ready");
    })();
  }, [id]);

  // Print once the fonts have actually loaded — firing earlier prints Klamp as a fallback
  // face and the whole document comes out in the wrong type.
  useEffect(() => {
    if (state !== "ready" || printed.current) return;
    printed.current = true;
    const go = () => setTimeout(() => window.print(), 350);
    if (document.fonts?.ready) document.fonts.ready.then(go); else go();
  }, [state]);

  if (state !== "ready") {
    return (
      <div className="gw-shell" style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--paper)" }}>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-muted)" }}>
          {state === "loading" ? "Preparing the document…" : "That report could not be found."}
        </p>
      </div>
    );
  }

  const doc = isV2(report.content_blocks) ? report.content_blocks : fromLegacy(report.content_blocks || report.content || "");
  const card = REPORT_CARDS[report.template_type] || null;
  const created = new Date(report.created_at || Date.now());
  const stamp = `${String(created.getMonth() + 1).padStart(2, "0")} · ${created.getFullYear()}`;
  const brands = (report.competitors || "").split(",").map((b) => b.trim()).filter(Boolean);
  const period = report.year_from && report.year_to ? `${report.year_from}–${report.year_to}` : "";
  const lens = report.report_config?.lens || "";

  // Group blocks into sections, exactly as the on-screen document does.
  const sections = [];
  for (const b of doc.blocks || []) {
    const key = b.sectionKey || "_";
    let cur = sections[sections.length - 1];
    if (!cur || cur.key !== key) { sections.push({ key, title: null, lead: null, eyebrow: null, blocks: [] }); cur = sections[sections.length - 1]; }
    if (b.type === "h2" && cur.blocks.length === 0) { cur.title = b.text; continue; }
    if (b.type === "lead") { cur.lead = b.data?.text || null; cur.eyebrow = b.data?.eyebrow || null; continue; }
    cur.blocks.push(b);
  }

  const pieces = doc.blocks?.find((b) => b.type === "kpi")?.data?.items?.[0]?.value || "";
  let n = 0;

  return (
    <div className="gw-shell">
      <style>{PRINT_CSS}</style>

      <div className="gw-noprint" style={{ position: "fixed", top: 14, right: 14, zIndex: 50, display: "flex", gap: 8 }}>
        <button onClick={() => window.print()} className="gw-ember-btn"
          style={{ background: "var(--accent-ember-deep)", color: "#fff", border: "none", borderRadius: 8, padding: "10px 18px", cursor: "pointer", fontFamily: "var(--font-body)", fontWeight: 500, fontSize: 13 }}>
          Save as PDF
        </button>
      </div>

      <div className="gw-doc">
        {/* ── COVER ── */}
        <div className="sheet" style={{ height: "297mm", background: "var(--paper)", padding: "26mm 22mm", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, letterSpacing: ".14em", color: "var(--ink-900)" }}>GROUNDWORK</span>
            <span style={EYB}>CONFIDENTIAL · {stamp}</span>
          </div>
          <div>
            <div style={{ ...EYB, color: "var(--accent-ember-deep)" }}>{(card?.title || "Report").toUpperCase()}</div>
            <div style={{ width: 56, height: 3, background: "var(--accent-ember)", margin: "20px 0 22px" }} />
            <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 46, lineHeight: 1.04, letterSpacing: "-.01em", margin: 0, color: "var(--ink-900)" }}>{report.title}</h1>
            {card?.description && (
              <p style={{ fontFamily: "var(--font-body)", fontSize: 15, lineHeight: 1.55, color: "var(--text-secondary)", maxWidth: 470, margin: "26px 0 0" }}>{card.description}</p>
            )}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", borderTop: "1px solid var(--paper-edge)", paddingTop: 22, gap: 20 }}>
            <div style={{ minWidth: 0 }}>
              <div style={EYB}>Prepared by</div>
              <div style={{ fontFamily: "var(--font-body)", fontSize: 13.5, color: "var(--ink-900)", marginTop: 4 }}>{report.created_by || "Knots & Dots"}</div>
            </div>
            <div style={{ textAlign: "center", minWidth: 0 }}>
              <div style={EYB}>Corpus</div>
              <div style={{ fontFamily: "var(--font-body)", fontSize: 13.5, color: "var(--ink-900)", marginTop: 4 }}>
                {[pieces && `${pieces} pieces`, brands.length && `${brands.length} brands`, period].filter(Boolean).join(" · ") || "—"}
              </div>
            </div>
            <div style={{ textAlign: "right", minWidth: 0 }}>
              <div style={EYB}>Lens</div>
              <div style={{ fontFamily: "var(--font-body)", fontSize: 13.5, color: "var(--ink-900)", marginTop: 4, textTransform: "capitalize" }}>{lens || "—"}</div>
            </div>
          </div>
        </div>

        {/* ── SECTIONS ── */}
        {sections.map((sec, si) => {
          const numeral = sec.title ? String(++n).padStart(2, "0") : null;
          return (
            <section key={si} style={{ marginBottom: 34, paddingBottom: 26, borderBottom: si === sections.length - 1 ? "none" : "1px solid var(--border-hairline)" }}>
              {sec.title && (
                <div className="sec-head" style={{ display: "flex", alignItems: "flex-start", gap: 20, marginBottom: 20 }}>
                  <span style={{ fontFamily: "var(--font-numeral)", fontWeight: 700, fontSize: 38, lineHeight: .9, color: "var(--ink-200)", flex: "none" }}>{numeral}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {sec.eyebrow && <div style={{ ...EYB, color: "var(--accent-ember-deep)" }}>{sec.eyebrow}</div>}
                    <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 24, lineHeight: 1.15, letterSpacing: "-.01em", color: "var(--ink-900)", margin: sec.eyebrow ? "8px 0 0" : 0 }}>{sec.title}</h2>
                    {sec.lead && <p style={{ fontFamily: "var(--font-body)", fontStyle: "italic", fontSize: 14.5, lineHeight: 1.45, color: "var(--text-secondary)", margin: "10px 0 0", maxWidth: 620 }}>{sec.lead}</p>}
                  </div>
                </div>
              )}
              <SectionBody blocks={sec.blocks} />
            </section>
          );
        })}

        {/* ── CLOSING ── */}
        <div className="sheet-end" style={{ height: "297mm", background: "var(--ink-800)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 26, padding: "60px" }}>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 17, letterSpacing: ".16em", color: "var(--brand-cream)" }}>GROUNDWORK</div>
          <p style={{ fontFamily: "var(--font-body)", fontSize: 13, lineHeight: 1.6, color: "#9a9a9a", margin: 0, maxWidth: 360, textAlign: "center" }}>
            {report.title}. {pieces ? `Generated from ${pieces} analysed pieces.` : ""} groundwork.kad.london
          </p>
          <div style={{ display: "flex", gap: 26 }}>
            <span style={{ ...EYB, color: "#7a7a7a" }}>Confidential</span>
            <span style={{ ...EYB, color: "#7a7a7a" }}>{stamp}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Prose and visuals in order. Citations become absolute case URLs, so a link clicked in the
// printed PDF opens the piece in Groundwork rather than going nowhere.
function SectionBody({ blocks }) {
  const out = [];
  let buf = [];
  const flush = (k) => {
    if (!buf.length) return;
    out.push(<Prose key={`t${k}`} md={buf.join("\n\n")} />);
    buf = [];
  };
  blocks.forEach((b, i) => {
    if (isVisualBlock(b)) { flush(i); out.push(<ReportBlock key={b.id || i} block={b} />); return; }
    if (b.type === "h2") buf.push(`### ${b.text}`);
    else if (b.type === "h3") buf.push(`#### ${b.text}`);
    else if (b.type === "bullets") buf.push((b.items || []).map((x) => `- ${x}`).join("\n"));
    else if (b.type === "numbered") buf.push((b.items || []).map((x, n) => `${n + 1}. ${x}`).join("\n"));
    else if (b.type === "quote") buf.push(`> ${b.text}`);
    else if (b.text) buf.push(b.text);
  });
  flush("end");
  return <>{out}</>;
}

function Prose({ md }) {
  const withLinks = String(md || "")
    .replace(/\[ENTRY:([^\]]+)\]/g, (_m, id) => `[case](${caseUrl(id.trim())})`)
    .replace(/\]\((?:cite:|__cite__)([^)]+)\)/g, (_m, id) => `](${caseUrl(id.trim())})`);
  return (
    <div style={{ fontFamily: "var(--font-body)", fontSize: 13.5, lineHeight: 1.62, color: "var(--ink-700)" }}>
      <Markdown urlTransform={(u) => u}>{withLinks}</Markdown>
    </div>
  );
}

export default function ReportPrintPage() {
  return (
    <AuthGuard>
      <Suspense fallback={null}>
        <PrintContent />
      </Suspense>
    </AuthGuard>
  );
}
