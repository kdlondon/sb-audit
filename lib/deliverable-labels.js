// Fixed labels rendered INSIDE client-facing deliverables (the generated report,
// showcase, exports). Unlike app chrome — which is always English — these follow the
// PROJECT language (framework.language) so a Spanish project hands the client a fully
// Spanish document, a French project a French one, etc.
//
// AI-generated content (titles, summaries, insights, recommendations) is already produced
// in the project language by the API routes; this dictionary only covers the static
// scaffolding labels the frontend prints around that content.

const DICT = {
  English: {
    execSummary: "Executive summary",
    territoryMap: "Territory map",
    keyInsights: "Key insights",
    recommendations: "Recommendations",
    brands: "brands",
    analyzedContent: "analyzed content",
    types: { white_space: "White space", differential: "Differential", engagement: "Engagement", timing: "Timing", creative: "Creative", strategic: "Strategic" },
  },
  Spanish: {
    execSummary: "Resumen ejecutivo",
    territoryMap: "Mapa de territorios",
    keyInsights: "Insights clave",
    recommendations: "Recomendaciones",
    brands: "marcas",
    analyzedContent: "contenidos analizados",
    types: { white_space: "Espacio libre", differential: "Diferencial", engagement: "Engagement", timing: "Timing", creative: "Creativo", strategic: "Estratégico" },
  },
  French: {
    execSummary: "Résumé exécutif",
    territoryMap: "Carte des territoires",
    keyInsights: "Insights clés",
    recommendations: "Recommandations",
    brands: "marques",
    analyzedContent: "contenus analysés",
    types: { white_space: "Espace libre", differential: "Différentiel", engagement: "Engagement", timing: "Timing", creative: "Créatif", strategic: "Stratégique" },
  },
  Portuguese: {
    execSummary: "Resumo executivo",
    territoryMap: "Mapa de territórios",
    keyInsights: "Insights principais",
    recommendations: "Recomendações",
    brands: "marcas",
    analyzedContent: "conteúdos analisados",
    types: { white_space: "Espaço livre", differential: "Diferencial", engagement: "Engagement", timing: "Timing", creative: "Criativo", strategic: "Estratégico" },
  },
  Italian: {
    execSummary: "Sintesi esecutiva",
    territoryMap: "Mappa dei territori",
    keyInsights: "Insight chiave",
    recommendations: "Raccomandazioni",
    brands: "brand",
    analyzedContent: "contenuti analizzati",
    types: { white_space: "Spazio libero", differential: "Differenziale", engagement: "Engagement", timing: "Timing", creative: "Creativo", strategic: "Strategico" },
  },
};

export function deliverableLabels(lang) {
  return DICT[lang] || DICT.English;
}
