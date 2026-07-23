// Centralized Claude model ids. One place to bump "the most capable model available".
// Scoped by purpose so we don't raise cost on every call site at once.
//
// Migration note: 16 call sites still hardcode "claude-sonnet-4-6". They can move onto
// these constants incrementally — start with report generation, which is where the
// deepest analysis (and the strongest model) matters most.

export const MODELS = {
  // Deep report generation — the client-facing deliverable. Most capable available.
  report: "claude-opus-4-8",
  // General analysis / enrichment (analyze, insights, brand-dna).
  analyze: "claude-sonnet-4-6",
  // Cheap, high-frequency helpers (copilot, suggestions, scout ranking).
  fast: "claude-sonnet-4-6",
};

// Back-compat default for existing call sites that just want "the model".
export const DEFAULT_MODEL = MODELS.analyze;
