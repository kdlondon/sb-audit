"use client";
import { usePathname, useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase";
import { useProject } from "@/lib/project-context";
import { useRole, canAccess } from "@/lib/role-context";
import { useEffect, useState, useRef } from "react";

const mainTabs = [
  { name: "Scout", href: "/scout", module: "scout" },
  { name: "Audit", href: "/audit", module: "audit" },
  { name: "Report", href: "/reports", module: "reports" },
  { name: "Showcase", href: "/showcase", module: "showcase" },
];

const ROLE_LABELS = { full_admin: "Admin", analyst: "Analyst", client: "Client" };

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const { projectName, clearProject } = useProject();
  const { role, userEmail } = useRole();
  const [dark, setDark] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [whatsNewOpen, setWhatsNewOpen] = useState(false);
  const menuRef = useRef(null);
  const addRef = useRef(null);

  useEffect(() => {
    const saved = localStorage.getItem("sb-dark");
    if (saved === "true") { setDark(true); document.documentElement.classList.add("dark"); }
  }, []);

  useEffect(() => {
    if (!menuOpen && !addMenuOpen) return;
    const handler = (e) => {
      if (menuOpen && menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
      if (addMenuOpen && addRef.current && !addRef.current.contains(e.target)) setAddMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen, addMenuOpen]);

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
          <span className="text-[10px] font-bold text-white/60 uppercase tracking-[0.15em]">Groundwork</span>
        </div>
        <div className="border-l border-white/10 pl-4">
          <button onClick={() => { if (role !== "client") router.push(pathname.startsWith("/admin") ? "/admin/clients" : "/scout"); }} className={`text-xs font-medium transition ${role === "client" ? "text-white/70 cursor-default" : "text-white/70 hover:text-white"}`}>
            {pathname.startsWith("/admin") ? "Platform Admin" : (projectName || "Select project")}
          </button>
        </div>
        {!pathname.startsWith("/admin") && <div className="flex gap-0.5 ml-2">
          {tabs.map(t => (
            <button key={t.href} onClick={() => router.push(t.href)}
              className={`px-3 py-1.5 rounded-md text-[13px] font-medium transition ${
                pathname.startsWith(t.href) ? "text-white" : "text-white/40 hover:text-white/70"
              }`}
              style={pathname.startsWith(t.href) ? { background: "rgba(255,255,255,0.08)" } : {}}>
              {t.name}
            </button>
          ))}
        </div>}
      </div>

      <div className="flex items-center gap-2" ref={menuRef}>
        {/* Sparkles background */}
        <div className="relative flex items-center gap-2">
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className="ai-sparkle" style={{ top: "18%", left: "10%", animationDelay: "0s" }} />
            <div className="ai-sparkle" style={{ top: "65%", left: "35%", animationDelay: "0.8s" }} />
            <div className="ai-sparkle" style={{ top: "22%", left: "65%", animationDelay: "1.5s" }} />
            <div className="ai-sparkle" style={{ top: "72%", left: "80%", animationDelay: "0.4s" }} />
          </div>

          {/* Add — chartreuse */}
          {canAccess(role, "audit") && (
            <div className="relative" ref={addRef}>
              <button onClick={() => setAddMenuOpen(!addMenuOpen)}
                className="group h-[28px] px-2 rounded-full flex items-center gap-0 hover:gap-1.5 hover:px-3 transition-all duration-300 ease-out"
                style={{ background: "#D4E520" }}>
                <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="#0a0f3c" strokeWidth="2.5" className="flex-shrink-0"><line x1="10" y1="5" x2="10" y2="15"/><line x1="5" y1="10" x2="15" y2="10"/></svg>
                <span className="text-[10px] font-bold uppercase tracking-wide overflow-hidden max-w-0 group-hover:max-w-[40px] opacity-0 group-hover:opacity-100 transition-all duration-300 whitespace-nowrap" style={{ color: "#0a0f3c" }}>Add</span>
              </button>
              {addMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-40 bg-surface border border-main rounded-xl shadow-2xl overflow-hidden animate-fadeIn" style={{ zIndex: 99999 }}>
                  <button onClick={() => { setAddMenuOpen(false);
                    if(pathname.startsWith("/audit")){window.dispatchEvent(new CustomEvent("openAddForm",{detail:{scope:"local"}}));}
                    else{window.location.href="/audit?scope=local&add=1";}
                  }} className="w-full text-left px-4 py-2.5 text-sm text-main hover:bg-accent-soft transition border-b border-main">Local entry</button>
                  <button onClick={() => { setAddMenuOpen(false);
                    if(pathname.startsWith("/audit")){window.dispatchEvent(new CustomEvent("openAddForm",{detail:{scope:"global"}}));}
                    else{window.location.href="/audit?scope=global&add=1";}
                  }} className="w-full text-left px-4 py-2.5 text-sm text-main hover:bg-accent-soft transition">Global entry</button>
                </div>
              )}
            </div>
          )}

          {/* Chat — blue */}
          {canAccess(role, "chat") && (
            <button onClick={() => router.push("/chat")}
              className="group h-[28px] px-2 rounded-full flex items-center gap-0 hover:gap-1.5 hover:px-3 transition-all duration-300 ease-out"
              style={{ background: "#0019FF" }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" className="flex-shrink-0"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
              <span className="text-[10px] font-bold uppercase tracking-wide text-white overflow-hidden max-w-0 group-hover:max-w-[40px] opacity-0 group-hover:opacity-100 transition-all duration-300 whitespace-nowrap">Chat</span>
            </button>
          )}
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
            <button onClick={() => { setMenuOpen(false); router.push("/reports"); }}
              className="w-full text-left px-4 py-2.5 text-sm text-muted hover:text-main hover:bg-surface2 transition">Dashboard</button>
            {canAccess(role, "settings") && (
              <button onClick={() => { setMenuOpen(false); router.push("/settings"); }}
                className="w-full text-left px-4 py-2.5 text-sm text-muted hover:text-main hover:bg-surface2 transition">Settings</button>
            )}
            {canAccess(role, "users") && (
              <button onClick={() => { setMenuOpen(false); router.push("/users"); }}
                className="w-full text-left px-4 py-2.5 text-sm text-muted hover:text-main hover:bg-surface2 transition">User Management</button>
            )}
            {canAccess(role, "clients") && (
              <button onClick={() => { setMenuOpen(false); router.push("/admin/clients"); }}
                className="w-full text-left px-4 py-2.5 text-sm text-muted hover:text-main hover:bg-surface2 transition">Client Management</button>
            )}
            <div className="border-t border-main my-1" />
            <button onClick={() => { toggleDark(); setMenuOpen(false); }}
              className="w-full text-left px-4 py-2.5 text-sm text-muted hover:text-main hover:bg-surface2 transition">
              {dark ? "Light mode" : "Dark mode"}
            </button>
            <button onClick={() => { setMenuOpen(false); clearProject(); router.push("/projects"); }}
              className="w-full text-left px-4 py-2.5 text-sm text-muted hover:text-main hover:bg-surface2 transition">Switch project</button>
            <button onClick={() => { setMenuOpen(false); setWhatsNewOpen(true); }}
              className="w-full text-left px-4 py-2.5 text-sm text-muted hover:text-main hover:bg-surface2 transition flex items-center justify-between">
              What's new
              <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold" style={{background:"#D4E520",color:"#0a0f3c"}}>v2.5</span>
            </button>
            <div className="border-t border-main my-1" />
            <button onClick={() => { setMenuOpen(false); handleLogout(); }}
              className="w-full text-left px-4 py-2.5 text-sm text-red-400 hover:text-red-500 hover:bg-red-50 transition">Sign out</button>
          </div>
        )}
      </div>

      {/* What's New modal — via portal */}
      {whatsNewOpen && typeof window !== "undefined" && createPortal(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center animate-fadeIn" style={{zIndex:99999}} onClick={()=>setWhatsNewOpen(false)}>
          <div className="bg-surface w-[520px] max-h-[80vh] rounded-2xl shadow-2xl overflow-hidden" onClick={e=>e.stopPropagation()}>
            <div className="px-6 py-4 flex justify-between items-center" style={{background:"#0a0f3c"}}>
              <div>
                <h2 className="text-lg font-bold text-white">What's new</h2>
                <p className="text-[10px] text-white/40 mt-0.5">Release notes</p>
              </div>
              <button onClick={()=>setWhatsNewOpen(false)} className="text-white/40 hover:text-white text-xl w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10">×</button>
            </div>
            <div className="px-6 py-5 overflow-y-auto max-h-[60vh]">
              {/* v2.5 */}
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded" style={{background:"#D4E520",color:"#0a0f3c"}}>v2.5</span>
                  <span className="text-[10px] text-hint">March 2026</span>
                </div>
                <div className="space-y-3">
                  {[
                    { title: "YouTube Scout", desc: "AI-powered content discovery. Search by brand, category, or keywords with relevance scoring and commercial duration filters." },
                    { title: "Creative Showcase", desc: "Cinematic K&D-branded presentations with slide editor, PDF export, and shareable links." },
                    { title: "User Management", desc: "Role-based access control — Admin, Analyst, and Client with per-project permissions." },
                    { title: "Communication Intent", desc: "Classify entries as Brand, Product, Innovation, or Beyond Banking. Normalized dashboard comparisons." },
                    { title: "Brand Classification", desc: "Assign brand types in Settings. Grouped lists across Reports and Dashboard." },
                    { title: "Video Frame Capture", desc: "Native screen capture tool for grabbing stills directly from video playback." },
                    { title: "Image Viewer", desc: "In-place zoom and pan with filmstrip navigation for all entry images." },
                    { title: "Dashboard Upgrades", desc: "Brand filter, pastel chart palette, PNG export for every visualization." },
                    { title: "Shareable Entry URLs", desc: "Direct links to specific audit entries for easy team collaboration." },
                    { title: "Move Entries", desc: "Transfer cases between Local and Global scopes with automatic field mapping." },
                    { title: "Custom Domain & Staging", desc: "Production at groundwork.kad.london with staging environment for safe testing." },
                  ].map((item, i) => (
                    <div key={i} className="flex gap-3 items-start">
                      <div className="w-1 h-1 rounded-full mt-2 flex-shrink-0" style={{background:"#0019FF"}} />
                      <div>
                        <span className="text-sm font-semibold text-main">{item.title}</span>
                        <span className="text-xs text-muted ml-1.5">{item.desc}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* v2.4 */}
              <div className="pt-4 border-t border-main">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-surface2 text-muted">v2.4</span>
                  <span className="text-[10px] text-hint">February 2026</span>
                </div>
                <div className="space-y-2">
                  {[
                    "Multi-project module with project selector",
                    "Audit form with multi-select fields and AI analysis",
                    "Reports module — 5 templates + Journey Map",
                    "AI Chat with entry citations",
                    "Dashboard data visualizations",
                    "Settings for dropdown management",
                  ].map((item, i) => (
                    <div key={i} className="flex gap-3 items-start">
                      <div className="w-1 h-1 rounded-full mt-2 flex-shrink-0 bg-surface2" />
                      <p className="text-xs text-muted">{item}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="px-6 py-3 border-t border-main text-center">
              <p className="text-[10px] text-hint">Groundwork by Knots & Dots</p>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
