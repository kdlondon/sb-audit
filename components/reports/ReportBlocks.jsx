"use client";
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

// Chart cards carry a title on the left and a unit hint on the right, per the design.
function CardHead({ title, hint }) {
  if (!title && !hint) return null;
  return (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
      {title && <span style={{ fontFamily: "var(--font-body)", fontSize: 13.5, fontWeight: 600, color: "var(--ink-900)" }}>{title}</span>}
      {hint && <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--text-muted)" }}>{hint}</span>}
    </div>
  );
}

export default function ReportBlock({ block }) {
  if (!block) return null;
  switch (block.type) {
    case "kpi": return <KpiRow data={block.data} />;
    case "bars": return <Bars data={block.data} />;
    case "split": return <Split data={block.data} />;
    case "heatmap": return <Heatmap data={block.data} />;
    case "quadrant": return <Quadrant data={block.data} />;
    case "pullquote": return <PullQuote data={block.data} />;
    default: return null;
  }
}

export const isVisualBlock = (b) =>
  b && ["kpi", "bars", "split", "heatmap", "quadrant", "pullquote"].includes(b.type);

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
  const pts = data.points || [];
  if (pts.length < 3) return null;
  const cell = (open, wanted) => pts.filter((p) => !!p.open === open && !!p.wanted === wanted);
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
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.label}</span>
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
