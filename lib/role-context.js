"use client";
import { createContext, useContext, useState, useEffect } from "react";
import { createClient } from "@/lib/supabase";

const RoleContext = createContext(null);

export function RoleProvider({ children }) {
  const [role, setRole] = useState(null);       // 'full_admin' | 'analyst' | 'client'
  const [userEmail, setUserEmail] = useState("");
  const [userId, setUserId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setLoading(false); return; }

      const uid = session.user.id;
      const email = session.user.email;
      setUserId(uid);
      setUserEmail(email);

      // Fetch role
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", uid)
        .single();

      setRole(roleData?.role || null);
      setLoading(false);
    })();
  }, []);

  const refreshRole = async () => {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id)
      .single();
    setRole(data?.role || null);
  };

  return (
    <RoleContext.Provider value={{ role, userEmail, userId, loading, refreshRole }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() { return useContext(RoleContext); }

// Helper: check if user can access a module
export function canAccess(role, module) {
  const permissions = {
    full_admin: ["projects", "audit", "dashboard", "reports", "chat", "showcase", "scout", "settings", "users", "clients"],
    analyst:    ["audit", "dashboard", "reports", "chat", "showcase", "scout"],
    client:     ["showcase"],
  };
  return permissions[role]?.includes(module) || false;
}

// Helper: check if user can edit (not just view) in a module
export function canEdit(role, module) {
  if (role === "full_admin") return true;
  if (role === "analyst" && ["audit", "reports"].includes(module)) return true;
  if (role === "client" && module === "reports") return false; // view only
  return false;
}
