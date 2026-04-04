"use client";
import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useProject } from "@/lib/project-context";
import { createClient } from "@/lib/supabase";

const FrameworkContext = createContext(null);

// Default framework shape for when no framework is loaded
const DEFAULT_FRAMEWORK = {
  tier: "essential",
  brandName: null,
  brandDescription: null,
  brandPositioning: null,
  brandDifferentiator: null,
  brandAudience: null,
  brandTone: null,
  industry: null,
  subCategory: null,
  primaryMarket: null,
  globalMarkets: [],
  language: "English",
  secondaryLanguage: null,
  objectives: [],
  dimensions: [],
  frameworkText: "",
  brandCategories: ["Other"],
  communicationIntents: ["Brand Hero", "Brand Tactical", "Client Testimonials", "Product", "Innovation"],
  standardDimensions: ["archetype", "tone", "execution", "funnel", "rating"],
  localCompetitors: [],
  globalBenchmarks: [],
};

export function FrameworkProvider({ children }) {
  const { brandId, projectId } = useProject();
  const [framework, setFramework] = useState(null);
  const [loading, setLoading] = useState(false);

  const loadFramework = useCallback(async (bid) => {
    if (!bid) {
      setFramework(null);
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();

      // Try brand_frameworks first (new system)
      let { data, error } = await supabase
        .from("brand_frameworks")
        .select("*")
        .eq("brand_id", bid)
        .single();

      // Fallback to project_frameworks (old system)
      if ((error || !data) && projectId) {
        const pf = await supabase
          .from("project_frameworks")
          .select("*")
          .eq("project_id", projectId)
          .single();
        data = pf.data;
        error = pf.error;
      }

      if (error || !data) {
        setFramework(null);
        setLoading(false);
        return;
      }

      setFramework({
        id: data.id,
        projectId: data.project_id,
        name: data.name,
        tier: data.tier || "essential",
        brandName: data.brand_name,
        brandDescription: data.brand_description,
        brandPositioning: data.brand_positioning,
        brandDifferentiator: data.brand_differentiator,
        brandAudience: data.brand_audience,
        brandTone: data.brand_tone,
        industry: data.industry,
        subCategory: data.sub_category,
        primaryMarket: data.primary_market,
        globalMarkets: data.global_markets || [],
        language: data.language || "English",
        secondaryLanguage: data.secondary_language,
        objectives: data.objectives || [],
        specificQuestions: data.specific_questions,
        reportingFrequency: data.reporting_frequency,
        logoUrl: data.logo_url,
        yearsInMarket: data.years_in_market,
        dimensions: data.dimensions || [],
        frameworkText: data.framework_text || "",
        brandCategories: data.brand_categories || ["Other"],
        communicationIntents: data.communication_intents || ["Brand Hero", "Brand Tactical", "Client Testimonials", "Product", "Innovation"],
        standardDimensions: data.standard_dimensions || ["archetype", "tone", "execution", "funnel", "rating"],
        localCompetitors: data.local_competitors || [],
        globalBenchmarks: data.global_benchmarks || [],
      });
    } catch (err) {
      console.error("Failed to load framework:", err);
      setFramework(null);
    }
    setLoading(false);
  }, []);

  // Reload framework when brand changes
  useEffect(() => {
    loadFramework(brandId || projectId);
  }, [brandId, projectId, loadFramework]);

  // Helper: does the framework have a specific dimension?
  const hasDimension = useCallback((key) => {
    return framework?.dimensions?.some(d => d.key === key) || false;
  }, [framework]);

  // Helper: get dimension values
  const getDimensionValues = useCallback((key) => {
    const dim = framework?.dimensions?.find(d => d.key === key);
    return dim?.values || [];
  }, [framework]);

  // Helper: is a standard dimension active?
  const isStandardDimActive = useCallback((key) => {
    if (!framework) return true; // No framework = show all (backward compat)
    return framework.standardDimensions?.includes(key) || false;
  }, [framework]);

  // Refresh framework from DB
  const refreshFramework = useCallback(() => {
    const id = brandId || projectId;
    if (id) loadFramework(id);
  }, [brandId, projectId, loadFramework]);

  return (
    <FrameworkContext.Provider value={{
      framework: framework || DEFAULT_FRAMEWORK,
      frameworkLoaded: !!framework,
      frameworkLoading: loading,
      hasDimension,
      getDimensionValues,
      isStandardDimActive,
      refreshFramework,
    }}>
      {children}
    </FrameworkContext.Provider>
  );
}

export function useFramework() {
  return useContext(FrameworkContext);
}
