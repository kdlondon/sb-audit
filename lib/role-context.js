"use client";
import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase";

const RoleContext = createContext(null);

export function RoleProvider({ children }) {
  // Legacy fields (backward compat — still exposed to all pages)
  const [role, setRole] = useState(null);
  const [userEmail, setUserEmail] = useState("");
  const [userId, setUserId] = useState(null);
  const [loading, setLoading] = useState(true);

  // New multi-tenant fields
  const [activeOrg, setActiveOrg] = useState(null);     // { id, name, slug, type, plan }
  const [orgRole, setOrgRole] = useState(null);          // platform_admin | org_admin | analyst | viewer
  const [memberships, setMemberships] = useState([]);    // all org memberships
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [isOrgAdmin, setIsOrgAdmin] = useState(false);

  // Map new roles to legacy roles for backward compat
  const toLegacyRole = (newRole) => {
    if (newRole === "platform_admin") return "full_admin";
    if (newRole === "org_admin") return "full_admin";
    if (newRole === "analyst") return "analyst";
    if (newRole === "viewer") return "client";
    return null;
  };

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setLoading(false); return; }

      const uid = session.user.id;
      const email = session.user.email;
      setUserId(uid);
      setUserEmail(email);

      // Try new system first: organization_members
      const { data: members } = await supabase
        .from("organization_members")
        .select("id, organization_id, role, organizations(id, name, slug, type, plan, logo_url)")
        .eq("user_id", uid);

      if (members && members.length > 0) {
        // New system — org-aware
        const allMemberships = members.map(m => ({
          id: m.id,
          orgId: m.organization_id,
          orgName: m.organizations?.name || "",
          orgSlug: m.organizations?.slug || "",
          orgType: m.organizations?.type || "client",
          orgPlan: m.organizations?.plan || "standard",
          orgLogo: m.organizations?.logo_url || "",
          role: m.role,
        }));
        setMemberships(allMemberships);

        // Check if user is platform admin in any org
        const platformMember = allMemberships.find(m => m.role === "platform_admin" && m.orgType === "platform");
        setIsPlatformAdmin(!!platformMember);

        // Restore last active org from localStorage, or pick default
        const savedOrgId = localStorage.getItem("gw-active-org");
        let active = allMemberships.find(m => m.orgId === savedOrgId);
        if (!active) {
          // Default: platform org for platform admins, first client org for others
          active = platformMember || allMemberships[0];
        }

        if (active) {
          setActiveOrg({
            id: active.orgId, name: active.orgName, slug: active.orgSlug,
            type: active.orgType, plan: active.orgPlan, logo: active.orgLogo,
          });
          setOrgRole(active.role);
          setIsOrgAdmin(active.role === "org_admin" || active.role === "platform_admin");
          setRole(toLegacyRole(active.role));
          localStorage.setItem("gw-active-org", active.orgId);
        }
      } else {
        // Fallback to legacy system: user_roles
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", uid)
          .single();

        const legacyRole = roleData?.role || null;
        setRole(legacyRole);

        // Map legacy role to new role for consistency
        if (legacyRole === "full_admin") {
          setIsPlatformAdmin(true);
          setIsOrgAdmin(true);
          setOrgRole("platform_admin");
        } else if (legacyRole === "analyst") {
          setOrgRole("analyst");
        } else if (legacyRole === "client") {
          setOrgRole("viewer");
        }
      }

      setLoading(false);
    })();
  }, []);

  const switchOrg = useCallback((orgId) => {
    const member = memberships.find(m => m.orgId === orgId);
    if (!member) return;
    setActiveOrg({
      id: member.orgId, name: member.orgName, slug: member.orgSlug,
      type: member.orgType, plan: member.orgPlan, logo: member.orgLogo,
    });
    setOrgRole(member.role);
    setIsOrgAdmin(member.role === "org_admin" || member.role === "platform_admin");
    setRole(toLegacyRole(member.role));
    localStorage.setItem("gw-active-org", orgId);
  }, [memberships]);

  const refreshRole = async () => {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data: members } = await supabase
      .from("organization_members")
      .select("id, organization_id, role, organizations(id, name, slug, type, plan)")
      .eq("user_id", session.user.id);

    if (members && members.length > 0) {
      const allMemberships = members.map(m => ({
        id: m.id, orgId: m.organization_id, orgName: m.organizations?.name || "",
        orgSlug: m.organizations?.slug || "", orgType: m.organizations?.type || "client",
        orgPlan: m.organizations?.plan || "standard", role: m.role,
      }));
      setMemberships(allMemberships);
      const current = allMemberships.find(m => m.orgId === activeOrg?.id) || allMemberships[0];
      if (current) {
        setOrgRole(current.role);
        setRole(toLegacyRole(current.role));
        setIsPlatformAdmin(allMemberships.some(m => m.role === "platform_admin" && m.orgType === "platform"));
        setIsOrgAdmin(current.role === "org_admin" || current.role === "platform_admin");
      }
    } else {
      // Fallback
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", session.user.id).single();
      setRole(data?.role || null);
    }
  };

  return (
    <RoleContext.Provider value={{
      // Legacy (backward compat — all existing pages use these)
      role, userEmail, userId, loading, refreshRole,
      // New multi-tenant
      activeOrg, orgRole, memberships, isPlatformAdmin, isOrgAdmin, switchOrg,
    }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() { return useContext(RoleContext); }

// Helper: check if user can access a module (supports both old and new roles)
export function canAccess(role, module) {
  const permissions = {
    full_admin:     ["projects", "audit", "dashboard", "reports", "chat", "showcase", "scout", "settings", "users", "clients"],
    platform_admin: ["projects", "audit", "dashboard", "reports", "chat", "showcase", "scout", "settings", "users", "clients"],
    org_admin:      ["projects", "audit", "dashboard", "reports", "chat", "showcase", "scout", "settings", "users"],
    analyst:        ["audit", "dashboard", "reports", "chat", "showcase", "scout"],
    client:         ["showcase"],
    viewer:         ["showcase"],
  };
  return permissions[role]?.includes(module) || false;
}

// Helper: check if user can edit (not just view) in a module
export function canEdit(role, module) {
  if (role === "full_admin" || role === "platform_admin" || role === "org_admin") return true;
  if (role === "analyst" && ["audit", "reports"].includes(module)) return true;
  return false;
}
