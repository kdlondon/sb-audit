"use client";
// Groundwork redesign shell: fixed vertical Sidebar + scrolling <main>. Owns the viewport
// (flex row, 100vh; main scrolls internally — per the handoff, main is normal block flow,
// never a squashing flex column). Renders the standard page header (eyebrow · title ·
// subtitle · optional right slot) and the N2 SectionTabs; page content is the children.
import Sidebar from "@/components/Sidebar";
import SectionTabs from "@/components/SectionTabs";

export default function AppShell({ eyebrow, title, subtitle, tabs, active, onTab, headerRight, toolbar, children, maxWidth = 1120 }) {
  return (
    <div className="gw-shell" style={{ display: "flex", height: "100vh", background: "var(--paper)" }}>
      <Sidebar />
      <main style={{ flex: 1, minWidth: 0, display: "block", overflowY: "auto", height: "100vh", padding: "26px 34px 40px" }}>
        <div style={{ maxWidth, margin: "0 auto" }}>
          {/* Header: title block + optional eyebrow/right slot */}
          {(title || eyebrow || headerRight) && (
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 20 }}>
              <div>
                {title && <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 28, letterSpacing: "-.01em", margin: 0, color: "var(--ink-900)" }}>{title}</h1>}
                {subtitle && <p style={{ fontFamily: "var(--font-body)", fontSize: 13.5, color: "var(--text-secondary)", margin: "6px 0 0" }}>{subtitle}</p>}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, flex: "none" }}>
                {headerRight}
                {eyebrow && <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: ".04em", color: "var(--text-muted)", whiteSpace: "nowrap", paddingTop: 4 }}>{eyebrow}</span>}
              </div>
            </div>
          )}

          {/* N2 tabs */}
          {tabs?.length > 0 && (
            <div style={{ marginTop: 20, display: "flex", alignItems: "center", gap: 14 }}>
              <SectionTabs tabs={tabs} active={active} onChange={onTab} />
              {toolbar}
            </div>
          )}

          {children}
        </div>
      </main>
    </div>
  );
}
