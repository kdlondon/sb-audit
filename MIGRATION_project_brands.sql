-- ============================================================================
-- project_brands: normalized, project-scoped brand registry (Competitive
-- Landscape source of truth — see docs/competitive-landscape.md §5).
-- Named project_brands because a legacy `brands` table (workspace-scoped,
-- used by the brand_id path + brand_competitors) already exists.
-- Idempotent — safe to run more than once. Run in the Supabase SQL editor.
-- ============================================================================

-- An ORPHANED project_brands table (from an early design referenced in
-- MIGRATION_frameworks.sql, different schema, unused by app code) may exist.
-- If it lacks our `name` column, park it as project_brands_legacy (data kept).
do $$
begin
  if exists (select 1 from information_schema.tables
             where table_schema = 'public' and table_name = 'project_brands')
     and not exists (select 1 from information_schema.columns
                     where table_schema = 'public' and table_name = 'project_brands'
                       and column_name = 'name') then
    alter table project_brands rename to project_brands_legacy;
  end if;
end $$;

create table if not exists project_brands (
  id               uuid primary key default gen_random_uuid(),
  project_id       text not null,
  name             text not null,
  role             text not null check (role in ('principal','direct','adjacent','global')),
  country          text,                        -- mostly for global references
  category         text,
  sub_category     text,
  website          text,
  social           jsonb default '{}'::jsonb,   -- { instagram, tiktok, youtube }
  logo_url         text,
  brand_dna_status text default 'pending',      -- pending | generated | failed
  archived         boolean default false,       -- soft-delete: hidden everywhere, content kept
  sort_order       int default 0,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

create index if not exists project_brands_project_idx on project_brands(project_id);
create unique index if not exists project_brands_project_name_uidx on project_brands(project_id, lower(name));

alter table project_brands enable row level security;
-- App gates access at the application layer (AuthGuard/ProjectGuard), same as
-- saved_reports/findings. Permissive policy keeps anon-client reads/writes working.
drop policy if exists project_brands_all on project_brands;
create policy project_brands_all on project_brands for all using (true) with check (true);

-- Content linkage (nullable during transition; brand string columns remain for
-- retro-compat and for content whose brand was archived). Named project_brand_id:
-- creative_source.brand_id ALREADY exists and points at the legacy workspace
-- `brands` table — different meaning, do not reuse.
alter table creative_source add column if not exists project_brand_id uuid references project_brands(id) on delete set null;

-- ============================================================================
-- BACKFILL from project_frameworks (the current source of truth)
-- ============================================================================

-- 1) Principal brand (from brand_name)
insert into project_brands (project_id, name, role)
select pf.project_id, trim(pf.brand_name), 'principal'
from project_frameworks pf
where coalesce(trim(pf.brand_name), '') <> ''
on conflict (project_id, lower(name)) do nothing;

-- 2) Direct / adjacent competitors (from local_competitors jsonb array)
insert into project_brands (project_id, name, role, category, sub_category, website, sort_order)
select pf.project_id,
       trim(c->>'name'),
       case when lower(coalesce(c->>'type','direct')) like 'adjacent%' then 'adjacent' else 'direct' end,
       nullif(trim(coalesce(c->>'category','')), ''),
       nullif(trim(coalesce(c->>'sub_category','')), ''),
       case jsonb_typeof(c->'website')
         when 'array'  then c->'website'->>0
         when 'string' then c->>'website'
         else null end,
       t.ord - 1
from project_frameworks pf,
     jsonb_array_elements(coalesce(pf.local_competitors::jsonb, '[]'::jsonb)) with ordinality as t(c, ord)
where coalesce(trim(c->>'name'), '') <> ''
on conflict (project_id, lower(name)) do nothing;

-- 3) Global references (from global_benchmarks jsonb array)
insert into project_brands (project_id, name, role, country, website, sort_order)
select pf.project_id,
       trim(g->>'name'),
       'global',
       nullif(trim(coalesce(g->>'country','')), ''),
       case jsonb_typeof(g->'website')
         when 'array'  then g->'website'->>0
         when 'string' then g->>'website'
         else null end,
       t.ord - 1
from project_frameworks pf,
     jsonb_array_elements(coalesce(pf.global_benchmarks::jsonb, '[]'::jsonb)) with ordinality as t(g, ord)
where coalesce(trim(g->>'name'), '') <> ''
on conflict (project_id, lower(name)) do nothing;

-- ============================================================================
-- BACKFILL from the legacy brand_id path (brand_competitors + brands), best
-- effort: only workspaces whose own-brand row carries a project_id.
-- ============================================================================
insert into project_brands (project_id, name, role, country, category, sub_category, website)
select own.project_id,
       trim(b.name),
       case when b.scope = 'global' then 'global' else 'direct' end,
       b.country, b.category, b.sub_category, b.website
from brand_competitors bc
join brands own on own.id = bc.own_brand_id
join brands b   on b.id  = bc.competitor_brand_id
where own.project_id is not null
  and coalesce(trim(b.name), '') <> ''
on conflict (project_id, lower(name)) do nothing;

-- Sanity check: see what landed
-- select project_id, role, count(*) from project_brands group by 1,2 order by 1,2;
