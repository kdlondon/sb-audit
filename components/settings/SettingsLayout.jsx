"use client";
// The Settings body layout from the handoff: a fixed "On this page" anchor rail beside a
// scroll container, and each subsection wrapped in a white card with a mono eyebrow.
//
// The rail scroll-spies: clicking jumps to a section, and scrolling marks the section the
// reader is in. Anchors are declared by the tab as [id, label] pairs; each SectionCard
// carries the matching id.
import { useState, useEffect, useRef, useCallback } from "react";

export function SettingsBody({ anchors = [], children }) {
  const scrollRef = useRef(null);
  const [active, setActive] = useState(anchors[0]?.[0] || null);

  const go = useCallback((id) => {
    const c = scrollRef.current;
    const el = c?.querySelector(`[data-sec="${id}"]`);
    if (el && c) c.scrollTo({ top: el.offsetTop - 8, behavior: "smooth" });
    setActive(id);
  }, []);

  // Scroll-spy: the active anchor follows whichever section is nearest the top.
  useEffect(() => {
    const c = scrollRef.current;
    if (!c) return;
    const onScroll = () => {
      const secs = [...c.querySelectorAll("[data-sec]")];
      let cur = secs[0]?.getAttribute("data-sec") || null;
      for (const s of secs) {
        if (s.offsetTop - c.scrollTop <= 80) cur = s.getAttribute("data-sec");
      }
      if (cur) setActive(cur);
    };
    c.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => c.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div style={{ display: "flex", gap: 26, maxWidth: 1180, margin: "0 auto", padding: "20px 34px 0", alignItems: "flex-start" }}>
      <nav style={{ width: 172, flex: "none", position: "sticky", top: 120, display: "flex", flexDirection: "column", gap: 2, paddingTop: 4 }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, letterSpacing: ".16em", textTransform: "uppercase", color: "var(--text-muted)", padding: "0 12px 6px" }}>On this page</div>
        {anchors.map(([id, label]) => {
          const on = active === id;
          return (
            <button key={id} onClick={() => go(id)}
              style={{
                textAlign: "left", background: on ? "var(--ink-150)" : "none", border: "none",
                borderLeft: `2px solid ${on ? "var(--accent-ember)" : "transparent"}`,
                fontFamily: "var(--font-mono)", fontSize: 11, color: on ? "var(--ink-900)" : "var(--text-muted)",
                padding: "7px 12px", borderRadius: 7, cursor: "pointer", transition: "all .12s",
              }}>{label}</button>
          );
        })}
      </nav>
      <div ref={scrollRef} style={{ flex: 1, minWidth: 0, maxHeight: "calc(100vh - 150px)", overflowY: "auto", paddingBottom: 60 }}>
        {children}
      </div>
    </div>
  );
}

// A titled section card. `id` matches an anchor; `eyebrow` is the mono heading.
export function SectionCard({ id, eyebrow, children, maxWidth = 760, style }) {
  return (
    <section data-sec={id} style={{ background: "var(--brand-white)", border: "1px solid var(--border-hairline)", borderRadius: 14, padding: "24px 26px", maxWidth, ...style }}>
      {eyebrow && <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--text-muted)" }}>{eyebrow}</div>}
      <div style={{ marginTop: eyebrow ? 18 : 0 }}>{children}</div>
    </section>
  );
}

// A bare anchor target for sections that aren't a single card (e.g. the competitor list,
// the dimension accordions) — keeps the rail working without forcing a card wrapper.
export function SectionAnchor({ id, children, style }) {
  return <div data-sec={id} style={style}>{children}</div>;
}
