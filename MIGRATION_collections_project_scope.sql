-- Collections: move from brand_id scoping to project_id, like the rest of the platform.
--
-- The feature was built brand-scoped (collections.brand_id), but Groundwork moved to
-- project scoping. The result: the Creative Source Collections tab queried collections by
-- brand_id and 400'd whenever a project's brand_id was really a "proj_..." fallback, and the
-- Report configurator queried by project_id and found nothing, because collections carried
-- no project_id at all.
--
-- This adds project_id and backfills it from each collection's OWN entries — the reliable
-- link, since a collection_entry points at a creative_source row that already knows its
-- project. Run in the Supabase SQL editor.

-- 1. The column.
alter table collections add column if not exists project_id text;

-- 2. Backfill from entries: a collection belongs to the project its pieces belong to.
--    (All existing collections resolve cleanly to a single project this way.)
update collections c
set project_id = sub.project_id
from (
  select ce.collection_id, cs.project_id, count(*) as n
  from collection_entries ce
  join creative_source cs on cs.id = ce.entry_id
  where cs.project_id is not null
  group by ce.collection_id, cs.project_id
) sub
where sub.collection_id = c.id
  and c.project_id is null;

-- 3. Index for the by-project listing.
create index if not exists collections_project_id_idx on collections (project_id);

-- Empty collections (no entries) cannot be inferred and keep project_id = null; they simply
-- won't appear under any project until they get an entry or are re-created. No data is lost.
