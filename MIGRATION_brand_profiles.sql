-- Brand DNA profiles, versioned: each "update" inserts a new row; the latest row per
-- (project_id, brand) is the current profile, older rows are the history.
CREATE TABLE IF NOT EXISTS brand_profiles (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id text NOT NULL,
  brand text NOT NULL,
  url text,
  profile jsonb NOT NULL,
  meta jsonb,
  created_by text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_brand_profiles_lookup ON brand_profiles(project_id, brand, created_at DESC);

ALTER TABLE brand_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS brand_profiles_rw ON brand_profiles;
CREATE POLICY brand_profiles_rw ON brand_profiles FOR ALL TO authenticated USING (true) WITH CHECK (true);
