"use client";
// TEMPORARY preview of the navigation redesign shell (Phase 1) — behind auth so the
// sidebar shows your real project + modules. Not linked from anywhere; visit
// /redesign-preview directly. Delete once the real modules adopt the shell.
import { useState } from "react";
import AuthGuard from "@/components/AuthGuard";
import ProjectGuard from "@/components/ProjectGuard";
import AppShell from "@/components/AppShell";

function Inner() {
  const [tab, setTab] = useState("local");
  const cards = ["Norvent", "Kestrel Homes", "Aldaya Homes", "Vela", "Habitania", "Merida"];
  return (
    <AppShell
      eyebrow="CREATIVE SOURCE · PREVIEW"
      title="Local audit"
      subtitle="Shell preview — sidebar, N2 tabs and the ember active rule. Real content comes in phase 2."
      tabs={[{ id: "local", label: "Local audit" }, { id: "global", label: "Global benchmarks" }, { id: "collections", label: "Collections" }, { id: "map", label: "Map" }]}
      active={tab}
      onTab={setTab}
    >
      <div style={{ marginTop: 22, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, paddingBottom: 14, borderBottom: "1px solid var(--border-hairline)" }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: ".06em", color: "var(--text-muted)" }}>120 OF 120 ITEMS · TAB = {tab.toUpperCase()}</span>
        <div style={{ display: "flex", gap: 6 }}>
          {["Filter", "Sort"].map((l) => <button key={l} className="gw-tbtn" style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-secondary)", background: "var(--brand-white)", border: "1px solid var(--border-hairline)", borderRadius: 8, padding: "7px 11px", cursor: "pointer" }}>{l}</button>)}
        </div>
      </div>
      <div style={{ marginTop: 20, columns: 3, columnGap: 18 }}>
        {cards.map((b, i) => (
          <div key={i} className="gw-card" style={{ breakInside: "avoid", marginBottom: 18, background: "var(--brand-white)", border: "1px solid var(--border-hairline)", borderRadius: 16, overflow: "hidden" }}>
            <div style={{ width: "100%", aspectRatio: "4/5", background: "var(--ink-200)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontSize: 10 }}>4:5 media</div>
            <div style={{ padding: "14px 16px 16px" }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 600, color: "var(--text-secondary)", background: "var(--ink-200)", borderRadius: 5, padding: "3px 7px" }}>{b}</span>
              <h3 style={{ fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 600, lineHeight: 1.35, margin: "10px 0 0", color: "var(--ink-900)" }}>Sample creative title for {b}</h3>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10 }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: ".06em", color: "var(--text-muted)" }}>INSTAGRAM · 2026</span>
                <span style={{ fontSize: 11, letterSpacing: 1 }}><span style={{ color: "var(--accent-ember)" }}>★★★</span><span style={{ color: "var(--ink-300)" }}>★★</span></span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}

export default function RedesignPreviewPage() {
  return <AuthGuard><ProjectGuard><Inner /></ProjectGuard></AuthGuard>;
}
