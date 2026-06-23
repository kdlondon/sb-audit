-- Findings: a DB-backed shelf of analyst conclusions (replaces the ephemeral
-- localStorage "Analyst Picks"). Anything in Intelligence can be saved as a
-- finding; reports weave them in as an overlay. Run in the Supabase SQL editor.

create table if not exists findings (
  id              text primary key,
  project_id      text not null,
  title           text,
  summary         text,
  stat            text,
  stat_label      text,
  type            text,
  section_affinity text,                 -- optional hint: which report section it belongs to
  source_type     text default 'insight',-- insight | manual | entry | chart
  payload         jsonb default '{}'::jsonb,
  created_by      text,
  created_at      timestamptz default now()
);

create index if not exists findings_project_idx on findings(project_id);

alter table findings enable row level security;

-- App gates access at the application layer (AuthGuard/ProjectGuard) and uses the
-- anon client, same as saved_reports. Permissive policy keeps reads/writes working.
drop policy if exists findings_all on findings;
create policy findings_all on findings for all using (true) with check (true);
