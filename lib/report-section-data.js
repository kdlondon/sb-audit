// A section can return STRUCTURED DATA alongside its prose, for the chart that sits next to
// it. It does that by appending a fenced ```json block, which is parsed out here and stripped
// from the text the analyst reads.
//
// This exists because some visuals cannot be measured. A white space has no captured pieces
// by definition — if nobody works a territory, there is nothing to count — so the only honest
// source for it is the analysis itself. Anything that CAN be counted is still computed from
// the data and never asked of the model.

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
