"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import AuthGuard from "@/components/AuthGuard";

const PROFILES = [
  { name: "Laura", color: "#E11D48" },
  { name: "Alexei", color: "#0019FF" },
  { name: "James", color: "#1D9A42" },
  { name: "Jenny", color: "#D97706" },
  { name: "Other", color: "#6B7280" },
];

export default function ProfilePage() {
  const router = useRouter();
  const [showOther, setShowOther] = useState(false);
  const [otherName, setOtherName] = useState("");

  const selectProfile = (name) => {
    localStorage.setItem("groundwork_profile", name);
    router.replace("/showcase");
  };

  return (
    <AuthGuard>
      <div className="min-h-screen flex flex-col items-center justify-center" style={{ background: "#0a0f3c" }}>
        <div className="mb-12 flex items-center gap-2">
          <img src="/knots-dots-logo.png" alt="K&D" style={{ height: 24 }} />
          <span className="text-[11px] font-bold text-white/50 uppercase tracking-[0.15em]">Groundwork</span>
        </div>
        <h1 className="text-2xl md:text-3xl font-bold text-white mb-10">Who&apos;s watching?</h1>

        {!showOther ? (
          <div className="flex items-center gap-8">
            {PROFILES.map(p => (
              <button key={p.name}
                onClick={() => p.name === "Other" ? setShowOther(true) : selectProfile(p.name)}
                className="flex flex-col items-center gap-3 group transition">
                <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-2xl font-bold text-white transition-all group-hover:scale-110 group-hover:ring-2 group-hover:ring-white/40"
                  style={{ backgroundColor: p.color }}>
                  {p.name === "Other" ? "+" : p.name[0]}
                </div>
                <span className="text-sm text-white/60 group-hover:text-white transition">{p.name}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <input value={otherName} onChange={e => setOtherName(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && otherName.trim()) selectProfile(otherName.trim()); }}
              placeholder="Enter your name"
              className="px-6 py-3 bg-white/10 border border-white/20 rounded-xl text-white text-center text-lg focus:outline-none focus:border-white/50 w-[280px] placeholder-white/30"
              autoFocus />
            <div className="flex gap-3">
              <button onClick={() => setShowOther(false)}
                className="px-5 py-2 text-sm text-white/40 hover:text-white/70 transition">Back</button>
              <button onClick={() => { if (otherName.trim()) selectProfile(otherName.trim()); }}
                disabled={!otherName.trim()}
                className="px-6 py-2 text-sm font-semibold text-white rounded-lg hover:opacity-90 disabled:opacity-30 transition"
                style={{ backgroundColor: "#0019FF" }}>Continue</button>
            </div>
          </div>
        )}
      </div>
    </AuthGuard>
  );
}
