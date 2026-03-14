"use client";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { useEffect, useState } from "react";

const tabs = [
  { name: "Audit", href: "/audit" },
  { name: "Dashboard", href: "/dashboard" },
  { name: "Reports", href: "/reports" },
  { name: "Chat", href: "/chat" },
  { name: "Settings", href: "/settings" },
];

const SunIcon = () => (<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="8" cy="8" r="3"/><line x1="8" y1="1" x2="8" y2="3"/><line x1="8" y1="13" x2="8" y2="15"/><line x1="1" y1="8" x2="3" y2="8"/><line x1="13" y1="8" x2="15" y2="8"/><line x1="3.05" y1="3.05" x2="4.46" y2="4.46"/><line x1="11.54" y1="11.54" x2="12.95" y2="12.95"/><line x1="3.05" y1="12.95" x2="4.46" y2="11.54"/><line x1="11.54" y1="4.46" x2="12.95" y2="3.05"/></svg>);
const MoonIcon = () => (<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M14 8.5A6.5 6.5 0 0 1 7.5 2 5.5 5.5 0 1 0 14 8.5Z"/></svg>);

export default function Nav({ scope, onScopeChange }) {
  const pathname = usePathname();
  const router = useRouter();
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("sb-dark");
    if (saved === "true") { setDark(true); document.documentElement.classList.add("dark"); }
  }, []);

  const toggleDark = () => {
    const next = !dark;
    setDark(next);
    localStorage.setItem("sb-dark", String(next));
    document.documentElement.classList.toggle("dark", next);
  };

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
  };

  return (
    <div className="bg-surface border-b border-main px-5 py-2.5 flex items-center justify-between sticky top-0 z-40">
      <div className="flex items-center gap-5">
        <div className="mr-2">
          <p className="text-[9px] text-accent font-bold tracking-[0.15em] uppercase leading-none">SB — BB</p>
          <p className="text-[11px] font-semibold text-main leading-tight">Category Landscape</p>
        </div>
        {onScopeChange && (
          <div className="flex bg-surface2 rounded-lg p-0.5">
            <button onClick={() => onScopeChange("local")} className={`px-3 py-1 rounded-md text-xs font-medium transition ${scope === "local" ? "bg-surface text-accent shadow-sm" : "text-muted"}`}>Local</button>
            <button onClick={() => onScopeChange("global")} className={`px-3 py-1 rounded-md text-xs font-medium transition ${scope === "global" ? "bg-surface text-accent shadow-sm" : "text-muted"}`}>Global</button>
          </div>
        )}
        <div className="flex gap-0.5">
          {tabs.map(t => (
            <button key={t.href} onClick={() => router.push(t.href)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${pathname.startsWith(t.href) ? "bg-accent-soft text-accent" : "text-muted hover:text-main"}`}>{t.name}</button>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button onClick={toggleDark} className="text-muted hover:text-main p-1 rounded-md hover:bg-surface2 transition" title={dark ? "Light mode" : "Dark mode"}>
          {dark ? <SunIcon /> : <MoonIcon />}
        </button>
        <button onClick={handleLogout} className="text-xs text-hint hover:text-muted">Sign out</button>
      </div>
    </div>
  );
}
