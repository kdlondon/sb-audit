// Citations in report bodies are `[label](cite:ID)` (or the legacy `[label](__cite__ID)`
// and `[ENTRY:ID]`). Inside Groundwork these open the entry in a side panel — they are NOT
// real URLs, so a downloaded file's case links go nowhere.
//
// On export we rewrite them to an absolute, auth-gated case URL so the deliverable stays
// navigable: clicking a case in a downloaded PDF/MD/DOC sends the reader to Groundwork,
// which asks for login and then shows the piece.

export const SITE_ORIGIN = "https://groundwork.kad.london";
export const caseUrl = (id, origin = SITE_ORIGIN) => `${origin}/case/${encodeURIComponent(String(id))}`;

// Rewrite every citation form in a markdown string to an absolute case URL.
export function citationsToUrls(markdown, origin = SITE_ORIGIN) {
  if (!markdown) return markdown;
  return String(markdown)
    // [label](cite:ID) and [label](__cite__ID)
    .replace(/\]\((?:cite:|__cite__)([^)]+)\)/g, (_m, id) => `](${caseUrl(id.trim(), origin)})`)
    // bare [ENTRY:ID] with no label → a linked short ref
    .replace(/\[ENTRY:([^\]]+)\]/g, (_m, id) => `[case](${caseUrl(id.trim(), origin)})`);
}

// Strip citations entirely (e.g. plain-text contexts where a link makes no sense).
export function stripCitations(markdown) {
  if (!markdown) return markdown;
  return String(markdown)
    .replace(/\[([^\]]+)\]\((?:cite:|__cite__)[^)]+\)/g, "$1")
    .replace(/\[ENTRY:[^\]]+\]/g, "");
}
