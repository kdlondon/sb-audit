// Canonical, language-neutral taxonomy values for GLOBAL fixed enums (shared across all
// projects). The DB stores the canonical key (e.g. "conversion"); the UI and deliverables
// translate it to the project language via the label dictionaries below.
//
// Open / project-scoped vocabularies (content pillars, sub-pillars) are NOT here — those are
// emergent per project and the AI already produces them in the project language.

export const POST_OBJECTIVE_KEYS = ["awareness", "engagement", "conversion", "community"];

const POST_OBJECTIVE_LABELS = {
  English:    { awareness: "Awareness",      engagement: "Engagement", conversion: "Conversion",  community: "Community" },
  Spanish:    { awareness: "Awareness",      engagement: "Engagement", conversion: "Conversión",  community: "Comunidad" },
  French:     { awareness: "Notoriété",      engagement: "Engagement", conversion: "Conversion",  community: "Communauté" },
  Portuguese: { awareness: "Reconhecimento", engagement: "Engajamento", conversion: "Conversão", community: "Comunidade" },
  Italian:    { awareness: "Notorietà",      engagement: "Engagement", conversion: "Conversione", community: "Comunità" },
};

const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z]/g, "");

// Map any legacy/display value (any supported language) back to its canonical key.
const OBJECTIVE_ALIAS = {
  awareness: "awareness", notoriete: "awareness", notorieta: "awareness", reconhecimento: "awareness",
  engagement: "engagement", engajamento: "engagement",
  conversion: "conversion", conversao: "conversion", conversione: "conversion",
  community: "community", comunidad: "community", comunidade: "community", communaute: "community", comunita: "community",
};

// Resolve any stored/display value to the canonical key (resilient to legacy Spanish/English rows).
export function canonObjective(value) {
  if (!value) return "";
  const n = norm(value);
  return OBJECTIVE_ALIAS[n] || (POST_OBJECTIVE_KEYS.includes(n) ? n : value);
}

// Canonical key -> label in the given project language.
export function objectiveLabel(value, lang) {
  const k = canonObjective(value);
  const dict = POST_OBJECTIVE_LABELS[lang] || POST_OBJECTIVE_LABELS.English;
  return dict[k] || value || "";
}

// [{value: canonicalKey, label: localizedLabel}] for building a <select> in the project language.
export function objectiveOptions(lang) {
  const dict = POST_OBJECTIVE_LABELS[lang] || POST_OBJECTIVE_LABELS.English;
  return POST_OBJECTIVE_KEYS.map((k) => ({ value: k, label: dict[k] }));
}
