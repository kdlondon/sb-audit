"use client";
// Report v2 — Generate step 1 (F2). One Suggested card per project objective, plus an
// Others block with the built engines that aren't tied to a chosen objective.
// Objectives come from the project framework (set at onboarding, editable in Settings).
import { REPORT_CARDS, OBJECTIVE_TO_CARD } from "@/lib/report-cards";

const TAG = {
  Flagship: { background: "var(--ink-800)", color: "var(--brand-cream)", border: "1px solid var(--ink-800)" },
  Core:     { background: "var(--accent-ember-tint)", color: "#7a3a24", border: "1px solid var(--accent-ember-tint)" },
  Section:  { background: "var(--brand-white)", color: "var(--text-secondary)", border: "1px solid var(--border-strong)" },
};
const tagStyle = (tier) => ({
  ...(TAG[tier] || TAG.Section),
  display: "inline-block", padding: "3px 9px", borderRadius: 12,
  fontFamily: "var(--font-mono)", fontSize: 9.5, letterSpacing: ".1em", textTransform: "uppercase", fontWeight: 600,
});

export default function ReportTypePicker({ objectives = [], onPick, onOpenSettings }) {
  // One card per objective, in the order the project declared them. Unknown objectives are
  // skipped rather than rendered dead.
  const suggested = objectives.map((o) => REPORT_CARDS[OBJECTIVE_TO_CARD[o]]).filter((c) => c && c.built !== false);
  const suggestedIds = new Set(suggested.map((c) => c.id));
  // "Others" = engines we HAVE BUILT that aren't suggested for a chosen objective.
  // Never a catalog of reports that don't exist.
  const others = Object.values(REPORT_CARDS).filter((c) => c.built !== false && !suggestedIds.has(c.id));

  return (
    <div style={{ animation: "gwrise .25s ease" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".16em", textTransform: "uppercase", color: "var(--text-muted)" }}>
          Suggested · by project objective
        </div>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-muted)" }}>
          Objectives set in{" "}
          <button onClick={onOpenSettings} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: "var(--accent-ember-deep)", fontFamily: "inherit", fontSize: "inherit" }}>Settings</button>
        </span>
      </div>

      {suggested.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
          {suggested.map((c) => <BigCard key={c.id} card={c} onPick={onPick} />)}
        </div>
      ) : (
        <div style={{ marginTop: 12, border: "1px dashed var(--border-strong)", borderRadius: 14, padding: "26px 22px", textAlign: "center" }}>
          <p style={{ fontFamily: "var(--font-body)", fontStyle: "italic", fontSize: 14, color: "var(--text-muted)", margin: "0 0 6px" }}>
            This project has no objectives set yet.
          </p>
          <p style={{ fontFamily: "var(--font-body)", fontSize: 13, color: "var(--text-secondary)", margin: "0 0 16px" }}>
            Objectives decide which reports we suggest. Pick them in Settings — or start from any report below.
          </p>
          <button onClick={onOpenSettings} className="gw-ember-btn"
            style={{ background: "var(--accent-ember)", color: "#fff", border: "none", borderRadius: 9, padding: "10px 18px", cursor: "pointer", fontFamily: "var(--font-display)", fontSize: 13, fontWeight: 700 }}>
            Set objectives →
          </button>
        </div>
      )}

      {others.length > 0 && (
        <>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".16em", textTransform: "uppercase", color: "var(--text-muted)", marginTop: 30 }}>
            Others
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 10, marginTop: 12 }}>
            {others.map((c) => <SmallCard key={c.id} card={c} onPick={onPick} />)}
          </div>
        </>
      )}
    </div>
  );
}

function BigCard({ card, onPick }) {
  return (
    <div onClick={() => onPick?.(card)} className="gw-card"
      style={{ display: "flex", alignItems: "flex-start", gap: 16, background: "var(--brand-white)", border: "1px solid var(--ink-300)", borderRadius: 14, padding: "20px 22px", cursor: "pointer" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 9 }}>{card.objective}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={tagStyle(card.tier)}>{card.tier}</span>
          <span style={{ fontFamily: "var(--font-body)", fontSize: 17, fontWeight: 600, color: "var(--ink-900)" }}>{card.title}</span>
        </div>
        <p style={{ fontFamily: "var(--font-body)", fontSize: 13, color: "var(--text-secondary)", margin: "9px 0 0", lineHeight: 1.5 }}>{card.description}</p>
      </div>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--accent-ember-deep)", whiteSpace: "nowrap", paddingTop: 2 }}>Open →</span>
    </div>
  );
}

function SmallCard({ card, onPick }) {
  return (
    <div onClick={() => onPick?.(card)} className="gw-card"
      style={{ background: "var(--brand-white)", border: "1px solid var(--border-hairline)", borderRadius: 12, padding: "16px 18px", cursor: "pointer" }}>
      <span style={tagStyle(card.tier)}>{card.tier}</span>
      <div style={{ fontFamily: "var(--font-body)", fontSize: 15, fontWeight: 600, color: "var(--ink-900)", marginTop: 9 }}>{card.title}</div>
      <p style={{ fontFamily: "var(--font-body)", fontSize: 12.5, color: "var(--text-secondary)", margin: "7px 0 0", lineHeight: 1.5 }}>{card.description}</p>
    </div>
  );
}
