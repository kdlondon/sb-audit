// Per-section generation orchestrator (B9). The report routes already accept a single
// `section` param, so the client drives generation section-by-section: one request each,
// persist as it goes, report real progress ("3 of 6"). Mid-run failure keeps what landed.
//
// This wraps the EXISTING routes — no engine change. It is transport-agnostic: pass a
// `postSection` that performs one request, and a `saveDoc` that persists the growing doc.
//
//   await generateReport({
//     card, config,               // from REPORT_CARDS + the Configure screen
//     postSection,                // (sectionKey, { priorSections }) => { key, title, markdown }
//     saveDoc,                    // (blocksDoc, doneKeys) => Promise   (incremental persist)
//     onProgress,                 // ({ done, total, current, status }) => void
//   })

import { makeBlock, markdownToBlocks } from "./report-blocks";

// Order the section keys for generation. Synthesis sections (exec, recommendations) need the
// analytical ones written first, so they always go LAST regardless of display order.
const SYNTHESIS = new Set(["exec", "recommendations", "plays", "takeaways"]);

export function generationOrder(card, config) {
  const chosen = (config?.sections || card.sections)
    .filter((s) => s.on !== false)
    .map((s) => s.key);
  const analytical = chosen.filter((k) => !SYNTHESIS.has(k));
  const synthesis = chosen.filter((k) => SYNTHESIS.has(k));
  return { analytical, synthesis, all: [...analytical, ...synthesis] };
}

// Turn one route section result into ordered blocks (h2 heading + body blocks), tagged with
// the section key so the whole section can later be replaced on regenerate.
export function sectionToBlocks(section) {
  const blocks = [];
  if (section.title) blocks.push(makeBlock("h2", { sectionKey: section.key, text: section.title }));
  blocks.push(...markdownToBlocks(section.markdown || "", section.key));
  return blocks;
}

// Assemble the full document in the config's display order from the produced sections.
export function assembleDoc(card, config, produced) {
  const order = (config?.sections || card.sections).filter((s) => s.on !== false).map((s) => s.key);
  const byKey = Object.fromEntries(produced.map((s) => [s.key, s]));
  const blocks = [];
  for (const key of order) if (byKey[key]) blocks.push(...sectionToBlocks(byKey[key]));
  return { v: 2, blocks };
}

export async function generateReport({ card, config, postSection, saveDoc, onProgress } = {}) {
  const { all } = generationOrder(card, config);
  const total = all.length;
  const produced = [];
  const failed = [];

  for (let i = 0; i < all.length; i++) {
    const key = all[i];
    onProgress?.({ done: produced.length, total, current: key, status: "generating" });
    try {
      // Synthesis sections get the analytical ones written so far as context.
      const priorSections = produced.filter((s) => !SYNTHESIS.has(s.key));
      const section = await postSection(key, { priorSections });
      if (section && section.markdown != null) {
        produced.push({ key, title: section.title, markdown: section.markdown });
        // Persist incrementally: whatever is done survives a later failure.
        if (saveDoc) await saveDoc(assembleDoc(card, config, produced), produced.map((s) => s.key));
        onProgress?.({ done: produced.length, total, current: key, status: "done" });
      } else {
        failed.push(key);
        onProgress?.({ done: produced.length, total, current: key, status: "empty" });
      }
    } catch (err) {
      failed.push(key);
      onProgress?.({ done: produced.length, total, current: key, status: "error", error: err?.message });
      // Keep going — a mid-run failure must not discard the sections already produced.
    }
  }

  return { doc: assembleDoc(card, config, produced), produced, failed, complete: failed.length === 0 };
}
