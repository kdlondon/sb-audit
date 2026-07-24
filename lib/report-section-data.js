// A section can return STRUCTURED DATA alongside its prose, for the chart that sits next to
// it. It does that by appending a fenced ```json block, which is parsed out here and stripped
// from the text the analyst reads.
//
// This exists because some visuals cannot be measured. A white space has no captured pieces
// by definition — if nobody works a territory, there is nothing to count — so the only honest
// source for it is the analysis itself. Anything that CAN be counted is still computed from
// the data and never asked of the model.

// Every section opens with a one-line lead — a sentence about THIS report's finding, not a
// generic description of the section. The engine writes it on its own first line and it is
// lifted out here, so it never appears twice in the prose.
export function extractLead(markdown) {
  const md = String(markdown || "");
  const m = /^\s*LEAD:\s*(.+?)\s*$/mi.exec(md);
  if (!m) return { markdown: md, lead: null };
  const lead = m[1].replace(/^["“']|["”']$/g, "").trim();
  return { markdown: (md.slice(0, m.index) + md.slice(m.index + m[0].length)).trim(), lead: lead || null };
}

export const LEAD_RULE = `\n\nBegin your answer with a single line in this exact form:\nLEAD: <one sentence, max 20 words, stating what this section FOUND — not what the section is about>\nThen a blank line, then the section itself.`;

export function extractSectionData(markdown) {
  const md = String(markdown || "");
  const m = /```json\s*([\s\S]*?)```/i.exec(md);
  if (!m) return { markdown: md, data: null };
  let data = null;
  try { data = JSON.parse(m[1].trim()); } catch { data = null; }
  return { markdown: (md.slice(0, m.index) + md.slice(m.index + m[0].length)).trim(), data };
}

// Instruction appended to a section prompt so the model returns its own structured payload.
// `shape` is a one-line example; `rule` says what to include.
export const dataInstruction = (shape, rule) =>
  `\n\nAFTER the prose, append a fenced \`\`\`json block so this section can be charted:\n${shape}\n${rule}`;
