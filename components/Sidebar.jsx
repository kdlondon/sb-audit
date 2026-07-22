"use client";
// Groundwork navigation redesign — vertical sidebar (N0 project context + New entry,
// N1 modules with the single ember active-state, footer). Expanded 240px / collapsed 62px
// with hover tooltips. Replaces the legacy top-bar Nav. See design_handoff_navigation.
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase";
import { useProject } from "@/lib/project-context";
import { useRole, canAccess } from "@/lib/role-context";

const I = ({ d, stroke = "currentColor", w = 16, sw = 1.5, children }) => (
  <svg width={w} height={w} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">{d ? <path d={d} /> : children}</svg>
);

// module key drives canAccess(); Intelligence + Report share the "reports" module
const MODULES = [
  { name: "Creative Source", href: "/audit", module: "audit", icon: <I d="m12 3-1.9 5.8L4 12l6.1 2.2L12 21l1.9-6.8L20 12z" /> },
  { name: "Scout", href: "/scout", module: "scout", icon: <I sw={1.5}><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></I> },
  { name: "Intelligence", href: "/intelligence", module: "reports", icon: <I d="M4 20V11M10 20V4M16 20v-6M20 20H3" /> },
  { name: "Report", href: "/reports", module: "reports", icon: <I><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /></I> },
  { name: "Showcase", href: "/showcase", module: "showcase", icon: <I><rect x="3" y="4" width="18" height="12" rx="1" /><path d="M12 16v4M8 20h8" /></I> },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { projectName } = useProject() || {};
  const { role, userEmail, activeOrg } = useRole() || {};
  const [collapsed, setCollapsed] = useState(false);
  const [acctOpen, setAcctOpen] = useState(false);
  const acctRef = useRef(null);

  useEffect(() => { try { setCollapsed(localStorage.getItem("gw-sidebar-collapsed") === "true"); } catch {} }, []);
  const toggleCollapse = () => setCollapsed((c) => { const n = !c; try { localStorage.setItem("gw-sidebar-collapsed", String(n)); } catch {} return n; });

  useEffect(() => {
    if (!acctOpen) return;
    const h = (e) => { if (acctRef.current && !acctRef.current.contains(e.target)) setAcctOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [acctOpen]);

  const logout = async () => {
    try { await createClient().auth.signOut(); } catch {}
    try { ["gw-active-brand", "gw-active-brand-name", "gw-active-org", "sb-project-id", "sb-project-name", "sb-client-name", "groundwork_profile"].forEach((k) => localStorage.removeItem(k)); } catch {}
    window.location.href = "/login";
  };

  const modules = MODULES.filter((m) => role && canAccess(role, m.module));
  const isActive = (href) => pathname === href || pathname.startsWith(href + "/") || (href === "/audit" && pathname === "/audit");
  const initial = (userEmail || "S").trim().charAt(0).toUpperCase();
  const W = collapsed ? 62 : 240;

  // A module / footer row. Active row = ink #242424 fill + cream text (ember icon on the active module).
  const Row = ({ icon, label, active, onClick, emberIcon }) => (
    <div className={`gw-tip ${active ? "" : "gw-mi"}`} onClick={onClick}
      style={{ display: "flex", alignItems: "center", gap: collapsed ? 0 : 11, justifyContent: collapsed ? "center" : "flex-start",
        padding: collapsed ? "9px 0" : "8px 10px", borderRadius: 8, cursor: "pointer",
        background: active ? "#242424" : "transparent", color: active ? "#fff" : "#8a8a8a",
        fontSize: 12, fontWeight: active ? 600 : 500, fontFamily: "var(--font-mono)" }}>
      <span style={{ display: "flex", color: emberIcon && active ? "var(--accent-ember)" : "inherit", flex: "none" }}>{icon}</span>
      {!collapsed && <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</span>}
      {collapsed && <span className="gw-tip-bubble">{label}</span>}
    </div>
  );

  return (
    <aside style={{ width: W, flex: "none", background: "var(--ink-800)", display: "flex", flexDirection: "column",
      padding: collapsed ? "18px 10px 14px" : "18px 14px 14px", height: "100vh", position: "sticky", top: 0, transition: "width 0.16s ease", overflow: "visible" }}>

      {/* Wordmark + collapse toggle */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: collapsed ? "center" : "space-between", gap: 8, padding: collapsed ? "4px 0 14px" : "4px 6px 14px" }}>
        {collapsed
          ? <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, letterSpacing: ".08em", color: "var(--brand-cream)" }}>GW</span>
          : <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, letterSpacing: ".14em", color: "var(--brand-cream)" }}>GROUNDWORK</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 7, letterSpacing: ".1em", color: "#b9b9b9", border: "1px solid #4a4a4a", borderRadius: 20, padding: "2px 5px" }}>BETA</span>
            </div>}
        {!collapsed && <button onClick={toggleCollapse} title="Collapse" style={{ flex: "none", width: 22, height: 22, borderRadius: 6, background: "transparent", border: "none", color: "#8a8a8a", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><I sw={1.7} w={15}><path d="M15 6l-6 6 6 6" /></I></button>}
      </div>
      {collapsed && <button onClick={toggleCollapse} title="Expand" style={{ margin: "0 auto 10px", width: 26, height: 26, borderRadius: 6, background: "#212121", border: "1px solid #2e2e2e", color: "#c9c9c9", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><I sw={1.7} w={15}><path d="M9 6l6 6-6 6" /></I></button>}

      {/* N0 — project context */}
      {collapsed ? (
        <div className="gw-tip" onClick={() => router.push("/projects")} title="Switch project"
          style={{ width: 30, height: 30, margin: "0 auto 12px", borderRadius: 8, background: "#212121", border: "1px solid #2e2e2e", color: "var(--brand-cream)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, fontFamily: "var(--font-mono)", cursor: "pointer" }}>
          {(projectName || "P").charAt(0).toUpperCase()}
          <span className="gw-tip-bubble">{projectName || "No project"}</span>
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "0 2px 12px", padding: "9px 10px", background: "#212121", border: "1px solid #2e2e2e", borderRadius: 10 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 8, letterSpacing: ".14em", color: "#6f6f6f", marginBottom: 4, fontFamily: "var(--font-mono)" }}>PROJECT</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--brand-cream)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontFamily: "var(--font-mono)" }}>{projectName || "No project"}</div>
          </div>
          <button onClick={() => router.push("/projects")} title="Switch project" style={{ flex: "none", width: 26, height: 26, borderRadius: 7, background: "#161616", border: "1px solid #383838", display: "flex", alignItems: "center", justifyContent: "center", color: "#c9c9c9", cursor: "pointer" }}>
            <I sw={1.7} w={14}><path d="M7 4 3 8l4 4M3 8h13M17 20l4-4-4-4M21 16H8" /></I>
          </button>
        </div>
      )}

      {/* + New entry (permanent ember create) */}
      <button className="gw-ember-btn gw-tip" onClick={() => router.push("/audit?add=1")}
        style={{ width: "100%", margin: "0 0 16px", padding: collapsed ? "10px 0" : 11, border: "none", borderRadius: 8, background: "var(--accent-ember-deep)", color: "#fff", fontFamily: "var(--font-body)", fontWeight: 500, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, cursor: "pointer" }}>
        <I sw={1.9} w={15} d="M12 5v14M5 12h14" />{!collapsed && "New entry"}
        {collapsed && <span className="gw-tip-bubble">New entry</span>}
      </button>

      {/* N1 — modules */}
      {!collapsed && <div style={{ fontSize: 8, letterSpacing: ".14em", color: "#565656", padding: "2px 10px 6px", fontFamily: "var(--font-mono)" }}>MODULES</div>}
      <nav style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {modules.map((m) => <Row key={m.href} icon={m.icon} label={m.name} emberIcon active={isActive(m.href)} onClick={() => router.push(m.href)} />)}
      </nav>

      {/* Footer — Messages · Settings · Avatar */}
      <div style={{ marginTop: "auto", paddingTop: 12, borderTop: "1px solid #292929", display: "flex", flexDirection: "column", gap: 2 }}>
        <Row icon={<I><path d="M21 11.5a8.4 8.4 0 0 1-9 8 9 9 0 0 1-4-1l-4 1 1-4a8.4 8.4 0 0 1 8-12 8.4 8.4 0 0 1 8 8z" /></I>} label="Messages" active={isActive("/chat")} onClick={() => router.push("/chat")} />
        <Row icon={<I><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" /></I>} label="Settings" active={isActive("/settings")} onClick={() => router.push("/settings")} />

        {/* Account */}
        <div ref={acctRef} style={{ position: "relative", marginTop: 4 }}>
          <div className="gw-tip" onClick={() => setAcctOpen((o) => !o)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px", borderRadius: 8, cursor: "pointer", justifyContent: collapsed ? "center" : "flex-start" }}>
            <span style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--accent-ember-tint)", flex: "none", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 600, color: "#7a3a24", fontFamily: "var(--font-mono)" }}>{initial}</span>
            {!collapsed && <>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontFamily: "var(--font-mono)" }}>{userEmail || "Account"}</div>
                <div style={{ fontSize: 9, color: "#6f6f6f", marginTop: 1, fontFamily: "var(--font-mono)" }}>{activeOrg?.name || "K&D"}{role ? ` · ${role}` : ""}</div>
              </div>
              <I w={14} sw={1.6} stroke="#6f6f6f"><path d="m6 9 6 6 6-6" /></I>
            </>}
            {collapsed && <span className="gw-tip-bubble">{userEmail || "Account"}</span>}
          </div>
          {acctOpen && (
            <div style={{ position: "absolute", bottom: "calc(100% + 8px)", left: 0, minWidth: 190, background: "var(--ink-800)", border: "1px solid #333", borderRadius: 12, boxShadow: "var(--shadow-float)", padding: 6, zIndex: 300 }}>
              <button onClick={() => { setAcctOpen(false); router.push("/profile"); }} style={acctItem}>Profile</button>
              <button onClick={() => { setAcctOpen(false); router.push("/settings"); }} style={acctItem}>Project settings</button>
              <div style={{ height: 1, background: "#333", margin: "5px 4px" }} />
              <button onClick={logout} style={{ ...acctItem, color: "var(--accent-ember)" }}>Log out</button>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}

const acctItem = { display: "block", width: "100%", textAlign: "left", padding: "8px 10px", borderRadius: 7, background: "transparent", border: "none", color: "#c9c9c9", fontSize: 12, fontFamily: "var(--font-mono)", cursor: "pointer" };
