"use client";
import { useState } from "react";

// Journey / campaign map: groups entries into stage columns by a framework dimension
// (funnel, journey phase, or client lifecycle). Extracted to be reusable as an
// Intelligence dashboard widget. Self-contained (own ytId helper + JOURNEY_VIEWS).

const ytId = (url = "") => {
  const m = String(url).match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/);
  return m ? m[1] : null;
};

export const JOURNEY_VIEWS = [
  {
    id: "funnel",
    label: "Conversion Funnel",
    stages: ["Awareness", "Consideration", "Conversion", "Retention", "Advocacy"],
    field: "funnel",
    colors: {
      "Awareness": { bg: "#EEF2FF", border: "#818CF8", text: "#3730A3", dot: "#6366F1" },
      "Consideration": { bg: "#F0FDF4", border: "#4ADE80", text: "#166534", dot: "#22C55E" },
      "Conversion": { bg: "#FFF7ED", border: "#FB923C", text: "#9A3412", dot: "#F97316" },
      "Retention": { bg: "#FDF4FF", border: "#E879F9", text: "#86198F", dot: "#D946EF" },
      "Advocacy": { bg: "#FFFBEB", border: "#FBBF24", text: "#92400E", dot: "#F59E0B" },
    },
  },
  {
    id: "journey",
    label: "Business Journey",
    stages: ["Existential", "Validation", "Complexity", "Consolidation", "Cross-phase", "Not specific"],
    field: "journey_phase",
    colors: {
      "Existential": { bg: "#FFF1F2", border: "#FB7185", text: "#9F1239", dot: "#F43F5E" },
      "Validation": { bg: "#FFF7ED", border: "#FB923C", text: "#9A3412", dot: "#F97316" },
      "Complexity": { bg: "#FFFBEB", border: "#FBBF24", text: "#92400E", dot: "#F59E0B" },
      "Consolidation": { bg: "#F0FDF4", border: "#4ADE80", text: "#166534", dot: "#22C55E" },
      "Cross-phase": { bg: "#EEF2FF", border: "#818CF8", text: "#3730A3", dot: "#6366F1" },
      "Not specific": { bg: "#F9FAFB", border: "#D1D5DB", text: "#374151", dot: "#9CA3AF" },
    },
  },
  {
    id: "lifecycle",
    label: "Client Lifecycle",
    stages: ["Starter", "Growth", "Steady", "Succession", "Cross-lifecycle", "Not specific"],
    field: "client_lifecycle",
    colors: {
      "Starter": { bg: "#EEF2FF", border: "#818CF8", text: "#3730A3", dot: "#6366F1" },
      "Growth": { bg: "#F0FDF4", border: "#4ADE80", text: "#166534", dot: "#22C55E" },
      "Steady": { bg: "#FFFBEB", border: "#FBBF24", text: "#92400E", dot: "#F59E0B" },
      "Succession": { bg: "#FDF4FF", border: "#E879F9", text: "#86198F", dot: "#D946EF" },
      "Cross-lifecycle": { bg: "#FFF7ED", border: "#FB923C", text: "#9A3412", dot: "#F97316" },
      "Not specific": { bg: "#F9FAFB", border: "#D1D5DB", text: "#374151", dot: "#9CA3AF" },
    },
  },
];

export default function CampaignMap({ entries = [], onEntryClick = () => {}, activeView: extActiveView, setActiveView: extSetActiveView }) {
  const [internalView, setInternalView] = useState("funnel");
  const activeView = extActiveView || internalView;
  const setActiveView = extSetActiveView || setInternalView;
  const [expandedStage, setExpandedStage] = useState(null);

  const view = JOURNEY_VIEWS.find((v) => v.id === activeView) || JOURNEY_VIEWS[0];

  const grouped = {};
  view.stages.forEach((s) => (grouped[s] = []));
  grouped["Unassigned"] = [];

  entries.forEach((e) => {
    const vals = e[view.field] ? e[view.field].split(",").map((v) => v.trim()).filter(Boolean) : [];
    if (vals.length === 0) grouped["Unassigned"].push(e);
    else vals.forEach((v) => { if (grouped[v] !== undefined) grouped[v].push(e); else grouped["Unassigned"].push(e); });
  });

  const stages = [...view.stages, "Unassigned"].filter((s) => grouped[s]?.length > 0);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 4, background: "var(--surface2)", borderRadius: 8, padding: 3 }}>
          {JOURNEY_VIEWS.map((v) => (
            <button key={v.id} onClick={() => { setActiveView(v.id); setExpandedStage(null); }}
              style={{ padding: "5px 12px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 600, transition: "all 0.15s", background: activeView === v.id ? "var(--surface)" : "transparent", color: activeView === v.id ? "var(--accent)" : "var(--text2)", boxShadow: activeView === v.id ? "0 1px 3px rgba(0,0,0,0.1)" : "none" }}
            >{v.label}</button>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(stages.length, 5)},1fr)`, gap: 10 }}>
        {stages.map((stage) => {
          const items = grouped[stage];
          const colors = view.colors[stage] || { bg: "#F9FAFB", border: "#D1D5DB", text: "#374151", dot: "#9CA3AF" };
          const isExpanded = expandedStage === stage;
          const shown = isExpanded ? items : items.slice(0, 4);
          return (
            <div key={stage} style={{ background: colors.bg, border: `1.5px solid ${colors.border}`, borderRadius: 12, padding: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: colors.dot, flexShrink: 0 }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: colors.text, textTransform: "uppercase", letterSpacing: "0.05em", flex: 1 }}>{stage}</span>
                <span style={{ fontSize: 10, color: colors.text, opacity: 0.6, fontWeight: 700, background: "rgba(0,0,0,0.06)", borderRadius: 10, padding: "1px 6px" }}>{items.length}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {shown.map((e) => {
                  const thumb = ytId(e.url) ? `https://img.youtube.com/vi/${ytId(e.url)}/mqdefault.jpg` : e.image_url;
                  return (
                    <div key={e.id} onClick={() => onEntryClick(e)}
                      style={{ background: "rgba(255,255,255,0.8)", borderRadius: 8, padding: "8px 8px 6px", cursor: "pointer", border: "1px solid rgba(255,255,255,0.9)", transition: "all 0.15s" }}
                      onMouseEnter={(el) => { el.currentTarget.style.background = "rgba(255,255,255,0.98)"; el.currentTarget.style.transform = "translateY(-1px)"; }}
                      onMouseLeave={(el) => { el.currentTarget.style.background = "rgba(255,255,255,0.8)"; el.currentTarget.style.transform = "none"; }}
                    >
                      {thumb && (
                        <div style={{ width: "100%", height: 56, borderRadius: 6, overflow: "hidden", marginBottom: 6, background: "#e5e7eb" }}>
                          <img src={thumb} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        </div>
                      )}
                      <p style={{ fontSize: 11, fontWeight: 600, color: "#111", lineHeight: 1.3, margin: "0 0 4px" }}>
                        {(e.description || "Untitled").slice(0, 48)}{(e.description || "").length > 48 ? "…" : ""}
                      </p>
                      <div style={{ display: "flex", gap: 3, flexWrap: "wrap", alignItems: "center" }}>
                        {e.year && <span style={{ fontSize: 9, color: "#555", background: "rgba(0,0,0,0.05)", borderRadius: 3, padding: "1px 4px" }}>{e.year}</span>}
                        {e.type && <span style={{ fontSize: 9, color: "#555", background: "rgba(0,0,0,0.05)", borderRadius: 3, padding: "1px 4px" }}>{e.type}</span>}
                        {e.rating && <span style={{ fontSize: 9, marginLeft: "auto" }}>{"★".repeat(Number(e.rating))}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
              {items.length > 4 && (
                <button onClick={() => setExpandedStage(isExpanded ? null : stage)}
                  style={{ marginTop: 6, width: "100%", fontSize: 10, color: colors.text, background: "transparent", border: "none", cursor: "pointer", padding: "4px 0", fontWeight: 600, opacity: 0.75 }}
                >{isExpanded ? "Show less ↑" : `+${items.length - 4} more ↓`}</button>
              )}
            </div>
          );
        })}
      </div>

      {grouped["Unassigned"]?.length > 0 && (
        <p style={{ fontSize: 11, color: "var(--text2)", marginTop: 8, opacity: 0.5 }}>
          * {grouped["Unassigned"].length} piece{grouped["Unassigned"].length > 1 ? "s" : ""} without {view.label.toLowerCase()} assigned
        </p>
      )}
    </div>
  );
}
