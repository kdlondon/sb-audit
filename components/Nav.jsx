"use client";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { useProject } from "@/lib/project-context";
import { useRole, canAccess } from "@/lib/role-context";
import { useEffect, useState } from "react";

const allTabs = [
  { name: "Dashboard", href: "/dashboard", module: "dashboard" },
  { name: "Audit", href: "/audit", module: "audit" },
  { name: "Reports", href: "/reports", module: "reports" },
  { name: "Chat", href: "/chat", module: "chat" },
  { name: "Showcase", href: "/showcase", module: "showcase" },
  { name: "Settings", href: "/settings", module: "settings" },
  { name: "Users", href: "/users", module: "users" },
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

  useEffect(() => {
    const saved = localStorage.getItem("sb-dark");
    if (saved === "true") { setDark(true); document.documentElement.classList.add("dark"); }
  }, []);

  const toggleDark = () => {
    const next = !dark; setDark(next);
    localStorage.setItem("sb-dark", String(next));
    document.documentElement.classList.toggle("dark", next);
  };

  const switchProject = () => { clearProject(); router.push("/projects"); };

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    clearProject();
    router.replace("/login");
  };

  const tabs = allTabs.filter(t => role && canAccess(role, t.module));

  return (
    <div className="px-5 py-2 flex items-center justify-between sticky top-0 z-40"
      style={{ background: "#0a0f3c", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
      <div className="flex items-center gap-4">
        {/* Logo */}
        <div className="flex items-center gap-2 cursor-pointer" onClick={switchProject}>
          <img src="/knots-dots-logo.png" alt="K&D" style={{ height: 20 }} />
          <span className="text-[10px] font-bold text-white/30 uppercase tracking-[0.15em]">Groundwork</span>
        </div>

        {/* Project selector */}
        <div className="border-l border-white/10 pl-4 flex items-center gap-1">
          <button onClick={switchProject} className="text-xs text-white/70 font-medium hover:text-white transition">
            {projectName || "Select project"}
          </button>
          <span className="text-white/25 text-xs">↗</span>
        </div>

        {/* Tabs */}
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

      <div className="flex items-center gap-3">
        {role && (
          <span className="text-[9px] text-white/30 px-2 py-0.5 rounded-full uppercase tracking-wider font-semibold"
            style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
            {ROLE_LABELS[role] || role}
          </span>
        )}
        <button onClick={toggleDark} className="text-white/30 hover:text-white/60 p-1 rounded-md transition" title={dark ? "Light mode" : "Dark mode"}>
          {dark ? <SunIcon /> : <MoonIcon />}
        </button>
        <button onClick={handleLogout} className="text-[11px] text-white/25 hover:text-white/50 transition">Sign out</button>
      </div>
    </div>
  );
}
