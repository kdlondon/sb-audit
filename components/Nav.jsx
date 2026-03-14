"use client";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { useEffect, useState } from "react";

const tabs = [
  { name: "Audit", href: "/audit" },
  { name: "Reports", href: "/reports" },
  { name: "Chat", href: "/chat" },
];

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
    <div className="bg-surface border-b border-main px-5 py-2.5 flex items-center justify-between">
      <div className="flex items-center gap-5">
        <div className="mr-2">
          <p className="text-[9px] text-accent font-bold tracking-[0.15em] uppercase leading-none">SB — BB</p>
          <p className="text-[11px] font-semibold text-main leading-tight">Category Landscape</p>
        </div>

        {onScopeChange && (
          <div className="flex bg-surface2 rounded-lg p-0.5">
            <button onClick={() => onScopeChange("local")}
              className={`px-3 py-1 rounded-md text-xs font-medium transition ${scope === "local" ? "bg-surface text-accent shadow-sm" : "text-muted"}`}>
              Local
            </button>
            <button onClick={() => onScopeChange("global")}
              className={`px-3 py-1 rounded-md text-xs font-medium transition ${scope === "global" ? "bg-surface text-accent shadow-sm" : "text-muted"}`}>
              Global
            </button>
          </div>
        )}

        <div className="flex gap-0.5">
          {tabs.map(t => (
            <button key={t.href} onClick={() => router.push(t.href)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
                pathname.startsWith(t.href) ? "bg-accent-soft text-accent" : "text-muted hover:text-main"
              }`}>
              {t.name}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={toggleDark} className="text-muted hover:text-main text-lg" title={dark ? "Light mode" : "Dark mode"}>
          {dark ? "☀️" : "🌙"}
        </button>
        <button onClick={handleLogout} className="text-xs text-hint hover:text-muted">Sign out</button>
      </div>
    </div>
  );
}
