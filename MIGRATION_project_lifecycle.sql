-- Project lifecycle: active / archived / trashed (soft delete with 30-day retention)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS status_changed_at timestamptz DEFAULT now();
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);

-- Trashed projects are hard-deleted after 30 days. The app purges lazily on home load,
-- but you can ALSO schedule it in-DB if pg_cron is enabled (optional):
-- select cron.schedule('purge-trash','0 3 * * *',
--   $$ delete from projects where status='trashed' and status_changed_at < now() - interval '30 days' $$);
