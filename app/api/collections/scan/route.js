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
- entry_ids: the ids of the member pieces (>=4), exactly as given in the input.

Write ALL output in English regardless of the source language.
Return ONLY valid JSON, no markdown, no code fences:
{"clusters":[{"title":"","kind":"cross_brand","pattern_key":"","summary":"","why":"","learnings":["",""],"entry_ids":["",""]}]}
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

  // 2. Signatures to skip: any collection already carrying one (suggested OR approved
  //    OR the original manual ones, which have none) + everything ever dismissed.
  const [{ data: existing }, { data: dismissed }] = await Promise.all([
    supabase.from("collections").select("signature").eq("project_id", project_id).not("signature", "is", null),
    supabase.from("collection_dismissals").select("signature").eq("project_id", project_id),
  ]);
  const skip = new Set([...(existing || []).map(r => r.signature), ...(dismissed || []).map(r => r.signature)].filter(Boolean));

  // 3. Compact each piece for the model (drop empty fields to save tokens).
  const corpus = pieces.map(p => {
    const o = {
      id: p.id,
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

  // 4. The clustering pass.
  let parsed;
  try {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: CLUSTER_MODEL,
        max_tokens: 4000,
        system: SYSTEM,
        messages: [{ role: "user", content: `Here are the ${corpus.length} pieces in this project's Creative Source. Find the strong patterns (>=4 pieces each).\n\n${JSON.stringify(corpus)}` }],
      }),
    });
    const data = await resp.json();
    if (!resp.ok) {
      const msg = data?.error?.message || data?.error || `API error (${resp.status})`;
      return Response.json({ error: typeof msg === "string" ? msg : JSON.stringify(msg) }, { status: resp.status });
    }
    parsed = extractJson(data.content?.[0]?.text || "");
  } catch (err) {
    console.error("scan clustering error:", err);
    return Response.json({ error: "The scan couldn't be completed. Try again." }, { status: 502 });
  }

  // 5. Validate + write survivors as suggestions.
  const validIds = new Set(pieces.map(p => p.id));
  const created = [];
  let dropped = 0;
  for (const c of (parsed?.clusters || [])) {
    const members = [...new Set((c.entry_ids || []).filter(id => validIds.has(id)))];
    if (members.length < 4) { dropped++; continue; }
    const kind = c.kind === "cross_brand" ? "cross_brand" : "brand_pattern";
    const key = slug(c.pattern_key || c.title);
    if (!key) { dropped++; continue; }
    const signature = `${kind}:${key}`;
    if (skip.has(signature)) { dropped++; continue; }
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
    if (cErr || !col) { console.error("suggestion insert failed:", cErr); dropped++; continue; }

    const rows = members.map((id, i) => ({ collection_id: col.id, entry_id: id, sort_order: i, added_by: "groundwork" }));
    const { error: eErr } = await supabase.from("collection_entries").insert(rows);
    if (eErr) { // roll back the orphan suggestion rather than leave an empty one
      await supabase.from("collections").delete().eq("id", col.id);
      console.error("suggestion entries insert failed:", eErr); dropped++; continue;
    }
    created.push({ id: col.id, title: c.title, kind, count: members.length });
  }

  return Response.json({ suggestions: created, scanned: pieces.length, dropped, model: CLUSTER_MODEL });
}
