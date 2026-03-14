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
    router.replace("/audit");
  };

  return (
    <div className="min-h-screen flex items-center justify-center" style={{background:"var(--bg)"}}>
      <div className="w-full max-w-sm">
        <div className="bg-surface rounded-xl border border-main p-8">
          <div className="text-center mb-8">
            <p className="text-xs text-accent font-semibold tracking-widest uppercase mb-1">Scotiabank BB</p>
            <h1 className="text-xl font-bold text-main">Category Landscape</h1>
            <p className="text-sm text-muted mt-1">Sign in to continue</p>
          </div>
          <form onSubmit={handleLogin}>
            <div className="mb-4">
              <label className="block text-xs font-medium text-muted uppercase tracking-wide mb-1">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                className="w-full px-3 py-2 bg-surface border border-main rounded-lg text-sm text-main focus:outline-none focus:border-[var(--accent)]"
                placeholder="you@kad.london" required />
            </div>
            <div className="mb-6">
              <label className="block text-xs font-medium text-muted uppercase tracking-wide mb-1">Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                className="w-full px-3 py-2 bg-surface border border-main rounded-lg text-sm text-main focus:outline-none focus:border-[var(--accent)]"
                placeholder="••••••••" required />
            </div>
            {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
            <button type="submit" disabled={loading}
              className="w-full bg-accent text-white py-2 rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50">
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
