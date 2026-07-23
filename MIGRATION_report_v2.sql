-- Report v2 — status, soft-archive/delete, per-report timestamps, anchored comments,
-- and nesting the visual presentation under a report.
-- Run in the Supabase SQL editor. Idempotent (safe to re-run).

-- ── saved_reports: lifecycle ──
alter table saved_reports add column if not exists status     text        default 'in_process';  -- in_process | in_review | delivered
alter table saved_reports add column if not exists archived   boolean     default false;
alter table saved_reports add column if not exists deleted_at timestamptz;                        -- soft delete (restorable ~30d)
alter table saved_reports add column if not exists updated_at timestamptz default now();          -- concurrency witness

-- Backfill existing rows to the active/in-process baseline.
update saved_reports set status   = 'in_process' where status   is null;
update saved_reports set archived = false        where archived is null;

-- ── report_comments: anchored to a content block, not to matched text ──
create table if not exists report_comments (
  id           uuid primary key default gen_random_uuid(),
  report_id    text not null,                 -- saved_reports.id (client-generated string, not uuid)
  project_id   text not null,
  block_id     text not null,                 -- stable id of the block the comment anchors to
  sel_start    int,                           -- char offset within the block
  sel_end      int,
  snippet      text,                          -- the quoted text at creation time (display only)
  body         text not null,
  author       text not null,
  author_role  text not null default 'kd',    -- 'kd' | 'client'
  created_at   timestamptz default now(),
  edited_at    timestamptz,
  deleted_at   timestamptz
);
create index if not exists report_comments_report_idx on report_comments (report_id) where deleted_at is null;

-- Permissive RLS to match the rest of the app's tables (project scoping is enforced in app code).
alter table report_comments enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'report_comments' and policyname = 'report_comments_all') then
    create policy report_comments_all on report_comments for all using (true) with check (true);
  end if;
end $$;

-- ── saved_showcases: nest under a report + archive the standalone ones ──
alter table saved_showcases add column if not exists report_id text;                    -- the report this presentation belongs to
alter table saved_showcases add column if not exists archived  boolean default false;

-- Existing showcases predate the nesting model → archive them (decision 2026-07-23).
update saved_showcases set archived = true where report_id is null and archived is not true;
