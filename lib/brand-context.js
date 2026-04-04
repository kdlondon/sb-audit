"use client";
import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase";

const BrandContext = createContext(null);

export function BrandProvider({ children }) {
  const [brandId, setBrandId] = useState(null);
  const [brandName, setBrandName] = useState("");
  const [brand, setBrand] = useState(null);
  const [ready, setReady] = useState(false);

  // Also expose as projectId/projectName for backward compat during transition
  const projectId = brandId;
  const projectName = brandName;

  useEffect(() => {
    // Try new keys first, fall back to old project keys
    const storedBrand = localStorage.getItem("gw-active-brand");
    const storedBrandName = localStorage.getItem("gw-active-brand-name");
    const storedProject = localStorage.getItem("sb-project-id");
    const storedProjectName = localStorage.getItem("sb-project-name");

    if (storedBrand) {
      setBrandId(storedBrand);
      setBrandName(storedBrandName || "");
      loadBrand(storedBrand);
    } else if (storedProject) {
      // Backward compat: old project key exists, migrate it
      setBrandId(storedProject);
      setBrandName(storedProjectName || "");
      // Try to find the brand for this project
      migrateBrandFromProject(storedProject, storedProjectName || "");
    }
    setReady(true);
  }, []);

  const loadBrand = useCallback(async (id) => {
    const supabase = createClient();
    const { data } = await supabase.from("brands").select("*").eq("id", id).single();
    if (data) setBrand(data);
  }, []);

  const migrateBrandFromProject = useCallback(async (projId, projName) => {
    // Find the brand_id from creative_source or project_frameworks
    const supabase = createClient();

    // Try project_frameworks first (has brand_name)
    const { data: pf } = await supabase
      .from("project_frameworks")
      .select("brand_name")
      .eq("project_id", projId)
      .single();

    if (pf?.brand_name) {
      // Find the brand
      const { data: proj } = await supabase.from("projects").select("organization_id").eq("id", projId).single();
      if (proj?.organization_id) {
        const { data: b } = await supabase
          .from("brands")
          .select("*")
          .eq("organization_id", proj.organization_id)
          .ilike("name", pf.brand_name)
          .eq("proximity", "own_brand")
          .single();
        if (b) {
          setBrandId(b.id);
          setBrandName(b.name);
          setBrand(b);
          localStorage.setItem("gw-active-brand", b.id);
          localStorage.setItem("gw-active-brand-name", b.name);
          return;
        }
      }
    }
    // If no match, just keep the project id as brand id for now
    localStorage.setItem("gw-active-brand", projId);
    localStorage.setItem("gw-active-brand-name", projName);
  }, []);

  const selectBrand = useCallback((id, name) => {
    setBrandId(id);
    setBrandName(name || "");
    localStorage.setItem("gw-active-brand", id);
    localStorage.setItem("gw-active-brand-name", name || "");
    // Clear old project keys
    localStorage.removeItem("sb-project-id");
    localStorage.removeItem("sb-project-name");
    loadBrand(id);
  }, [loadBrand]);

  // Backward compat: selectProject just calls selectBrand
  const selectProject = selectBrand;

  const clearBrand = useCallback(() => {
    setBrandId(null);
    setBrandName("");
    setBrand(null);
    localStorage.removeItem("gw-active-brand");
    localStorage.removeItem("gw-active-brand-name");
    localStorage.removeItem("sb-project-id");
    localStorage.removeItem("sb-project-name");
  }, []);

  const clearProject = clearBrand;

  return (
    <BrandContext.Provider value={{
      // New brand-centric API
      brandId, brandName, brand, ready,
      selectBrand, clearBrand,
      // Backward compat — same values, old names
      projectId, projectName,
      selectProject, clearProject,
    }}>
      {children}
    </BrandContext.Provider>
  );
}

export function useBrand() { return useContext(BrandContext); }

// Backward compat export — useProject returns the same context
export function useProject() { return useContext(BrandContext); }
