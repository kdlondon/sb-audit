-- creative_source: origin axes — where a piece came from, how it was acquired, and its
-- native id. Needed so paid ads (Meta) don't contaminate the organic corpus, and so Scout
-- can dedup imports. First-class columns (not custom_dimensions) because reports/filters
-- group by them and the audit-form write path only persists known columns.
--
--   source_platform: web | youtube | instagram | tiktok | meta_ads | google_ads | linkedin | manual
--   source_type:     owned | earned | organic | paid   (see Orden 140726 · D1)
--   source_ref:      the source's native id — youtube video id / ig shortcode / tiktok id /
--                    Meta adArchiveID — used for de-duplication on import.
-- Backfill of existing rows is a separate step (per D1); this only adds the columns.

alter table creative_source add column if not exists source_platform text;
alter table creative_source add column if not exists source_type text;
alter table creative_source add column if not exists source_ref text;

-- Fast dedup lookups (project + platform + native id).
create index if not exists creative_source_source_ref_idx
  on creative_source (project_id, source_platform, source_ref);
