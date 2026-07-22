"use client";
// N2 subsections — a single white segmented pill. Active = filled ink-800 pill (the one
// ember-free active mark; ink here, ember is reserved for data/marks). Design-handoff N2.
export default function SectionTabs({ tabs = [], active, onChange }) {
  return (
    <div style={{ display: "inline-flex", gap: 2, background: "var(--brand-white)", border: "1px solid var(--border-hairline)", borderRadius: 24, padding: 4 }}>
      {tabs.map((t) => {
        const on = t.id === active;
        return (
          <button key={t.id} className="gw-tab" onClick={() => onChange?.(t.id)}
            style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, fontWeight: on ? 600 : 500,
              color: on ? "#fff" : "var(--text-secondary)", background: on ? "var(--ink-800)" : "transparent",
              padding: "6px 15px", borderRadius: 20, border: "none", cursor: "pointer", whiteSpace: "nowrap" }}>
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
