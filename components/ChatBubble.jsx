"use client";
import { useRouter, usePathname } from "next/navigation";
import { useRole, canAccess } from "@/lib/role-context";

export default function ChatBubble() {
  const router = useRouter();
  const pathname = usePathname();
  const { role } = useRole();

  // Don't show on login, projects, or chat page itself
  if (!role || !canAccess(role, "chat")) return null;
  if (["/login", "/projects", "/chat"].includes(pathname)) return null;

  return (
    <button
      onClick={() => router.push("/chat")}
      className="fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-110 hover:shadow-xl group"
      style={{ background: "#0019FF" }}
      title="AI Chat"
    >
      {/* Chat icon */}
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
      </svg>
      {/* Pulse effect */}
      <span className="absolute inset-0 rounded-full animate-ping opacity-20" style={{ background: "#0019FF" }} />
    </button>
  );
}
