"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { useBrand } from "@/lib/brand-context";
import { useRole } from "@/lib/role-context";
import AuthGuard from "@/components/AuthGuard";

export default function ClientDashboard() {
  const [brands, setBrands] = useState([]);
  const [caseCounts, setCaseCounts] = useState({});
  const [recentEntries, setRecentEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { selectBrand } = useBrand();
  const { role, userId, activeOrg, isPlatformAdmin, isOrgAdmin, loading: roleLoading } = useRole() || { loading: true };
  const supabase = createClient();
  const isAdmin = role === "full_admin" || isPlatformAdmin || isOrgAdmin;

  const load = async () => {
    const orgId = activeOrg?.id;

    // Load own brands only
    let q = supabase.from("brands").select("*").eq("proximity", "own_brand").eq("is_active", true).order("updated_at", { ascending: false });
    if (orgId) q = q.eq("organization_id", orgId);
    const { data: brandsData } = await q;
    setBrands(brandsData || []);

    // For each own brand, count total entries via brand_competitors
    const counts = {};
    for (const b of (brandsData || [])) {
      const { data: comps } = await supabase.from("brand_competitors").select("competitor_brand_id").eq("own_brand_id", b.id);
      const compIds = (comps || []).map(c => c.competitor_brand_id);
      if (compIds.length > 0) {
        const { count } = await supabase.from("creative_source").select("*", { count: "exact", head: true }).in("brand_id", compIds);
        counts[b.id] = count || 0;
      } else {
        // Fallback: count by organization_id
        const { count } = await supabase.from("creative_source").select("*", { count: "exact", head: true }).eq("organization_id", b.organization_id);
        counts[b.id] = count || 0;
      }
    }
    setCaseCounts(counts);

    // Recent activity — entries from this org
    const { data: recent } = await supabase
      .from("creative_source")
      .select("id, brand_name, description, scope, created_at")
      .order("created_at", { ascending: false })
      .limit(10);
    setRecentEntries(recent || []);

    setLoading(false);
  };

  useEffect(() => {
    if (roleLoading) return;
    if (role && userId) load();
    else if (!role) { setBrands([]); setLoading(false); }
  }, [role, userId, roleLoading, activeOrg]);

  const enterBrand = async (b) => {
    // Find project_id from any entry in the same organization
    const { data: cs } = await supabase
      .from("creative_source")
      .select("project_id")
      .eq("organization_id", b.organization_id)
      .not("project_id", "is", null)
      .limit(1)
      .single();
    const projId = cs?.project_id || null;

    selectBrand(b.id, b.name, projId);
    if (projId) {
      localStorage.setItem("sb-project-id", projId);
      localStorage.setItem("sb-project-name", b.name);
    }
    router.push(role === "client" || role === "viewer" ? "/showcase" : "/audit");
  };

  const handleLogout = async () => { await supabase.auth.signOut(); router.replace("/login"); };

  const timeAgo = (d) => {
    if (!d) return "";
    const diff = Date.now() - new Date(d).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  if (loading) return <AuthGuard><div className="min-h-screen flex items-center justify-center"><p className="text-hint">Loading...</p></div></AuthGuard>;

  return (
    <AuthGuard>
      <div className="min-h-screen" style={{ background: "var(--bg)" }}>
        {/* Header */}
        <div className="px-6 py-4 flex justify-between items-center" style={{ background: "#0a0f3c", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex items-center gap-3">
            <img src="/knots-dots-logo.png" alt="Knots & Dots" style={{ height: 22 }} />
            <div>
              <p className="text-sm font-semibold text-white">Groundwork</p>
              <p className="text-[10px] text-white/40">{activeOrg?.name || "Competitive Intelligence Platform"}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {isPlatformAdmin && (
              <button onClick={() => router.push("/admin/clients")} className="text-[11px] text-white/30 hover:text-white/60 transition">Platform Admin</button>
            )}
            <button onClick={handleLogout} className="text-[11px] text-white/25 hover:text-white/50 transition">Sign out</button>
          </div>
        </div>

        <div className="max-w-4xl mx-auto p-8">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-main">Your Brands</h1>
            <p className="text-sm text-muted mt-1">Select a brand to start working, or add a new one.</p>
          </div>

          {isAdmin && (
            <div className="mb-6">
              <button onClick={() => router.push("/onboarding")}
                className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-semibold hover:opacity-90">
                + New Brand
              </button>
            </div>
          )}

          {/* Brand Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
            {brands.map(b => (
              <div key={b.id} onClick={() => enterBrand(b)}
                className="bg-surface border border-main rounded-xl p-5 cursor-pointer hover:border-accent transition group">
                <h3 className="text-base font-bold text-main group-hover:text-accent transition">{b.display_name || b.name}</h3>
                <div className="flex items-center gap-3 text-xs text-hint mt-2">
                  <span>{caseCounts[b.id] || 0} cases</span>
                  {b.updated_at && <span>· {timeAgo(b.updated_at)}</span>}
                </div>
              </div>
            ))}
          </div>

          {brands.length === 0 && (
            <div className="text-center py-20 text-hint">
              <p className="text-lg mb-2">No brands yet</p>
              <p className="text-sm">{isAdmin ? "Add your first brand to get started" : "No brands have been assigned to you yet"}</p>
            </div>
          )}

          {/* Recent Activity */}
          {recentEntries.length > 0 && (
            <div>
              <h2 className="text-sm font-bold text-main mb-3">Recent activity</h2>
              <div className="space-y-1">
                {recentEntries.map((e, i) => (
                  <div key={i} className="flex items-center gap-3 py-1.5 text-xs">
                    <div className="w-1.5 h-1.5 rounded-full bg-accent/40" />
                    <span className="text-muted font-medium">{e.brand_name || "—"}</span>
                    <span className="text-hint">·</span>
                    <span className="text-main truncate max-w-[300px]">{e.description || "Entry"}</span>
                    <span className="text-hint ml-auto flex-shrink-0">{timeAgo(e.created_at)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </AuthGuard>
  );
}
