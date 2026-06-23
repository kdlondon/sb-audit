"use client";
import { useState } from "react";

// Journey / campaign map: groups entries into stage columns by a framework dimension
// (funnel, journey phase, or client lifecycle). KD Product UI palette — attenuated:
// stages take the KD tint sequence (no rainbow), one ink, accent on the rating.

const ytId = (url = "") => {
  const m = String(url).match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/);
  return m ? m[1] : null;
};

// KD attenuated tints, assigned by stage position (rank with hue, never a saturated colour per stage)
const STAGE_TINTS = [
  { bg: "var(--accent-tint)", dot: "var(--accent-deep)" },
  { bg: "var(--accent-step)", dot: "var(--accent-deep)" },
  { bg: "var(--p-stone)", dot: "var(--d-stone)" },
  { bg: "var(--p-sand)", dot: "var(--d-stone)" },
  { bg: "var(--p-ember)", dot: "var(--d-ember)" },
  { bg: "var(--p-stone)", dot: "var(--d-stone)" },
];
const UNASSIGNED_TINT = { bg: "var(--p-stone)", dot: "var(--d-stone)" };

export const JOURNEY_VIEWS = [
  { id: "funnel", label: "Conversion Funnel", field: "funnel", stages: ["Awareness", "Consideration", "Conversion", "Retention", "Advocacy"] },
  { id: "journey", label: "Business Journey", field: "journey_phase", stages: ["Existential", "Validation", "Complexity", "Consolidation", "Cross-phase", "Not specific"] },
  { id: "lifecycle", label: "Client Lifecycle", field: "client_lifecycle", stages: ["Starter", "Growth", "Steady", "Succession", "Cross-lifecycle", "Not specific"] },
];

const MONO = "var(--kd-mono)";
const INK = "var(--kd-black)";

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
    <div style={{ fontFamily: "var(--kd-sans)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 4, background: "var(--surface2)", borderRadius: 9999, padding: 4 }}>
          {JOURNEY_VIEWS.map((v) => (
            <button key={v.id} onClick={() => { setActiveView(v.id); setExpandedStage(null); }}
              style={{ padding: "6px 14px", borderRadius: 9999, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 500, transition: "all 0.15s", background: activeView === v.id ? INK : "transparent", color: activeView === v.id ? "var(--kd-cream)" : "var(--text2)" }}
            >{v.label}</button>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(stages.length, 5)},1fr)`, gap: 12 }}>
        {stages.map((stage) => {
          const items = grouped[stage];
          const idx = view.stages.indexOf(stage);
          const tint = stage === "Unassigned" || idx < 0 ? UNASSIGNED_TINT : STAGE_TINTS[idx % STAGE_TINTS.length];
          const isExpanded = expandedStage === stage;
          const shown = isExpanded ? items : items.slice(0, 4);
          return (
            <div key={stage} style={{ background: "#fff", border: "1px solid rgba(22,20,19,0.08)", borderRadius: 12, overflow: "hidden" }}>
              <div style={{ background: tint.bg, padding: "10px 12px", display: "flex", alignItems: "center", gap: 7 }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: tint.dot, flexShrink: 0 }} />
                <span style={{ fontSize: 11, fontWeight: 600, color: INK, textTransform: "uppercase", letterSpacing: "0.06em", flex: 1 }}>{stage}</span>
                <span style={{ fontFamily: MONO, fontSize: 11, color: INK, opacity: 0.6 }}>{items.length}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: 12 }}>
                {shown.map((e) => {
                  const thumb = ytId(e.url) ? `https://img.youtube.com/vi/${ytId(e.url)}/mqdefault.jpg` : e.image_url;
                  return (
                    <div key={e.id} onClick={() => onEntryClick(e)}
                      style={{ background: "#fff", borderRadius: 9, padding: "8px 8px 7px", cursor: "pointer", border: "1px solid rgba(22,20,19,0.08)", transition: "border-color 0.2s var(--kd-easing)" }}
                      onMouseEnter={(el) => { el.currentTarget.style.borderColor = "var(--accent-deep)"; }}
                      onMouseLeave={(el) => { el.currentTarget.style.borderColor = "rgba(22,20,19,0.08)"; }}
                    >
                      {thumb && (
                        <div style={{ width: "100%", height: 56, borderRadius: 6, overflow: "hidden", marginBottom: 7, background: "var(--p-stone)" }}>
                          <img src={thumb} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        </div>
                      )}
                      <p style={{ fontSize: 11.5, fontWeight: 500, color: INK, lineHeight: 1.3, margin: "0 0 6px" }}>
                        {(e.description || "Untitled").slice(0, 48)}{(e.description || "").length > 48 ? "…" : ""}
                      </p>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                        <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: "0.05em", textTransform: "uppercase", color: "rgba(22,20,19,0.5)" }}>
                          {[e.year, e.type].filter(Boolean).join(" · ")}
                        </span>
                        {e.rating && <span style={{ fontSize: 9, marginLeft: "auto", color: "var(--accent-deep)" }}>{"★".repeat(Number(e.rating))}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
              {items.length > 4 && (
                <button onClick={() => setExpandedStage(isExpanded ? null : stage)}
                  style={{ width: "100%", fontFamily: MONO, fontSize: 9, letterSpacing: "0.05em", textTransform: "uppercase", color: "rgba(22,20,19,0.5)", background: "transparent", border: "none", cursor: "pointer", padding: "0 0 12px", fontWeight: 500 }}
                >{isExpanded ? "Show less ↑" : `+${items.length - 4} more ↓`}</button>
              )}
            </div>
          );
        })}
      </div>

      {grouped["Unassigned"]?.length > 0 && (
        <p style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.04em", color: "var(--text2)", marginTop: 10, opacity: 0.6 }}>
          * {grouped["Unassigned"].length} piece{grouped["Unassigned"].length > 1 ? "s" : ""} without {view.label.toLowerCase()} assigned
        </p>
      )}
    </div>
  );
}
