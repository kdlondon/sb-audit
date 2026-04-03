-- =============================================
-- CREATIVE SHOWCASE MIGRATION
-- Run this in Supabase → SQL Editor
-- =============================================

CREATE TABLE IF NOT EXISTS saved_showcases (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL DEFAULT 'Untitled Showcase',
  project_id text NOT NULL,
  filters jsonb DEFAULT '{}',
  slides jsonb DEFAULT '[]',
  created_by text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE saved_showcases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read showcases"
  ON saved_showcases FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert showcases"
  ON saved_showcases FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update showcases"
  ON saved_showcases FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete showcases"
  ON saved_showcases FOR DELETE TO authenticated USING (true);
