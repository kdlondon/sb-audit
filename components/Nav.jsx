"use client";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { useProject } from "@/lib/project-context";
import { useRole, canAccess } from "@/lib/role-context";
import { useEffect, useState, useRef } from "react";

const mainTabs = [
  { name: "Audit", href: "/audit", module: "audit" },
  { name: "Showcase", href: "/showcase", module: "showcase" },
  { name: "Reports", href: "/reports", module: "reports" },
];

const ROLE_LABELS = { full_admin: "Admin", analyst: "Analyst", client: "Client" };

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const { projectName, clearProject } = useProject();
  const { role, userEmail } = useRole();
  const [dark, setDark] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const saved = localStorage.getItem("sb-dark");
    if (saved === "true") { setDark(true); document.documentElement.classList.add("dark"); }
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  const toggleDark = () => {
    const next = !dark; setDark(next);
    localStorage.setItem("sb-dark", String(next));
    document.documentElement.classList.toggle("dark", next);
  };

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    clearProject();
    router.replace("/login");
  };

  const tabs = mainTabs.filter(t => role && canAccess(role, t.module));

  return (
    <div className="px-5 py-2 flex items-center justify-between sticky top-0"
      style={{ background: "#0a0f3c", borderBottom: "1px solid rgba(255,255,255,0.06)", zIndex: 100, transform: "translateZ(0)" }}>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => { clearProject(); router.push("/projects"); }}>
          <img src="/knots-dots-logo.png" alt="K&D" style={{ height: 20 }} />
          <span className="text-[10px] font-bold text-white/30 uppercase tracking-[0.15em]">Groundwork</span>
        </div>
        <div className="border-l border-white/10 pl-4">
          <button onClick={() => router.push("/dashboard")} className="text-xs text-white/70 font-medium hover:text-white transition">
            {projectName || "Select project"}
          </button>
        </div>
        <div className="flex gap-0.5 ml-2">
          {tabs.map(t => (
            <button key={t.href} onClick={() => router.push(t.href)}
              className={`px-3 py-1.5 rounded-md text-[13px] font-medium transition ${
                pathname.startsWith(t.href) ? "text-white" : "text-white/40 hover:text-white/70"
              }`}
              style={pathname.startsWith(t.href) ? { background: "rgba(255,255,255,0.08)" } : {}}>
              {t.name}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-1.5" ref={menuRef}>
        {/* AI sparkles in background */}
        <div className="relative flex items-center gap-1.5">
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className="ai-sparkle" style={{ top: "20%", left: "15%", animationDelay: "0s" }} />
            <div className="ai-sparkle" style={{ top: "60%", left: "45%", animationDelay: "0.7s" }} />
            <div className="ai-sparkle" style={{ top: "30%", left: "75%", animationDelay: "1.4s" }} />
            <div className="ai-sparkle" style={{ top: "70%", left: "25%", animationDelay: "0.3s" }} />
            <div className="ai-sparkle" style={{ top: "15%", left: "60%", animationDelay: "1.1s" }} />
          </div>

          {/* Add button */}
          {canAccess(role, "audit") && (
            <button onClick={() => router.push("/audit")} title="Add entry"
              className="nav-action-btn text-white relative"
              style={{ background: "rgba(255,255,255,0.12)" }}>
              <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.2" className="flex-shrink-0"><line x1="10" y1="4" x2="10" y2="16"/><line x1="4" y1="10" x2="16" y2="10"/></svg>
              <span className="nav-action-label">Add</span>
            </button>
          )}

          {/* Scout button */}
          {canAccess(role, "audit") && (
            <button onClick={() => router.push("/scout")} title="Scout"
              className="nav-action-btn text-white relative"
              style={{ background: "linear-gradient(135deg, #0019FF, #4060ff)" }}>
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" className="flex-shrink-0"><circle cx="7" cy="7" r="4.5"/><line x1="13" y1="13" x2="10.5" y2="10.5"/></svg>
              <span className="nav-action-label">Scout</span>
            </button>
          )}

          {/* Chat button */}
          <button onClick={() => router.push("/chat")} title="AI Chat"
            className="nav-action-btn text-white relative"
            style={{ background: "#059669" }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
            <span className="nav-action-label">Chat</span>
          </button>
        </div>

        <div className="w-px h-5 mx-1" style={{ background: "rgba(255,255,255,0.1)" }} />

        {/* Profile button */}
        <button onClick={() => setMenuOpen(!menuOpen)}
          className="flex items-center gap-1.5 text-white/50 hover:text-white/80 transition">
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold uppercase"
            style={{ background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.6)" }}>
            {userEmail ? userEmail[0] : "?"}
          </div>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5"
            className={`transition ${menuOpen ? "rotate-180" : ""}`}><path d="M2 4l3 3 3-3"/></svg>
        </button>

        {/* Simple absolute dropdown — no portal needed */}
        {menuOpen && (
          <div className="absolute right-4 top-12 w-56 bg-surface border border-main rounded-xl shadow-2xl py-1 animate-fadeIn"
            style={{ zIndex: 99999 }}>
            <div className="px-4 py-3 border-b border-main">
              <p className="text-sm font-medium text-main truncate">{userEmail}</p>
              <p className="text-[10px] text-muted uppercase tracking-wider mt-0.5">{ROLE_LABELS[role] || role}</p>
            </div>
            <button onClick={() => { setMenuOpen(false); router.push("/dashboard"); }}
              className="w-full text-left px-4 py-2.5 text-sm text-muted hover:text-main hover:bg-surface2 transition">Dashboard</button>
            {canAccess(role, "settings") && (
              <button onClick={() => { setMenuOpen(false); router.push("/settings"); }}
                className="w-full text-left px-4 py-2.5 text-sm text-muted hover:text-main hover:bg-surface2 transition">Settings</button>
            )}
            {canAccess(role, "users") && (
              <button onClick={() => { setMenuOpen(false); router.push("/users"); }}
                className="w-full text-left px-4 py-2.5 text-sm text-muted hover:text-main hover:bg-surface2 transition">User Management</button>
            )}
            <div className="border-t border-main my-1" />
            <button onClick={() => { toggleDark(); setMenuOpen(false); }}
              className="w-full text-left px-4 py-2.5 text-sm text-muted hover:text-main hover:bg-surface2 transition">
              {dark ? "Light mode" : "Dark mode"}
            </button>
            <button onClick={() => { setMenuOpen(false); clearProject(); router.push("/projects"); }}
              className="w-full text-left px-4 py-2.5 text-sm text-muted hover:text-main hover:bg-surface2 transition">Switch project</button>
            <div className="border-t border-main my-1" />
            <button onClick={() => { setMenuOpen(false); handleLogout(); }}
              className="w-full text-left px-4 py-2.5 text-sm text-red-400 hover:text-red-500 hover:bg-red-50 transition">Sign out</button>
          </div>
        )}
      </div>
    </div>
  );
}
