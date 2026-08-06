-- Smart Collections — the data model the redesign assumes.
--
-- Adds the lifecycle/origin/evidence/kind fields to `collections`, plus a table that
-- remembers dismissed cluster signatures so a rejected suggestion is never proposed again.
-- Existing collections become active + manual (they were all hand-made). Run in Supabase.

-- ── collections: new columns ──────────────────────────────────────────────────
-- state: where a collection sits in its lifecycle.
--   suggested → proposed by the scan, awaiting the analyst's approve/dismiss
--   active    → a real collection in the official list (approved, or hand-made)
--   dismissed → a suggestion the analyst rejected (kept only for its signature)
alter table collections add column if not exists state text not null default 'active';

-- origin: who created it. AI-born collections keep the ✧ seal after approval.
alter table collections add column if not exists origin text not null default 'manual';

-- kind: for suggestions only — one brand repeating a concept vs several brands
-- converging on a territory. Null for manual collections.
alter table collections add column if not exists kind text;

-- rationale (the "evidence"): why this deserves a collection + the key learnings.
-- { "why": "paragraph", "learnings": ["...", "..."] }. Optional on manual collections.
alter table collections add column if not exists rationale jsonb;

-- signature: a stable identity for the cluster behind an AI suggestion, so the same
-- pattern is recognised across scans (for dedup and permanent dismissal). Null for manual.
alter table collections add column if not exists signature text;

-- Existing rows are hand-made and live — make that explicit rather than relying on the
-- column defaults only for new inserts.
update collections set state = 'active' where state is null or state = '';
update collections set origin = 'manual' where origin is null or origin = '';

create index if not exists collections_state_idx on collections (project_id, state);

-- ── collection_dismissals: permanent "don't suggest this again" ────────────────
-- A dismissed suggestion's cluster signature lands here. The scan skips any candidate
-- whose signature is present. Dismissal is permanent by decision — there is no restore.
-- Kept separate from `collections` so a dismissal survives even if the suggested row is
-- cleaned up, and so the scan can check membership with one cheap query.
create table if not exists collection_dismissals (
  id uuid primary key default gen_random_uuid(),
  project_id text not null,
  signature text not null,
  dismissed_by text,
  dismissed_at timestamptz not null default now()
);

create unique index if not exists collection_dismissals_unique
  on collection_dismissals (project_id, signature);

-- Permissive RLS to match the rest of the collections surface (the app gates by project).
alter table collection_dismissals enable row level security;
do $$ begin
  create policy collection_dismissals_all on collection_dismissals for all using (true) with check (true);
exception when duplicate_object then null; end $$;
