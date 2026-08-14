-- project_frameworks: add the brand-profile columns Settings tries to save but the table
-- never had, so they were silently dropped in project-centric projects (data-loss bug).
--
-- `brand_archetype` and `r2b` are captured in the Settings brand-profile form and correctly
-- persisted for legacy brand-centric projects (into `brands`), but the project-centric branch
-- updated `project_frameworks` — which lacks these two columns — so the values vanished on
-- save. Adding them lets the fix in app/settings/page.jsx persist both. Run in Supabase
-- BEFORE (or as) the code deploys, so the save doesn't hit a missing column.

alter table project_frameworks add column if not exists brand_archetype text;
alter table project_frameworks add column if not exists r2b text;
