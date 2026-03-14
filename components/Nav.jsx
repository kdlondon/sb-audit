"use client";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

const tabs = [
  { name: "Audit", href: "/audit" },
  { name: "Reports", href: "/reports" },
  { name: "Chat", href: "/chat" },
];

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
  };

  return (
    <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-6">
        <div>
          <p className="text-[10px] text-blue-600 font-bold tracking-widest uppercase">SB Audit</p>
        </div>
        <div className="flex gap-1">
          {tabs.map(t => (
            <button
              key={t.href}
              onClick={() => router.push(t.href)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${
                pathname.startsWith(t.href)
                  ? "bg-blue-50 text-blue-700"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              }`}
            >
              {t.name}
            </button>
          ))}
        </div>
      </div>
      <button onClick={handleLogout} className="text-xs text-gray-400 hover:text-gray-600">
        Sign out
      </button>
    </div>
  );
}
