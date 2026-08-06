-- Collections: brand_id / organization_id are legacy NOT NULL — drop it.
--
-- Groundwork moved to PROJECT scoping (see MIGRATION_collections_project_scope.sql):
-- the app lists and writes collections by project_id, and a project's brand_id is often
-- a "proj_..." fallback that maps to no real brand row. But the original collections
-- table still marks brand_id (and organization_id) NOT NULL, so any collection created
-- in a project-only context fails:
--     null value in column "brand_id" of relation "collections" violates not-null constraint
-- This bit the Smart Collections scan (every suggestion insert failed) and would equally
-- bite manual creation in the same projects. project_id is the real scope now, so these
-- two columns should simply be nullable. Run in the Supabase SQL editor.

alter table collections alter column brand_id drop not null;
alter table collections alter column organization_id drop not null;
