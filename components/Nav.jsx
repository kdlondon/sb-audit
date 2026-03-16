"use client";
import { usePathname, useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase";
import { useProject } from "@/lib/project-context";
import { useRole, canAccess } from "@/lib/role-context";
import { useEffect, useState, useRef } from "react";

const mainTabs = [
  { name: "Audit", href: "/audit", module: "audit" },
  { name: "Showcase", href: "/showcase", module: "showcase" },
  { name: "Reports", href: "/reports", module: "reports" },
];

const SunIcon = () => (<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="8" cy="8" r="3"/><line x1="8" y1="1" x2="8" y2="3"/><line x1="8" y1="13" x2="8" y2="15"/><line x1="1" y1="8" x2="3" y2="8"/><line x1="13" y1="8" x2="15" y2="8"/><line x1="3.05" y1="3.05" x2="4.46" y2="4.46"/><line x1="11.54" y1="11.54" x2="12.95" y2="12.95"/><line x1="3.05" y1="12.95" x2="4.46" y2="11.54"/><line x1="11.54" y1="4.46" x2="12.95" y2="3.05"/></svg>);
const MoonIcon = () => (<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M14 8.5A6.5 6.5 0 0 1 7.5 2 5.5 5.5 0 1 0 14 8.5Z"/></svg>);

const ROLE_LABELS = { full_admin: "Admin", analyst: "Analyst", client: "Client" };

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const { projectName, clearProject } = useProject();
  const { role, userEmail } = useRole();
  const [dark, setDark] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });
  const menuRef = useRef(null);

  useEffect(() => {
    const saved = localStorage.getItem("sb-dark");
    if (saved === "true") { setDark(true); document.documentElement.classList.add("dark"); }
  }, []);

  // Close menu on outside click
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

  const goToDashboard = () => { router.push("/dashboard"); };
  const switchProject = () => { clearProject(); router.push("/projects"); };

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    clearProject();
    router.replace("/login");
  };

  const tabs = mainTabs.filter(t => role && canAccess(role, t.module));
  const isAdmin = role === "full_admin";

  return (
    <div className="px-5 py-2 flex items-center justify-between sticky top-0 z-[100]"
      style={{ background: "#0a0f3c", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
      <div className="flex items-center gap-4">
        {/* Logo → projects */}
        <div className="flex items-center gap-2 cursor-pointer" onClick={switchProject}>
          <img src="/knots-dots-logo.png" alt="K&D" style={{ height: 20 }} />
          <span className="text-[10px] font-bold text-white/30 uppercase tracking-[0.15em]">Groundwork</span>
        </div>

        {/* Project name → dashboard */}
        <div className="border-l border-white/10 pl-4 flex items-center gap-1">
          <button onClick={goToDashboard} className="text-xs text-white/70 font-medium hover:text-white transition">
            {projectName || "Select project"}
          </button>
        </div>

        {/* Main tabs */}
        <div className="flex gap-0.5 ml-2">
          {tabs.map(t => {
            const active = pathname.startsWith(t.href);
            return (
              <button key={t.href} onClick={() => router.push(t.href)}
                className={`px-3 py-1.5 rounded-md text-[13px] font-medium transition ${
                  active ? "text-white" : "text-white/40 hover:text-white/70"
                }`}
                style={active ? { background: "rgba(255,255,255,0.08)" } : {}}>
                {t.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Right side — profile menu */}
      <div className="flex items-center gap-3">
        <button onClick={toggleDark} className="text-white/30 hover:text-white/60 p-1 rounded-md transition" title={dark ? "Light mode" : "Dark mode"}>
          {dark ? <SunIcon /> : <MoonIcon />}
        </button>

        {/* Profile dropdown */}
        <div className="relative" ref={menuRef}>
          <button onClick={() => {
              if (!menuOpen && menuRef.current) {
                const r = menuRef.current.getBoundingClientRect();
                setMenuPos({ top: r.bottom + 6, right: window.innerWidth - r.right });
              }
              setMenuOpen(!menuOpen);
            }}
            className="flex items-center gap-2 text-white/50 hover:text-white/80 transition pl-2">
            {/* Avatar circle */}
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold uppercase"
              style={{ background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.6)" }}>
              {userEmail ? userEmail[0] : "?"}
            </div>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" className={`transition ${menuOpen ? "rotate-180" : ""}`}>
              <path d="M2 4l3 3 3-3" />
            </svg>
          </button>

          {/* Dropdown menu — rendered via portal to escape stacking context */}
          {menuOpen && typeof window !== "undefined" && createPortal(
            <><div className="fixed inset-0" style={{zIndex:99998}} onClick={()=>setMenuOpen(false)}/><div className="fixed w-56 bg-surface border border-main rounded-xl shadow-2xl py-1 animate-fadeIn"
              style={{ zIndex: 99999, top: menuPos.top, right: menuPos.right }}>
              {/* User info */}
              <div className="px-4 py-3 border-b border-main">
                <p className="text-sm font-medium text-main truncate">{userEmail}</p>
                <p className="text-[10px] text-muted uppercase tracking-wider mt-0.5">{ROLE_LABELS[role] || role}</p>
              </div>

              {/* Dashboard */}
              <button onClick={() => { setMenuOpen(false); router.push("/dashboard"); }}
                className="w-full text-left px-4 py-2.5 text-sm text-muted hover:text-main hover:bg-surface2 transition flex items-center gap-2.5">
                <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="2" width="5" height="5" rx="1"/><rect x="9" y="2" width="5" height="5" rx="1"/><rect x="2" y="9" width="5" height="5" rx="1"/><rect x="9" y="9" width="5" height="5" rx="1"/></svg>
                Dashboard
              </button>

              {/* Settings */}
              {canAccess(role, "settings") && (
                <button onClick={() => { setMenuOpen(false); router.push("/settings"); }}
                  className="w-full text-left px-4 py-2.5 text-sm text-muted hover:text-main hover:bg-surface2 transition flex items-center gap-2.5">
                  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="3"/><path d="M13.7 6.3l-1-.2a4.8 4.8 0 00-.5-1.2l.5-.9a.5.5 0 00-.1-.6l-.7-.7a.5.5 0 00-.6-.1l-.9.5a4.8 4.8 0 00-1.2-.5l-.2-1a.5.5 0 00-.5-.4H7.5a.5.5 0 00-.5.4l-.2 1a4.8 4.8 0 00-1.2.5l-.9-.5a.5.5 0 00-.6.1l-.7.7a.5.5 0 00-.1.6l.5.9a4.8 4.8 0 00-.5 1.2l-1 .2a.5.5 0 00-.4.5v1a.5.5 0 00.4.5l1 .2a4.8 4.8 0 00.5 1.2l-.5.9a.5.5 0 00.1.6l.7.7a.5.5 0 00.6.1l.9-.5a4.8 4.8 0 001.2.5l.2 1a.5.5 0 00.5.4h1a.5.5 0 00.5-.4l.2-1a4.8 4.8 0 001.2-.5l.9.5a.5.5 0 00.6-.1l.7-.7a.5.5 0 00.1-.6l-.5-.9a4.8 4.8 0 00.5-1.2l1-.2a.5.5 0 00.4-.5v-1a.5.5 0 00-.4-.5z"/></svg>
                  Settings
                </button>
              )}

              {/* Users (admin only) */}
              {canAccess(role, "users") && (
                <button onClick={() => { setMenuOpen(false); router.push("/users"); }}
                  className="w-full text-left px-4 py-2.5 text-sm text-muted hover:text-main hover:bg-surface2 transition flex items-center gap-2.5">
                  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="5" r="3"/><path d="M2 14c0-3 2.7-5 6-5s6 2 6 5"/></svg>
                  User Management
                </button>
              )}

              <div className="border-t border-main my-1" />

              {/* Dark mode toggle */}
              <button onClick={() => { toggleDark(); setMenuOpen(false); }}
                className="w-full text-left px-4 py-2.5 text-sm text-muted hover:text-main hover:bg-surface2 transition flex items-center gap-2.5">
                {dark ? <SunIcon /> : <MoonIcon />}
                {dark ? "Light mode" : "Dark mode"}
              </button>

              {/* Switch project */}
              <button onClick={() => { setMenuOpen(false); switchProject(); }}
                className="w-full text-left px-4 py-2.5 text-sm text-muted hover:text-main hover:bg-surface2 transition flex items-center gap-2.5">
                <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M6 2H3a1 1 0 00-1 1v10a1 1 0 001 1h3M11 12l3-4-3-4M6 8h8"/></svg>
                Switch project
              </button>

              <div className="border-t border-main my-1" />

              {/* Logout */}
              <button onClick={() => { setMenuOpen(false); handleLogout(); }}
                className="w-full text-left px-4 py-2.5 text-sm text-red-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition flex items-center gap-2.5">
                <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M6 14H3a1 1 0 01-1-1V3a1 1 0 011-1h3M11 12l3-4-3-4M6 8h8"/></svg>
                Sign out
              </button>
            </div></>,
            document.body
          )}
        </div>
      </div>
    </div>
  );
}
