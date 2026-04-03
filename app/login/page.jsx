"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const supabase = createClient();
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    if (err) { setError("Invalid email or password"); setLoading(false); return; }
    router.replace("/projects");
  };

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#0a0f3c" }}>
      {/* Subtle decorative elements */}
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none overflow-hidden">
        <div className="absolute top-[15%] left-[8%] w-[500px] h-[500px] rounded-full opacity-[0.03]"
          style={{ background: "#0019FF", filter: "blur(120px)" }} />
        <div className="absolute bottom-[10%] right-[5%] w-[400px] h-[400px] rounded-full opacity-[0.04]"
          style={{ background: "#D4E520", filter: "blur(100px)" }} />
      </div>

      {/* K&D vertical logo watermark */}
      <div className="fixed left-8 top-8 flex flex-col items-start gap-0 select-none pointer-events-none text-white/[0.08]">
        {["K","N","O","T","S"].map((l, i) => (
          <span key={i} className="text-sm font-bold leading-[1.3]" style={{ marginLeft: i === 2 ? 6 : i === 3 ? 3 : 0 }}>{l}</span>
        ))}
        <span className="text-base italic mt-1 mb-1" style={{ fontFamily: "Georgia, serif" }}>&amp;</span>
        {["D","O","T","S","."].map((l, i) => (
          <span key={i} className="text-sm font-bold leading-[1.3]" style={{ marginLeft: i === 1 ? 3 : 0 }}>{l}</span>
        ))}
      </div>

      <div className="w-full max-w-sm relative z-10">
        <div className="rounded-2xl p-8 shadow-2xl" style={{ background: "#ffffff" }}>

          {/* Logo + branding */}
          <div className="text-center mb-8">
            <div className="flex justify-center mb-5">
              <img src="/knots-dots-logo.png" alt="Knots & Dots" style={{ height: 36, width: "auto" }} />
            </div>
            <h1 className="mb-1" style={{ fontSize: 28, fontWeight: 800, color: "#0a0f3c", letterSpacing: "-0.5px", lineHeight: 1.1 }}>
              Groundwork
            </h1>
            <p style={{ fontSize: 11, color: "#8e90a6", fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", marginTop: 6 }}>
              Competitive Intelligence Platform
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin}>
            <div className="mb-4">
              <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#5a5e7a", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                style={{ width: "100%", padding: "10px 14px", background: "#f5f4f0", border: "1px solid #ddd9d0", borderRadius: 8, fontSize: 14, color: "#0a0f3c", outline: "none", boxSizing: "border-box" }}
                placeholder="you@kad.london"
                required
              />
            </div>
            <div className="mb-6">
              <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#5a5e7a", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                style={{ width: "100%", padding: "10px 14px", background: "#f5f4f0", border: "1px solid #ddd9d0", borderRadius: 8, fontSize: 14, color: "#0a0f3c", outline: "none", boxSizing: "border-box" }}
                placeholder="••••••••"
                required
              />
            </div>
            {error && <p style={{ color: "#e53e3e", fontSize: 13, marginBottom: 16 }}>{error}</p>}
            <button
              type="submit"
              disabled={loading}
              style={{ width: "100%", background: "#0019FF", color: "#fff", padding: "11px", borderRadius: 8, fontSize: 14, fontWeight: 700, border: "none", cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1, letterSpacing: "0.02em" }}
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>

          {/* Footer */}
          <div style={{ marginTop: 28, paddingTop: 20, borderTop: "1px solid #efeee9", textAlign: "center" }}>
            <p style={{ fontSize: 11, color: "#8e90a6", lineHeight: 1.6 }}>
              A Knots & Dots product
            </p>
            <p style={{ fontSize: 10, color: "#b0b2c0", marginTop: 2 }}>
              Version 2.5 · © 2026 Knots & Dots
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}
