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
  const items = (data.items || []).slice(0, 4);
  if (!items.length) return null;
  return (
    <div className="gw-nobreak" style={{ ...CARD, padding: 26 }}>
      <CardHead title={data.title} hint={data.hint} mark={!!data.title} />
      {/* auto-fit rather than a fixed 4 columns: the grid falls to 2-up in the PDF's
          narrower box instead of crushing the numerals. */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 14 }}>
        {items.map((i, n) => (
          <div key={n} style={{
            background: i.hero ? "var(--ink-900)" : "var(--paper)",
            border: i.hero ? "1px solid var(--ink-900)" : "1px solid var(--border-hairline)",
            borderRadius: 12, padding: 18,
          }}>
            <div style={{ ...LBL, color: i.hero ? "#8a8378" : "var(--text-muted)" }}>{i.label}</div>
            <div style={{ fontFamily: "var(--font-numeral)", fontWeight: 700, fontSize: 44, lineHeight: 1, marginTop: 10, color: i.hero ? "var(--accent-ember)" : "var(--ink-900)" }}>{i.value}</div>
            {i.caption && <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: i.hero ? "#8a8378" : "var(--text-muted)", marginTop: 8 }}>{i.caption}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

function Bars({ data = {} }) {
  const items = data.items || [];
  if (!items.length) return null;
  const max = data.max || Math.max(1, ...items.map((i) => Number(i.value) || 0));
  return (
    <div className="gw-nobreak" style={{ ...CARD, padding: "26px 28px" }}>
      <CardHead title={data.title} hint={data.hint} />
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {items.map((i, n) => (
          <div key={n} style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ width: 190, flex: "none", fontFamily: "var(--font-body)", fontSize: 13, color: "var(--ink-900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{i.label}</div>
            <div style={{ flex: 1, height: 22, background: "var(--paper)", borderRadius: 5, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${Math.max(2, ((Number(i.value) || 0) / max) * 100)}%`, background: i.hero ? "var(--accent-ember)" : "var(--ink-800)" }} />
            </div>
            <div style={{ width: 42, flex: "none", textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--ink-700)" }}>{i.display || nf(i.value)}</div>
          </div>
        ))}
      </div>
      {items.some((i) => i.caption) && (
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, color: "var(--text-muted)", marginTop: 14 }}>
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
  const pct = (v) => Math.round((Number(v) / total) * 100);
  return (
    <div className="gw-nobreak" style={{ ...CARD, padding: "26px 28px" }}>
      <CardHead title={data.title} hint={data.hint} />
      {/* The one block where multiple colours are allowed — a mix genuinely has series. */}
      <div style={{ display: "flex", height: 34, borderRadius: 8, overflow: "hidden" }}>
        {items.map((i, n) => (
          <div key={n} title={`${i.label} ${pct(i.value)}%`}
            style={{ width: `${(Number(i.value) / total) * 100}%`, background: WARM[n % WARM.length], display: "flex", alignItems: "center", paddingLeft: 12, overflow: "hidden" }}>
            {/* Below 5% the label cannot fit and would clip mid-digit. */}
            {pct(i.value) >= 5 && <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "#fff", whiteSpace: "nowrap" }}>{pct(i.value)}%</span>}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 20px", marginTop: 16 }}>
        {items.map((i, n) => (
          <span key={n} style={{ display: "inline-flex", alignItems: "center", gap: 7, fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--text-secondary)" }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: WARM[n % WARM.length] }} />
            {i.label} {pct(i.value)}%
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
    <div className="gw-nobreak" style={{ ...CARD, padding: "26px 28px", overflowX: "auto" }}>
      <CardHead title={data.title} hint={data.hint} />
      <div style={{ display: "grid", gridTemplateColumns: `150px repeat(${cols.length}, minmax(90px, 1fr))`, gap: 6, minWidth: 150 + cols.length * 96 }}>
        <div />
        {cols.map((c) => <div key={c} style={{ ...LBL, textAlign: "center" }}>{c}</div>)}
        {rows.map((r, ri) => (
          <Fragment key={r}>
            <div style={{ fontFamily: "var(--font-body)", fontSize: 13, color: "var(--ink-900)", display: "flex", alignItems: "center" }}>{r}</div>
            {cols.map((c, ci) => {
              const raw = (cells[ri] || [])[ci];
              const has = raw !== null && raw !== undefined && raw !== "";
              const v = Number(raw) || 0;
              const isHero = hero && hero[0] === ri && hero[1] === ci;
              const strength = v / max;
              return (
                <div key={c} title={`${r} · ${c}: ${has ? v : "—"}`} style={{
                  height: 38, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center",
                  background: !has ? "var(--paper)" : isHero ? "var(--accent-ember)" : `rgba(26,26,26,${0.06 + strength * 0.62})`,
                  fontFamily: "var(--font-mono)", fontSize: 11,
                  color: !has ? "var(--ink-300)" : (isHero || strength > 0.55) ? "#fff" : "var(--ink-800)",
                }}>{has ? v : "—"}</div>
              );
            })}
          </Fragment>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 16, fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--text-muted)" }}>
        Weak
        <span style={{ width: 120, height: 8, borderRadius: 4, background: "linear-gradient(90deg,#efe7dc,var(--ink-900))" }} />
        Strong
      </div>
    </div>
  );
}

// The 2×2 field. The handoff plots it — 3 to 8 points on a 340px field, the opportunity
// ringed in dashed ember — so the builders cap what they send. Earlier this rendered as
// bucketed pills because the landscape section pushed sixty territories at it and free
// scatter piled them on top of each other; the cap moved upstream, where it belongs.
function Quadrant({ data = {} }) {
  const raw = (data.points || []).slice(0, 8);
  if (raw.length < 3) return null;

  // Stored blocks come from any version of the generator, so derive what may be missing
  // rather than trusting the payload.
  const med = (vals) => { const s = [...vals].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0; };
  const xs = raw.map((p) => Number(p.x) || 0), ys = raw.map((p) => Number(p.y) || 0);
  const xm = med(xs), ym = med(ys);
  const span = (arr) => { const lo = Math.min(...arr), hi = Math.max(...arr); return { lo, range: hi - lo || 1 }; };
  const sx = span(xs), sy = span(ys);

  // Map into the plot with an inset so labels never touch the frame.
  const place = (v, s) => 12 + ((v - s.lo) / s.range) * 76;
  const pts = raw.map((p) => {
    const x = Number(p.x) || 0, y = Number(p.y) || 0;
    const hero = p.hero !== undefined ? p.hero : (x <= xm && y >= ym);
    return { ...p, hero, left: place(x, sx), top: 100 - place(y, sy) };
  });

  // Two points on identical coordinates would print one label on top of the other; nudge
  // the later one just enough to read.
  for (let i = 1; i < pts.length; i++) {
    for (let j = 0; j < i; j++) {
      if (Math.abs(pts[i].left - pts[j].left) < 9 && Math.abs(pts[i].top - pts[j].top) < 11) {
        pts[i].left = Math.min(92, pts[i].left + 9);
        pts[i].top = Math.min(88, pts[i].top + 11);
      }
    }
  }

  const corner = { position: "absolute", fontFamily: "var(--font-mono)", fontSize: 8.5, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--text-muted)" };
  const [xLo, xHi] = String(data.xLabel || "little worked ↔ crowded").split("↔").map((t) => t.trim());
  const [yLo, yHi] = String(data.yLabel || "↑ pull with the audience").replace("↑", "").trim().split("↔").map((t) => t.trim());

  return (
    <div className="gw-nobreak" style={{ ...CARD, padding: "26px 28px" }}>
      <CardHead title={data.title} analyst={data.qualitative !== false} />
      <div style={{ position: "relative", height: 340, border: "1px solid var(--border-hairline)", borderRadius: 12, background: "var(--paper)" }}>
        <div style={{ ...corner, top: 12, left: 14 }}>{yHi || yLo || "High"}</div>
        <div style={{ ...corner, bottom: 12, left: 14 }}>{yLo && yHi ? yLo : "Low"}</div>
        <div style={{ ...corner, top: 12, right: 14 }}>{xHi || "crowded →"}</div>
        <div style={{ ...corner, bottom: 12, right: 14 }}>{`← ${xLo || "little worked"}`}</div>
        <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, borderLeft: "1px dashed var(--border-strong)" }} />
        <div style={{ position: "absolute", top: "50%", left: 0, right: 0, borderTop: "1px dashed var(--border-strong)" }} />
        {pts.map((p, n) => (
          <div key={n} style={{ position: "absolute", left: `${p.left}%`, top: `${p.top}%`, transform: "translate(-50%,-50%)", display: "flex", flexDirection: "column", alignItems: "center", gap: p.hero ? 8 : 6, maxWidth: 168 }}>
            {p.hero
              ? <span style={{ width: 30, height: 30, borderRadius: "50%", border: "2px dashed var(--accent-ember)", background: "#fff6f1" }} />
              : <span style={{ width: 13, height: 13, borderRadius: "50%", background: "var(--ink-800)" }} />}
            <span style={{
              fontFamily: p.hero ? "var(--font-mono)" : "var(--font-body)", fontSize: p.hero ? 11 : 11.5,
              fontWeight: p.hero ? 600 : 400, color: p.hero ? "var(--accent-ember-deep)" : "var(--ink-700)",
              textAlign: "center", lineHeight: 1.25,
            }}>{p.label}{p.caption ? <span style={{ opacity: .6 }}> · {p.caption}</span> : null}</span>
          </div>
        ))}
      </div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: ".08em", color: "var(--text-muted)", marginTop: 12, lineHeight: 1.5 }}>
        {data.qualitative !== false
          ? "Axes are qualitative — the analyst's read of the field, not a count. The dashed ember ring marks the open, in-demand territory."
          : "Positions come from the captured pieces and their ratings. The dashed ember ring marks the open, in-demand territory."}
      </div>
    </div>
  );
}

function PullQuote({ data = {} }) {
  if (!data.text) return null;
  return (
    <div className="gw-nobreak" style={{ ...CARD, padding: "34px 38px" }}>
      <div style={{ borderLeft: "3px solid var(--accent-ember)", paddingLeft: 24 }}>
        <p style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 26, lineHeight: 1.28, color: "var(--ink-900)", margin: 0 }}>&ldquo;{data.text}&rdquo;</p>
        {data.attribution && <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--text-muted)", marginTop: 16 }}>{data.attribution}</div>}
      </div>
    </div>
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
