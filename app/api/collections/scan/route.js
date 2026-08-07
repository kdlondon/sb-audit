// Smart Collections — the detection engine.
//
// A manual, analyst-pushed scan (never auto-run). It reads the project's Creative
// Source, asks the model to group pieces by MEANING — shared territory, a recurring
// IP/concept, or a repeated message — and proposes the strong ones as collections in
// state='suggested'. It never creates a real collection; the analyst approves or
// dismisses downstream.
//
// Two realities this route is built around (see docs/BRIEF_smart_collections.md):
//   1. Detection is semantic, not by exact field match — a GROUP BY finds nothing
//      because territories/slogans are near-unique free text. So the model does the
//      grouping, which is why this is one costed AI pass behind an explicit trigger.
//   2. A piece may sit in several clusters at once — clusters are NOT a partition.
//
// Dedup + permanent dismissal ride on a per-cluster `signature` (kind + a stable
// pattern slug the model emits): any signature already present as a collection (any
// state) or in collection_dismissals is skipped, so nothing re-proposes itself.
import { createClient } from "@supabase/supabase-js";
import { loadFramework } from "@/lib/framework-loader";

export const dynamic = "force-dynamic";
export const maxDuration = 120; // a clustering pass over the whole corpus is a long call

// The clustering model. Opus 4.8 by default — the recommendation for the semantic
// grouping — but overridable from the body so it stays swappable (e.g. Sonnet to compare).
const DEFAULT_MODEL = "claude-opus-4-8";

const slug = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);

// Models occasionally wrap JSON in fences or add a stray sentence — pull the object out.
const extractJson = (text) => {
  const f = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = f ? f[1].trim() : (() => { const a = text.indexOf("{"), z = text.lastIndexOf("}"); return a >= 0 && z > a ? text.slice(a, z + 1) : text; })();
  return JSON.parse(raw);
};

const SYSTEM = `You are a senior competitive-intelligence strategist. You are given every marketing/advertising piece captured for one project (its "Creative Source"). Your job is to find the PATTERNS worth a collection — and only the strong ones.

WHAT A PATTERN IS
A valid pattern is a set of at least 4 pieces connected by MEANING, of one of these kinds:
- brand_pattern: a SINGLE brand repeating a concept/territory/message over time (e.g. one brand running a nostalgia line across several months).
- cross_brand: SEVERAL brands converging on the same territory, resource or message (e.g. five brands all leaning on nostalgia this year).
The connection is semantic — a shared territory, a recurring IP/concept/character, or a repeated slogan/message — NOT a coincidence of one shared field value. Read the meaning across description, territory, idea, insight, slogan, intent, archetype and portrait.

BE SELECTIVE — three good proposals beat thirty
Only surface patterns a strategist would genuinely want to look at. Skip weak, generic or thin groupings. It is correct to return few — or none — if nothing strong exists. Aim for at most ~6 of the strongest. Every cluster MUST have 4+ pieces; drop anything with fewer.
A piece may belong to more than one cluster — do not force a partition.

FOR EACH PATTERN
- title: evocative, specific, max ~9 words (e.g. "Five brands betting on nostalgia"), NOT a generic label.
- kind: "brand_pattern" or "cross_brand".
- pattern_key: a short stable slug of the CORE CONCEPT (e.g. "nostalgia-neighbourhood", "iberia-harry-potter"). This is the pattern's identity across scans — base it on the concept, not the member set.
- summary: one line (<=140 chars) describing the pattern and its time range if clear.
- why: one paragraph (3-5 sentences) — the connective tissue and what makes it a pattern, not a coincidence. Concrete, grounded in the pieces. No preamble.
- learnings: 2-4 crisp standalone insight bullets (a shift, a gap, a benchmark, an opportunity) — one sentence each.
- refs: the integer "ref" numbers of the member pieces (>=4), copied exactly from the input.

Each input piece has a numeric "ref". Refer to pieces ONLY by that number.
Return ONLY valid JSON, no markdown, no code fences:
{"clusters":[{"title":"","kind":"cross_brand","pattern_key":"","summary":"","why":"","learnings":["",""],"refs":[1,2,3,4]}]}
If there is no strong pattern, return {"clusters":[]}.`;

export async function POST(request) {
  const { project_id, brand_id, organization_id, created_by, model } = await request.json();
  if (!project_id) return Response.json({ error: "project_id required" }, { status: 400 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!apiKey || !supabaseUrl || !serviceRoleKey) return Response.json({ error: "Server configuration error" }, { status: 500 });

  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const CLUSTER_MODEL = model || DEFAULT_MODEL;

  // 1. The corpus — the project's pieces. select('*') on purpose: the meaningful
  //    fields vary by framework and some live in custom_dimensions, so we read whatever
  //    exists defensively in JS rather than risk a "column does not exist" on select.
  const { data: pieces, error: pErr } = await supabase.from("creative_source")
    .select("*")
    .eq("project_id", project_id);
  if (pErr) return Response.json({ error: pErr.message }, { status: 500 });
  if (!pieces || pieces.length < 4) return Response.json({ suggestions: [], scanned: pieces?.length || 0, reason: "not_enough_pieces" });

  // 2. A scan reflects the CURRENT corpus, so clear prior un-acted suggestions and
  //    regenerate them fresh. Approved collections (state='active') and dismissals are
  //    left untouched — nothing the analyst acted on is lost, and re-scanning is how you
  //    refresh proposals (e.g. after the project's language changed).
  const { data: prior } = await supabase.from("collections").select("id").eq("project_id", project_id).eq("state", "suggested");
  if (prior?.length) {
    const ids = prior.map(r => r.id);
    await supabase.from("collection_entries").delete().in("collection_id", ids);
    await supabase.from("collections").delete().in("id", ids);
  }

  // 3. Signatures to skip: approved collections carrying one + everything ever dismissed.
  //    (Pending suggestions were just cleared above, so they can't block a refresh.)
  const [{ data: existing }, { data: dismissed }] = await Promise.all([
    supabase.from("collections").select("signature").eq("project_id", project_id).not("signature", "is", null),
    supabase.from("collection_dismissals").select("signature").eq("project_id", project_id),
  ]);
  const skip = new Set([...(existing || []).map(r => r.signature), ...(dismissed || []).map(r => r.signature)].filter(Boolean));

  // 3b. Existing collections (approved + manual) — to avoid re-proposing near-duplicates.
  //     Signature dedup only catches EXACT slug matches; the model coins a slightly
  //     different pattern_key each run for the same territory, so the same idea slips
  //     back in under a new name. So we also (a) tell the model what's already covered,
  //     and (b) drop any cluster whose PIECES substantially overlap an existing collection
  //     — content, not title, which is robust to renames.
  const { data: existingCols } = await supabase.from("collections")
    .select("id,name,rationale").eq("project_id", project_id).neq("state", "suggested");
  const existingMembers = []; // [{ name, why, ids:Set<entry_id> }]
  if (existingCols?.length) {
    const { data: allLinks } = await supabase.from("collection_entries")
      .select("collection_id,entry_id").in("collection_id", existingCols.map(c => c.id));
    const byCol = new Map();
    for (const l of (allLinks || [])) {
      if (!byCol.has(l.collection_id)) byCol.set(l.collection_id, new Set());
      byCol.get(l.collection_id).add(l.entry_id);
    }
    for (const c of existingCols) existingMembers.push({ name: c.name || "", why: (c.rationale && c.rationale.why) || "", ids: byCol.get(c.id) || new Set() });
  }
  // A proposed cluster is a near-duplicate when this share of its pieces already sit in
  // one existing collection.
  const OVERLAP_DUPE = 0.6;

  // 3. Compact each piece for the model. It references pieces by a short integer `ref`
  //    (1..N), NOT the raw UUID — models reproduce a 36-char UUID unreliably, which would
  //    silently drop every cluster at validation. We map refs back to real ids afterwards.
  const refToId = new Map();
  const corpus = pieces.map((p, i) => {
    const ref = i + 1;
    refToId.set(ref, p.id);
    const o = {
      ref,
      brand: p.competitor || p.brand_name || p.brand || "—",
      title: p.description || "",
      territory: p.primary_territory || "",
      idea: p.idea || "",
      insight: p.insight || "",
      slogan: p.main_slogan || "",
      intent: p.communication_intent || "",
      archetype: p.brand_archetype || "",
      portrait: p.portrait || "",
      year: p.year || "",
      type: p.type || "",
    };
    // Framework-specific signal often lives in custom_dimensions — flatten its readable
    // leaf values (strings/numbers, incl. one level of nesting) into a compact string.
    if (p.custom_dimensions && typeof p.custom_dimensions === "object") {
      const vals = [];
      const eat = (obj, depth) => {
        for (const v of Object.values(obj)) {
          if (v == null) continue;
          if (typeof v === "string" || typeof v === "number") { const s = String(v).trim(); if (s) vals.push(s); }
          else if (Array.isArray(v)) v.forEach(x => { if (typeof x === "string" || typeof x === "number") { const s = String(x).trim(); if (s) vals.push(s); } });
          else if (typeof v === "object" && depth < 1) eat(v, depth + 1);
        }
      };
      eat(p.custom_dimensions, 0);
      const dims = [...new Set(vals)].join(" · ").slice(0, 500);
      if (dims) o.dims = dims;
    }
    for (const k of Object.keys(o)) if (o[k] === "" || o[k] == null) delete o[k];
    return o;
  });

  // 4. The clustering pass — in the project's configured language (defaults to English).
  let language = "English";
  try { const fw = await loadFramework(project_id, supabase); if (fw?.language) language = fw.language; }
  catch (err) { console.error("scan: framework load failed, defaulting to English", err?.message); }
  // Tell the model what's already been made into a collection, so it doesn't re-propose
  // the same territory under a new name. Titles + a short why are enough to recognise overlap.
  const coveredBlock = existingMembers.length
    ? `\n\nALREADY COVERED — the analyst already has these collections. Do NOT propose these patterns again or close variants of them (same territory / IP / message). Only surface genuinely NEW patterns:\n${existingMembers.map((c, i) => `- ${c.name}${c.why ? ` — ${c.why.slice(0, 160)}` : ""}`).join("\n")}`
    : "";
  const systemWithLang = `${SYSTEM}\n\nWrite ALL output (title, summary, why, learnings) in ${language}, regardless of the source language of the pieces.`;

  let data;
  try {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: CLUSTER_MODEL,
        max_tokens: 8000, // enough headroom that the JSON isn't truncated mid-object
        system: systemWithLang,
        messages: [{ role: "user", content: `Here are the ${corpus.length} pieces in this project's Creative Source. Find the strong patterns (>=4 pieces each).${coveredBlock}\n\n${JSON.stringify(corpus)}` }],
      }),
    });
    data = await resp.json();
    if (!resp.ok) {
      const msg = data?.error?.message || data?.error || `API error (${resp.status})`;
      return Response.json({ error: typeof msg === "string" ? msg : JSON.stringify(msg) }, { status: resp.status });
    }
  } catch (err) {
    console.error("scan fetch error:", err);
    return Response.json({ error: `Couldn't reach the model — ${err.message || "network error"}.` }, { status: 502 });
  }

  // Parse separately so a bad reply reports its real cause (truncation, empty, etc.).
  const text = data.content?.[0]?.text || "";
  const stop = data.stop_reason;
  let parsed;
  try {
    parsed = extractJson(text);
  } catch (err) {
    const truncated = stop === "max_tokens";
    console.error("scan parse error:", err.message, "stop=", stop, "len=", text.length, "head=", text.slice(0, 200));
    return Response.json({
      error: truncated
        ? "The model's reply was cut off (too long). Try again — if it repeats, the corpus may need trimming."
        : `The model didn't return usable JSON (${err.message}).`,
      stop_reason: stop, text_len: text.length, text_head: text.slice(0, 300),
    }, { status: 502 });
  }

  // 5. Validate + write survivors as suggestions.
  const proposed = (parsed?.clusters || []).length;
  const created = [];
  const drops = { below_min: 0, bad_key: 0, dup_signature: 0, overlap_dupe: 0, insert_fail: 0 };
  let insertError = null; // first DB error, surfaced so a write failure isn't opaque
  for (const c of (parsed?.clusters || [])) {
    // Accept refs (new) or entry_ids (in case the model echoes ids) and map to real ids.
    const raw = c.refs || c.entry_ids || [];
    const members = [...new Set(raw.map(r => refToId.get(Number(r))).filter(Boolean))];
    if (members.length < 4) { drops.below_min++; continue; }
    const kind = c.kind === "cross_brand" ? "cross_brand" : "brand_pattern";
    const key = slug(c.pattern_key || c.title);
    if (!key) { drops.bad_key++; continue; }
    const signature = `${kind}:${key}`;
    if (skip.has(signature)) { drops.dup_signature++; continue; }

    // Content-overlap guard: if most of this cluster's pieces already live in one existing
    // collection, it's the same pattern re-dressed — skip it (catches the renamed-repeat).
    const dupe = existingMembers.some(ex => {
      if (!ex.ids.size) return false;
      const shared = members.reduce((n, id) => n + (ex.ids.has(id) ? 1 : 0), 0);
      return shared / members.length >= OVERLAP_DUPE;
    });
    if (dupe) { drops.overlap_dupe++; continue; }

    skip.add(signature); // don't create the same pattern twice within one scan

    const { data: col, error: cErr } = await supabase.from("collections").insert({
      name: c.title || "Untitled pattern",
      description: c.summary || null,
      is_private: false,
      project_id,
      brand_id: brand_id || null,
      organization_id: organization_id || null,
      created_by: created_by || "groundwork",
      state: "suggested",
      origin: "ai",
      kind,
      signature,
      rationale: { why: String(c.why || "").trim(), learnings: Array.isArray(c.learnings) ? c.learnings.map(l => String(l || "").trim()).filter(Boolean) : [] },
    }).select("id").single();
    if (cErr || !col) { console.error("suggestion insert failed:", cErr); if (!insertError && cErr) insertError = `collections: ${cErr.message}`; drops.insert_fail++; continue; }

    const rows = members.map((id, i) => ({ collection_id: col.id, entry_id: id, sort_order: i, added_by: "groundwork" }));
    const { error: eErr } = await supabase.from("collection_entries").insert(rows);
    if (eErr) { // roll back the orphan suggestion rather than leave an empty one
      await supabase.from("collections").delete().eq("id", col.id);
      console.error("suggestion entries insert failed:", eErr); if (!insertError) insertError = `collection_entries: ${eErr.message}`; drops.insert_fail++; continue;
    }
    created.push({ id: col.id, title: c.title, kind, count: members.length });
  }

  const dropped = Object.values(drops).reduce((a, b) => a + b, 0);
  console.log(`scan: project=${project_id} scanned=${pieces.length} proposed=${proposed} created=${created.length} drops=${JSON.stringify(drops)} insertError=${insertError || "-"}`);
  return Response.json({ suggestions: created, scanned: pieces.length, proposed, dropped, drops, insert_error: insertError, model: CLUSTER_MODEL });
}
