"use client";
import { Fragment } from "react";
// Rich report blocks (F4). Renders the visual vocabulary the v3 handoff specifies —
// KPI row, ranking bars, format split, comparison heatmap, white-space 2×2, pull-quote.
//
// Values come from lib/report-visuals, which computes them from the engines' own stats,
// so nothing here invents a number. Text stays the protagonist; visuals support it.
//
// Palette: mono ink + ONE ember accent for the hero/leader. The warm data palette
// (clay/ochre/taupe) is used ONLY where a chart genuinely needs multiple series.
const WARM = ["var(--ink-800)", "#BE6B45", "#C6A15B", "#A89B88", "var(--ink-300)"];
const TRACK = "#ece5db";

const CARD = {
  background: "var(--brand-white)", border: "1px solid var(--border-hairline)",
  borderRadius: 12, padding: "18px 20px", margin: "18px 0",
};
const EYEBROW = {
  fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: ".16em",
  textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 14,
};

const nf = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v ?? "");
  return n >= 1e6 ? (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M"
    : n >= 1e3 ? (n / 1e3).toFixed(1).replace(/\.0$/, "") + "K" : String(n);
};

// Where the numbers come from. MEASURED is counted from captured pieces; ANALYST READ is
// the engine's judgement returned as data, because no count exists for it.
export function Provenance({ analyst, label }) {
  return analyst
    ? <span className="gw-anly"><span className="dot" />{label || "Analyst read"}</span>
    : <span className="gw-meas"><span className="dot" />{label || "Measured"}</span>;
}

// Chart cards carry a title on the left, then the unit hint and the provenance mark.
function CardHead({ title, hint, analyst, markLabel, mark = true }) {
  if (!title && !hint && !mark) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
      {title && <span style={{ fontFamily: "var(--font-body)", fontSize: 13.5, fontWeight: 600, color: "var(--ink-900)" }}>{title}</span>}
      <span style={{ display: "inline-flex", alignItems: "center", gap: 10, marginLeft: "auto" }}>
        {hint && <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--text-muted)" }}>{hint}</span>}
        {mark && <Provenance analyst={analyst} label={markLabel} />}
      </span>
    </div>
  );
}

const LBL = {
  fontFamily: "var(--font-mono)", fontSize: 8, letterSpacing: ".14em",
  textTransform: "uppercase", color: "var(--text-muted)",
};

export default function ReportBlock({ block }) {
  if (!block) return null;
  switch (block.type) {
    case "kpi": return <KpiRow data={block.data} />;
    case "bars": return <Bars data={block.data} />;
    case "split": return <Split data={block.data} />;
    case "heatmap": return <Heatmap data={block.data} />;
    case "quadrant": return <Quadrant data={block.data} />;
    case "pullquote": return <PullQuote data={block.data} />;
    case "compare": return <Compare data={block.data} />;
    case "cases": return <Cases data={block.data} />;
    case "timeline": return <Timeline data={block.data} />;
    case "plays": return <Plays data={block.data} />;
    default: return null;
  }
}

export const isVisualBlock = (b) =>
  b && ["kpi", "bars", "split", "heatmap", "quadrant", "pullquote", "compare", "cases", "timeline", "plays"].includes(b.type);

function KpiRow({ data = {} }) {
  const items = data.items || [];
  if (!items.length) return null;
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(items.length, 4)}, minmax(0,1fr))`, gap: 12, margin: "18px 0" }}>
      {items.map((i, n) => (
        <div key={n} style={{ ...CARD, margin: 0, padding: "16px 18px" }}>
          <div style={{ ...EYEBROW, marginBottom: 10 }}>{i.label}</div>
          <div style={{ fontFamily: "var(--font-numeral)", fontSize: 34, lineHeight: 1, color: i.hero ? "var(--accent-ember)" : "var(--ink-900)" }}>{i.value}</div>
          {i.caption && <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-muted)", marginTop: 8 }}>{i.caption}</div>}
        </div>
      ))}
    </div>
  );
}

function Bars({ data = {} }) {
  const items = data.items || [];
  if (!items.length) return null;
  const max = data.max || Math.max(1, ...items.map((i) => Number(i.value) || 0));
  return (
    <div style={CARD}>
      <CardHead title={data.title} hint={data.hint} />
      <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
        {items.map((i, n) => (
          <div key={n} style={{ display: "grid", gridTemplateColumns: "132px 1fr 58px", alignItems: "center", gap: 12 }}>
            <span style={{ fontFamily: "var(--font-body)", fontSize: 12.5, color: "var(--ink-800)", textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{i.label}</span>
            <div style={{ height: 14, borderRadius: 7, background: TRACK, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${Math.max(2, ((Number(i.value) || 0) / max) * 100)}%`, borderRadius: 7, background: i.hero ? "var(--accent-ember)" : "var(--ink-800)" }} />
            </div>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)", textAlign: "right" }}>{i.display || nf(i.value)}</span>
          </div>
        ))}
      </div>
      {items.some((i) => i.caption) && (
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, color: "var(--text-muted)", marginTop: 12 }}>
          {items.filter((i) => i.caption).map((i) => `${i.label}: ${i.caption}`).join("  ·  ")}
        </div>
      )}
    </div>
  );
}

function Split({ data = {} }) {
  const items = (data.items || []).filter((i) => Number(i.value) > 0);
  if (!items.length) return null;
  const total = items.reduce((s, i) => s + Number(i.value), 0) || 1;
  return (
    <div style={CARD}>
      <CardHead title={data.title} />
      <div style={{ display: "flex", height: 22, borderRadius: 11, overflow: "hidden" }}>
        {items.map((i, n) => (
          <div key={n} title={`${i.label} ${Math.round((i.value / total) * 100)}%`}
            style={{ width: `${(i.value / total) * 100}%`, background: WARM[n % WARM.length] }} />
        ))}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 18px", marginTop: 12 }}>
        {items.map((i, n) => (
          <span key={n} style={{ display: "inline-flex", alignItems: "center", gap: 7, fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--text-secondary)" }}>
            <span style={{ width: 9, height: 9, borderRadius: 3, background: WARM[n % WARM.length] }} />
            {i.label} {Math.round((i.value / total) * 100)}%
          </span>
        ))}
      </div>
    </div>
  );
}

function Heatmap({ data = {} }) {
  const { rows = [], cols = [], cells = [], hero = null } = data;
  if (!rows.length || !cols.length) return null;
  const flat = cells.flat().map(Number).filter(Number.isFinite);
  const max = Math.max(1, ...flat);
  return (
    <div style={{ ...CARD, overflowX: "auto" }}>
      <CardHead title={data.title} />
      <table style={{ borderCollapse: "separate", borderSpacing: 3, minWidth: 420 }}>
        <thead>
          <tr>
            <th />
            {cols.map((c) => (
              <th key={c} style={{ ...EYEBROW, marginBottom: 0, padding: "0 4px 8px", textAlign: "left", fontWeight: 500, verticalAlign: "bottom" }}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={r}>
              <td style={{ fontFamily: "var(--font-body)", fontSize: 12.5, color: "var(--ink-800)", paddingRight: 10, whiteSpace: "nowrap" }}>{r}</td>
              {cols.map((c, ci) => {
                const v = Number((cells[ri] || [])[ci]) || 0;
                const isHero = hero && hero[0] === ri && hero[1] === ci;
                return (
                  <td key={c} style={{ padding: 0 }}>
                    <div title={`${r} · ${c}: ${v}`} style={{
                      height: 30, minWidth: 52, borderRadius: 6,
                      background: isHero ? "var(--accent-ember)" : `rgba(26,26,26,${0.06 + (v / max) * 0.62})`,
                    }} />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: ".1em", color: "var(--text-muted)" }}>
        WEAK
        <span style={{ display: "flex", gap: 2 }}>
          {[0.08, 0.22, 0.38, 0.54, 0.68].map((o) => <span key={o} style={{ width: 16, height: 8, borderRadius: 2, background: `rgba(26,26,26,${o})` }} />)}
        </span>
        STRONG
      </div>
    </div>
  );
}

// White-space 2×2. Items are BUCKETED into the four quadrants and laid out as pills
// inside each cell — free scatter piled dozens of labels on top of each other and made
// the chart unreadable. The open + in-demand cell is the opportunity, marked ember.
function Quadrant({ data = {} }) {
  const raw = data.points || [];
  if (raw.length < 3) return null;

  // Be robust to any stored data: blocks are persisted inside the document, so a report
  // generated before the bucketing existed still arrives here. If open/wanted are missing,
  // derive them from x/y around the medians; and cap per cell whatever the source said, so
  // an old uncapped block can't stack forty pills down one column.
  const med = (vals) => { const s = [...vals].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0; };
  const needsDerive = raw.some((p) => p.open === undefined || p.wanted === undefined);
  const xm = med(raw.map((p) => Number(p.x) || 0));
  const ym = med(raw.map((p) => Number(p.y) || 0));
  const pts = raw.map((p) => needsDerive
    ? { ...p, open: (Number(p.x) || 0) <= xm, wanted: (Number(p.y) || 0) >= ym, hero: (Number(p.x) || 0) <= xm && (Number(p.y) || 0) >= ym }
    : p);

  const PER_CELL = 4;
  const cell = (open, wanted) => pts
    .filter((p) => !!p.open === open && !!p.wanted === wanted)
    .sort((a, b) => (open ? (Number(b.y) || 0) - (Number(a.y) || 0) : (Number(b.x) || 0) - (Number(a.x) || 0)))
    .slice(0, PER_CELL);
  const Cell = ({ open, wanted, corner }) => {
    const items = cell(open, wanted);
    return (
      <div style={{ minHeight: 104, padding: 12, display: "flex", flexDirection: "column", gap: 7, alignItems: open ? "flex-start" : "flex-end", justifyContent: wanted ? "flex-start" : "flex-end" }}>
        {corner && <span style={{ fontFamily: "var(--font-mono)", fontSize: 8.5, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--ink-300)" }}>{corner}</span>}
        {items.map((p, n) => (
          <span key={n} style={{
            display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 16, maxWidth: "100%",
            background: p.hero ? "var(--accent-ember)" : "var(--brand-white)",
            border: `1px solid ${p.hero ? "var(--accent-ember)" : "var(--border-hairline)"}`,
            color: p.hero ? "#fff" : "var(--text-secondary)",
            fontFamily: "var(--font-body)", fontSize: 12, fontWeight: p.hero ? 600 : 400,
          }}>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.label}{p.caption ? <span style={{ opacity: .65, fontWeight: 400 }}> · {p.caption}</span> : null}</span>
            {p.hero && <span style={{ flex: "none" }}>✦</span>}
          </span>
        ))}
      </div>
    );
  };
  return (
    <div style={CARD}>
      <CardHead title={data.title} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", border: "1px solid var(--border-hairline)", borderRadius: 10, overflow: "hidden", background: "var(--paper)" }}>
        <div style={{ borderRight: "1px dashed var(--border-strong)", borderBottom: "1px dashed var(--border-strong)" }}><Cell open wanted corner="LOW SUPPLY · HIGH DEMAND" /></div>
        <div style={{ borderBottom: "1px dashed var(--border-strong)" }}><Cell open={false} wanted corner="CROWDED · HIGH DEMAND" /></div>
        <div style={{ borderRight: "1px dashed var(--border-strong)" }}><Cell open wanted={false} /></div>
        <div><Cell open={false} wanted={false} /></div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--text-muted)", marginTop: 10 }}>
        <span>{data.xLabel || "supply →"}</span>
        <span>{data.yLabel || "↑ demand"}</span>
      </div>
      {/* Without this the chart is a puzzle: it never said what ember meant. */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border-hairline)" }}>
        <span style={{ flex: "none", display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 14, background: "var(--accent-ember)", color: "#fff", fontFamily: "var(--font-body)", fontSize: 11, fontWeight: 600 }}>✦</span>
        <span style={{ fontFamily: "var(--font-body)", fontSize: 12, lineHeight: 1.5, color: "var(--text-secondary)" }}>
          <b>The white space</b> — {data.qualitative
            ? <>the openings named in this section: little worked by the category, but with real pull. Both axes are the analyst&rsquo;s read of the evidence, not a count.</>
            : <>territories few brands publish that still perform well. Positions come from the captured pieces and their ratings.</>}
        </span>
      </div>
    </div>
  );
}

function PullQuote({ data = {} }) {
  if (!data.text) return null;
  return (
    <blockquote style={{ margin: "22px 0", padding: "4px 0 4px 20px", borderLeft: "3px solid var(--accent-ember)" }}>
      <p style={{ fontFamily: "var(--font-display)", fontSize: 19, lineHeight: 1.45, color: "var(--ink-900)", margin: 0 }}>{data.text}</p>
      {data.attribution && <cite style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--text-muted)", marginTop: 10, fontStyle: "normal" }}>{data.attribution}</cite>}
    </blockquote>
  );
}

// ── compare · declares / demonstrates / gap ──────────────────────────────────
// Serves Positioning x-ray and Declared vs deployed — one design, two sections. The GAP is
// the conclusion, so it gets the widest column, an ember rule and a tint fill: it must read
// loudest. Rows avoid page breaks so a brand is never split across a printed page.
function Compare({ data = {} }) {
  const rows = (data.items || []).filter((r) => r && (r.brand || r.declares || r.demonstrates || r.gap));
  if (!rows.length) return null;
  const cols = "150px 1fr 1fr 1.15fr";
  const cell = { padding: "16px 18px", fontFamily: "var(--font-body)", fontSize: 12.5, lineHeight: 1.5, color: "var(--ink-700)" };
  const dash = (v) => (v && String(v).trim()) || "—";
  return (
    <div style={{ margin: "18px 0" }}>
      <CardHead title={data.title || "Declared vs demonstrated"} analyst />
      <div style={{ background: "var(--brand-white)", border: "1px solid var(--border-hairline)", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: cols, background: "var(--paper)", borderBottom: "1px solid var(--border-hairline)" }}>
          <div style={{ ...LBL, padding: "14px 18px" }}>{data.brandLabel || "Brand"}</div>
          <div style={{ ...LBL, padding: "14px 18px" }}>{data.declaresLabel || "What it declares"}</div>
          <div style={{ ...LBL, padding: "14px 18px" }}>{data.demonstratesLabel || "What it demonstrates"}</div>
          <div style={{ ...LBL, padding: "14px 18px", color: "var(--accent-ember-deep)" }}>{data.gapLabel || "The gap"}</div>
        </div>
        {rows.map((r, i) => (
          <div key={i} className="gw-nobreak" style={{ display: "grid", gridTemplateColumns: cols, borderBottom: i === rows.length - 1 ? "none" : "1px solid var(--border-hairline)" }}>
            <div style={{ padding: "16px 18px", fontFamily: "var(--font-body)", fontSize: 14, fontWeight: 600, color: "var(--ink-900)" }}>{dash(r.brand)}</div>
            <div style={cell}>{dash(r.declares)}</div>
            <div style={cell}>{dash(r.demonstrates)}</div>
            <div style={{ ...cell, background: "#fff6f1", borderLeft: "2px solid var(--accent-ember)", color: "var(--ink-900)", fontWeight: 500 }}>{dash(r.gap)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── cases · curated gallery ──────────────────────────────────────────────────
// The heart of Global Creative Inspiration. The TRANSFERABLE IDEA is what the client takes
// away, so it is pulled out of the body into its own ember-tint card. Thumbnails are often
// missing — that state is designed, not an accident.
function Cases({ data = {} }) {
  const items = (data.items || []).filter((c) => c && (c.what || c.brand));
  if (!items.length) return null;
  return (
    <div style={{ margin: "18px 0" }}>
      <CardHead title={data.title || "The cases"} hint={`${items.length} cases`} markLabel="Measured + read" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
        {items.map((c, i) => {
          const stars = Math.max(0, Math.min(5, Number(c.rating) || 0));
          return (
            <div key={c.id || i} className="gw-nobreak" style={{ background: "var(--brand-white)", border: "1px solid var(--border-hairline)", borderRadius: 12, overflow: "hidden", display: "flex", flexDirection: "column" }}>
              <div style={{ aspectRatio: "16/10", background: "var(--ink-900)", position: "relative" }}>
                {c.thumb
                  ? <img src={c.thumb} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                  : <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, color: "#6f685f" }}>
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="m3 16 5-5 4 4 3-3 6 6" /><circle cx="8.5" cy="8.5" r="1.5" /></svg>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: ".1em", color: "#6f685f" }}>No frame yet</span>
                    </div>}
              </div>
              <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--ink-800)" }}>{c.meta || ""}</span>
                  {stars > 0 && (
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: 1, flex: "none" }}>
                      <span style={{ color: "var(--accent-ember)" }}>{"★".repeat(stars)}</span><span style={{ color: "#d8d2c9" }}>{"★".repeat(5 - stars)}</span>
                    </span>
                  )}
                </div>
                {c.brand && <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 16, lineHeight: 1.2, marginTop: 8, color: "var(--ink-900)" }}>{c.brand}</div>}
                {c.what && <div style={{ marginTop: 10 }}><div style={LBL}>What it is</div><p style={{ fontFamily: "var(--font-body)", fontSize: 12.5, lineHeight: 1.5, color: "var(--ink-700)", margin: "4px 0 0" }}>{c.what}</p></div>}
                {c.why && <div style={{ marginTop: 10 }}><div style={LBL}>Why it works</div><p style={{ fontFamily: "var(--font-body)", fontSize: 12.5, lineHeight: 1.5, color: "var(--ink-700)", margin: "4px 0 0" }}>{c.why}</p></div>}
                {c.idea && (
                  <div style={{ marginTop: 12, background: "#fff6f1", border: "1px solid var(--accent-ember-tint)", borderRadius: 10, padding: "11px 13px" }}>
                    <div style={{ ...LBL, color: "var(--accent-ember-deep)" }}>Transferable idea</div>
                    <p style={{ fontFamily: "var(--font-body)", fontSize: 12.5, lineHeight: 1.5, color: "var(--ink-900)", fontWeight: 500, margin: "5px 0 0" }}>{c.idea}</p>
                  </div>
                )}
                {c.id && <a href={`/case/${encodeURIComponent(String(c.id))}`} data-cite-id={String(c.id)} style={{ marginTop: 14, fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: ".04em", color: "var(--accent-ember-deep)", textDecoration: "none" }}>See the case →</a>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── timeline · message consistency ───────────────────────────────────────────
// Whether the hero message holds or drifts, by year and channel. An ember dot marks where
// it changes; a blank cell means nothing was captured that year.
function Timeline({ data = {} }) {
  const rows = (data.rows || []).filter((r) => r && r.channel);
  const years = data.years || [];
  if (!rows.length || !years.length) return null;
  const verdict = data.verdict || "";
  return (
    <div style={{ margin: "18px 0" }}>
      <CardHead title={data.title || "Hero message"} analyst={data.analyst !== false} />
      <div style={{ background: "var(--brand-white)", border: "1px solid var(--border-hairline)", borderRadius: 12, padding: "26px 28px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 18 }}>
          <div style={LBL}>{data.hint || "Hero message · by channel and year"}</div>
          {verdict && <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: ".14em", textTransform: "uppercase", background: "var(--accent-ember-tint)", border: "1px solid var(--accent-ember)", color: "#7a3a24", borderRadius: 20, padding: "4px 10px" }}>{verdict}</span>}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: `120px repeat(${years.length}, 1fr)`, gap: "0 10px", alignItems: "center" }}>
          <div />
          {years.map((y) => <div key={y} style={{ ...LBL, textAlign: "center" }}>{y}</div>)}
          {rows.map((r, ri) => (
            <Fragment key={r.channel || ri}>
              <div style={{ fontFamily: "var(--font-body)", fontSize: 13, color: "var(--ink-900)", padding: "10px 0" }}>{r.channel}</div>
              {years.map((y, yi) => {
                const cell = (r.cells || [])[yi];
                if (!cell || !cell.message) return <div key={y} style={{ padding: "10px 0" }} />;
                return (
                  <div key={y} style={{ padding: "10px 6px", textAlign: "center" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, maxWidth: "100%" }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", flex: "none", background: cell.changed ? "var(--accent-ember)" : "var(--ink-800)" }} />
                      <span title={cell.message} style={{ fontFamily: "var(--font-body)", fontSize: 11.5, color: "var(--ink-700)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cell.message}</span>
                    </span>
                  </div>
                );
              })}
            </Fragment>
          ))}
        </div>
        <div style={{ marginTop: 16, display: "flex", gap: 18, fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--text-muted)" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--ink-800)" }} />Message holds</span>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--accent-ember)" }} />Changes here</span>
        </div>
      </div>
    </div>
  );
}

// ── plays · prioritised recommendations ──────────────────────────────────────
// One block for the three reports that end in a list of actions. Rank orders them; the
// impact / effort chips only appear when the engine returns them.
function Plays({ data = {} }) {
  const items = (data.items || []).filter((p) => p && (p.name || p.move));
  if (!items.length) return null;
  return (
    <div style={{ margin: "18px 0" }}>
      <CardHead title={data.title || "What to do"} mark={false} />
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {items.map((p, i) => (
          <div key={i} className="gw-nobreak" style={{ background: "var(--brand-white)", border: "1px solid var(--border-hairline)", borderRadius: 12, padding: "20px 24px", display: "flex", gap: 20, alignItems: "flex-start" }}>
            <span style={{ fontFamily: "var(--font-numeral)", fontWeight: 700, fontSize: 34, lineHeight: 0.9, color: "var(--accent-ember)", flex: "none" }}>{i + 1}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 17, lineHeight: 1.2, color: "var(--ink-900)" }}>{p.name || `Play ${i + 1}`}</span>
                {p.impact && <Chip>{`Impact · ${p.impact}`}</Chip>}
                {p.effort && <Chip>{`Effort · ${p.effort}`}</Chip>}
              </div>
              {p.move && <p style={{ fontFamily: "var(--font-body)", fontSize: 13, lineHeight: 1.55, color: "var(--ink-700)", margin: "8px 0 0", maxWidth: 760 }}>{p.move}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Chip({ children }) {
  return <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--text-secondary)", background: "var(--paper)", border: "1px solid var(--border-hairline)", borderRadius: 20, padding: "4px 10px" }}>{children}</span>;
}
