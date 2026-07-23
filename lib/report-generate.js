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
  // The engine writes its own heading in the project's language as the first line of the
  // markdown. Prefer it over the card's English label — otherwise the document shows both
  // ("Category landscape" then "Paisaje de categoría"). Fall back to the label when the
  // model didn't write one.
  const md = section.markdown || "";
  const lead = md.match(/^\s*#{1,3}\s+(.+?)\s*$/m);
  const leadIsFirst = lead && md.slice(0, lead.index).trim() === "";
  const title = (leadIsFirst && lead[1]) || section.title;
  const body = leadIsFirst ? md.slice(lead.index + lead[0].length) : md;
  if (title) blocks.push(makeBlock("h2", { sectionKey: section.key, text: title }));
  // Visuals sit between the heading and the prose, per the design: numeral + heading +
  // visual + text. They arrive from the engine already computed from real stats.
  for (const v of section.visuals || []) if (v && v.type) blocks.push({ ...v, sectionKey: section.key });
  blocks.push(...markdownToBlocks(body, section.key));
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
  const { analytical, synthesis } = generationOrder(card, config);
  const total = analytical.length + synthesis.length;
  const produced = [];
  const failed = [];
  const errors = {};

  // Saves are serialized even though generation is parallel, so two sections landing at
  // once can't race each other's write.
  let saveChain = Promise.resolve();
  let saveError = null;
  const persist = () => {
    if (!saveDoc) return;
    saveChain = saveChain
      .then(() => saveDoc(assembleDoc(card, config, produced), produced.map((s) => s.key)))
      // Record rather than swallow: a run that says "5 of 6 written" while nothing was
      // persisted is the worst possible outcome — it looks like success.
      .catch((e) => { saveError = saveError || (e?.message || "Could not save"); });
    return saveChain;
  };

  // Transient upstream failures (rate limit / overloaded / gateway) are worth one or two
  // retries with backoff — running the sections concurrently makes them more likely, and
  // losing a whole section to a momentary 429 is the difference between a usable report
  // and the partial one that prompted this.
  const TRANSIENT = /429|rate.?limit|overloaded|529|503|502|504|timeout|ECONN|failed to fetch|network|aborted|could not load entries/i;
  const attempt = async (key, priorSections, tries = 3) => {
    let lastErr;
    for (let i = 0; i < tries; i++) {
      try { return await postSection(key, { priorSections }); }
      catch (e) {
        lastErr = e;
        if (!TRANSIENT.test(e?.message || "") || i === tries - 1) throw e;
        await new Promise((r) => setTimeout(r, 4000 * Math.pow(2, i)));
      }
    }
    throw lastErr;
  };

  const runOne = async (key, priorSections) => {
    onProgress?.({ done: produced.length, total, current: key, status: "generating" });
    try {
      const section = await attempt(key, priorSections);
      if (section && section.markdown != null) {
        produced.push({ key, title: section.title, markdown: section.markdown, visuals: section.visuals || [] });
        persist();
        onProgress?.({ done: produced.length, total, current: key, status: "done" });
      } else {
        failed.push(key); errors[key] = "Empty response";
        onProgress?.({ done: produced.length, total, current: key, status: "empty" });
      }
    } catch (err) {
      failed.push(key); errors[key] = err?.message || "Failed";
      onProgress?.({ done: produced.length, total, current: key, status: "error", error: errors[key] });
      // Keep going — one failure must not discard the sections that landed.
    }
  };

  // Bounded concurrency. Fully sequential turned a ~50s report into minutes; fully
  // unbounded fires every section's model call at once and invites rate limiting. Two at a
  // time keeps it fast while staying well inside upstream limits.
  const CONCURRENCY = 2;
  const pool = async (keys, prior) => {
    let i = 0;
    const worker = async () => { while (i < keys.length) { const k = keys[i++]; await runOne(k, prior); } };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, keys.length) }, worker));
  };

  // PASS 1 — the analytical sections (independent of each other).
  await pool(analytical, []);

  // PASS 2 — synthesis sections, which need the analytical prose as context.
  if (synthesis.length) await pool(synthesis, produced.filter((s) => !SYNTHESIS.has(s.key)));

  await saveChain;
  return { doc: assembleDoc(card, config, produced), produced, failed, errors, saveError, complete: failed.length === 0 && !saveError };
}
