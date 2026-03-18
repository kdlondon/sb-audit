-- =============================================
-- REPORT EDITOR + KNOWLEDGE BASE MIGRATION
-- Run this in Supabase → SQL Editor
-- =============================================

-- Add updated_at to saved_reports
ALTER TABLE saved_reports ADD COLUMN IF NOT EXISTS updated_at timestamptz;

-- Knowledge files table
CREATE TABLE IF NOT EXISTS report_knowledge (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  report_id uuid,
  project_id text NOT NULL,
  file_name text NOT NULL,
  storage_path text NOT NULL,
  extracted_text text,
  file_size integer,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE report_knowledge ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read report_knowledge"
  ON report_knowledge FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert report_knowledge"
  ON report_knowledge FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update report_knowledge"
  ON report_knowledge FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete report_knowledge"
  ON report_knowledge FOR DELETE TO authenticated USING (true);
