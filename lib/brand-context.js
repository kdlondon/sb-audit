"use client";
import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase";

const BrandContext = createContext(null);

export function BrandProvider({ children }) {
  const [brandId, setBrandId] = useState(null);
  const [brandName, setBrandName] = useState("");
  const [brand, setBrand] = useState(null);
  const [ready, setReady] = useState(false);

  // Also store the projectId separately for data queries
  // brandId is for framework/nav context, projectId is for data queries
  const [projectId, setProjectId] = useState(null);
  const [projectName, setProjectName] = useState("");

  useEffect(() => {
    // Restore both brand and project from localStorage
    const storedBrand = localStorage.getItem("gw-active-brand");
    const storedBrandName = localStorage.getItem("gw-active-brand-name");
    const storedProject = localStorage.getItem("sb-project-id");
    const storedProjectName = localStorage.getItem("sb-project-name");

    if (storedBrand) {
      setBrandId(storedBrand);
      setBrandName(storedBrandName || "");
      loadBrand(storedBrand);
    }
    // Always restore projectId if available (needed for data queries)
    if (storedProject) {
      setProjectId(storedProject);
      setProjectName(storedProjectName || "");
    }
    // If we have a brand but no project, use brand as fallback
    if (storedBrand && !storedProject) {
      setProjectId(storedBrand);
      setProjectName(storedBrandName || "");
    }
    // If we have a project but no brand, use project as fallback
    if (!storedBrand && storedProject) {
      setBrandId(storedProject);
      setBrandName(storedProjectName || "");
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

  const selectBrand = useCallback((id, name, projId) => {
    setBrandId(id);
    setBrandName(name || "");
    localStorage.setItem("gw-active-brand", id);
    localStorage.setItem("gw-active-brand-name", name || "");
    loadBrand(id);
    // If a projectId is provided, keep it for data queries
    if (projId) {
      setProjectId(projId);
      setProjectName(name || "");
      localStorage.setItem("sb-project-id", projId);
      localStorage.setItem("sb-project-name", name || "");
    }
  }, [loadBrand]);

  const selectProject = useCallback((id, name) => {
    setProjectId(id);
    setProjectName(name || "");
    localStorage.setItem("sb-project-id", id);
    localStorage.setItem("sb-project-name", name || "");
    // Also set as brand fallback
    if (!brandId) {
      setBrandId(id);
      setBrandName(name || "");
      localStorage.setItem("gw-active-brand", id);
      localStorage.setItem("gw-active-brand-name", name || "");
    }
  }, [brandId]);

  const clearBrand = useCallback(() => {
    setBrandId(null);
    setBrandName("");
    setBrand(null);
    setProjectId(null);
    setProjectName("");
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
