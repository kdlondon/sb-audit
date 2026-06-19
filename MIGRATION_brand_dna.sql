-- Brand DNA profiles, versioned: each "update" inserts a new row; the latest row per
-- (project_id, brand) is the current profile, older rows are the history.
-- (New table — the legacy "brand_profiles" table is left untouched.)
CREATE TABLE IF NOT EXISTS brand_dna (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id text NOT NULL,
  brand text NOT NULL,
  url text,
  profile jsonb NOT NULL,
  meta jsonb,
  created_by text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_brand_dna_lookup ON brand_dna(project_id, brand, created_at DESC);

ALTER TABLE brand_dna ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS brand_dna_rw ON brand_dna;
CREATE POLICY brand_dna_rw ON brand_dna FOR ALL TO authenticated USING (true) WITH CHECK (true);
