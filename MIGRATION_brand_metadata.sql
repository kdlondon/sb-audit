-- =============================================
-- BRAND METADATA MIGRATION
-- Run this in Supabase → SQL Editor
-- =============================================

CREATE TABLE IF NOT EXISTS brand_metadata (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id text NOT NULL,
  brand_name text NOT NULL,
  brand_category text DEFAULT 'Other',
  created_at timestamptz DEFAULT now(),
  UNIQUE(project_id, brand_name)
);

ALTER TABLE brand_metadata ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read brand_metadata"
  ON brand_metadata FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert brand_metadata"
  ON brand_metadata FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update brand_metadata"
  ON brand_metadata FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete brand_metadata"
  ON brand_metadata FOR DELETE TO authenticated USING (true);
