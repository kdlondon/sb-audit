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
    <div className="min-h-screen flex items-center justify-center" style={{background:"#0a0a0a"}}>
      <div className="w-full max-w-sm">
        <div className="rounded-2xl p-8" style={{background:"#ffffff"}}>

          {/* Logo + branding */}
          <div className="text-center mb-8">
            <div className="flex justify-center mb-5">
              <img src="/knots-dots-logo.png" alt="Knots & Dots" style={{height:36,width:"auto"}}/>
            </div>
            <h1 style={{fontSize:28,fontWeight:800,color:"#0a0a0a",letterSpacing:"-0.5px",lineHeight:1.1}} className="mb-1">
              Groundwork
            </h1>
            <p style={{fontSize:12,color:"#888",fontWeight:500,letterSpacing:"0.05em",textTransform:"uppercase",marginTop:4}}>
              Competitive Intelligence Platform
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin}>
            <div className="mb-4">
              <label style={{display:"block",fontSize:11,fontWeight:600,color:"#555",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:6}}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                style={{width:"100%",padding:"10px 14px",background:"#f5f5f5",border:"1px solid #e0e0e0",borderRadius:10,fontSize:14,color:"#0a0a0a",outline:"none",boxSizing:"border-box"}}
                placeholder="you@kad.london"
                required
              />
            </div>
            <div className="mb-6">
              <label style={{display:"block",fontSize:11,fontWeight:600,color:"#555",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:6}}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                style={{width:"100%",padding:"10px 14px",background:"#f5f5f5",border:"1px solid #e0e0e0",borderRadius:10,fontSize:14,color:"#0a0a0a",outline:"none",boxSizing:"border-box"}}
                placeholder="••••••••"
                required
              />
            </div>
            {error && <p style={{color:"#e53e3e",fontSize:13,marginBottom:16}}>{error}</p>}
            <button
              type="submit"
              disabled={loading}
              style={{width:"100%",background:"#0a0a0a",color:"#fff",padding:"11px",borderRadius:10,fontSize:14,fontWeight:700,border:"none",cursor:loading?"not-allowed":"pointer",opacity:loading?0.6:1,letterSpacing:"0.01em"}}
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>

          {/* Footer */}
          <div style={{marginTop:28,paddingTop:20,borderTop:"1px solid #f0f0f0",textAlign:"center"}}>
            <p style={{fontSize:11,color:"#bbb",lineHeight:1.6}}>
              A Knots & Dots product
            </p>
            <p style={{fontSize:10,color:"#ccc",marginTop:2}}>
              Version 2.4 · © 2026 Knots & Dots
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}
