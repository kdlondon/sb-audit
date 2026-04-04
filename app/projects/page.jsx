"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { useBrand } from "@/lib/brand-context";
import { useRole } from "@/lib/role-context";
import AuthGuard from "@/components/AuthGuard";

export default function ClientDashboard() {
  const [brands, setBrands] = useState([]);
  const [recentEntries, setRecentEntries] = useState([]);
  const [caseCounts, setCaseCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newMarket, setNewMarket] = useState("");
  const router = useRouter();
  const { selectBrand } = useBrand();
  const { role, userId, activeOrg, isPlatformAdmin, isOrgAdmin, loading: roleLoading } = useRole() || { loading: true };
  const supabase = createClient();

  const isAdmin = role === "full_admin" || isPlatformAdmin || isOrgAdmin;

  const load = async () => {
    const orgId = activeOrg?.id;

    // Load own brands
    let brandsQuery = supabase
      .from("brands")
      .select("*")
      .eq("is_active", true)
      .order("updated_at", { ascending: false });

    if (orgId) brandsQuery = brandsQuery.eq("organization_id", orgId);

    const { data: brandsData } = await brandsQuery;

    // Separate own brands from competitors
    const ownBrands = (brandsData || []).filter(b => b.proximity === "own_brand");
    setBrands(ownBrands);

    // Count cases per brand
    const { data: entries } = await supabase
      .from("creative_source")
      .select("brand_id, created_at")
      .order("created_at", { ascending: false });

    const counts = {};
    (entries || []).forEach(e => {
      if (e.brand_id) counts[e.brand_id] = (counts[e.brand_id] || 0) + 1;
    });
    setCaseCounts(counts);

    // Recent entries
    setRecentEntries((entries || []).slice(0, 8));

    setLoading(false);
  };

  useEffect(() => {
    if (roleLoading) return;
    if (role && userId) load();
    else if (!role) { setBrands([]); setLoading(false); }
  }, [role, userId, roleLoading, activeOrg]);

  // Auto-enter for clients/viewers with a single brand
  useEffect(() => {
    if ((role === "client" || role === "viewer") && brands.length === 1 && !loading) {
      selectBrand(brands[0].id, brands[0].name);
      router.replace("/audit");
    }
  }, [role, brands, loading]);

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

  const createBrand = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    const { data: { session } } = await supabase.auth.getSession();
    const orgId = activeOrg?.id;

    // Create brand
    const { data: newBrand, error } = await supabase.from("brands").insert({
      organization_id: orgId,
      name: newName.trim(),
      display_name: newName.trim(),
      scope: "local",
      category: newCategory.trim() || null,
      market: newMarket.trim() || null,
      proximity: "own_brand",
      source: "manual",
      is_active: true,
    }).select().single();

    if (error) { alert("Error: " + error.message); setCreating(false); return; }

    // Create essential framework
    if (newBrand) {
      await supabase.from("brand_frameworks").insert({
        brand_id: newBrand.id,
        tier: "essential",
        language: "English",
      });
    }

    setNewName("");
    setNewCategory("");
    setNewMarket("");
    setCreating(false);
    load();
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
  };

  const timeAgo = (d) => {
    if (!d) return "";
    const diff = Date.now() - new Date(d).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
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
              <p className="text-[10px] text-white/40">{activeOrg?.name || "Select a brand to continue"}</p>
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
          {/* Welcome */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-main">Your Brands</h1>
            <p className="text-sm text-muted mt-1">Select a brand to start working, or add a new one.</p>
          </div>

          {/* Add Brand */}
          {isAdmin && (
            <div className="mb-6 flex gap-3">
              <button onClick={() => router.push("/onboarding")}
                className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-semibold hover:opacity-90">
                + New Brand
              </button>
              {creating ? (
                <div className="flex gap-2 items-center">
                  <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Brand name"
                    className="px-3 py-2 bg-surface border border-main rounded-lg text-sm text-main focus:outline-none focus:border-accent" />
                  <input value={newCategory} onChange={e => setNewCategory(e.target.value)} placeholder="Category"
                    className="px-3 py-2 bg-surface border border-main rounded-lg text-sm text-main focus:outline-none focus:border-accent w-32" />
                  <button onClick={createBrand} disabled={!newName.trim()}
                    className="px-3 py-2 bg-accent text-white rounded-lg text-xs font-semibold disabled:opacity-50">Create</button>
                  <button onClick={() => setCreating(false)} className="text-xs text-muted">Cancel</button>
                </div>
              ) : (
                <button onClick={() => setCreating(true)}
                  className="px-3 py-2 border border-main rounded-lg text-xs text-muted hover:text-main hover:bg-surface2 transition">
                  Quick create
                </button>
              )}
            </div>
          )}

          {/* Brand Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
            {brands.map(b => (
              <div key={b.id} onClick={() => enterBrand(b)}
                className="bg-surface border border-main rounded-xl p-5 cursor-pointer hover:border-accent transition group">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-base font-bold text-main group-hover:text-accent transition">{b.display_name || b.name}</h3>
                    {b.category && <p className="text-xs text-muted mt-0.5">{b.category}</p>}
                  </div>
                  {b.proximity === "own_brand" && (
                    <span className="text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded-full bg-accent/10 text-accent">Own brand</span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-hint">
                  <span>{caseCounts[b.id] || 0} cases</span>
                  {b.market && <span>· {b.market}</span>}
                  {b.updated_at && <span>· {timeAgo(b.updated_at)}</span>}
                </div>
              </div>
            ))}
          </div>

          {brands.length === 0 && !creating && (
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
                    <span className="text-muted">{e.brand_name || "Unknown"}</span>
                    <span className="text-hint">·</span>
                    <span className="text-main truncate">{e.description || "Entry"}</span>
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
