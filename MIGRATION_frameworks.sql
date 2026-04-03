-- MIGRATION: project_frameworks table
-- Stores per-project framework configuration, brand profile, and tier settings.
-- Replaces hardcoded lib/framework.js for multi-client support.

CREATE TABLE IF NOT EXISTS project_frameworks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id text NOT NULL,
  name text NOT NULL DEFAULT 'Default Framework',
  tier text DEFAULT 'essential' CHECK (tier IN ('essential', 'enhanced', 'specialist')),

  -- Brand profile (from onboarding)
  brand_name text,
  brand_description text,
  brand_positioning text,
  brand_differentiator text,
  brand_audience text,
  brand_tone text,
  industry text,
  sub_category text,
  primary_market text,               -- country code e.g. "CA"
  global_markets jsonb DEFAULT '[]', -- ["US","GB","AU"]
  language text DEFAULT 'English',
  secondary_language text,
  objectives jsonb DEFAULT '[]',     -- ["positioning","inspiration"]
  specific_questions text,
  reporting_frequency text,
  logo_url text,
  years_in_market text,

  -- Structured framework data
  dimensions jsonb DEFAULT '[]',
  -- Each dimension: { name, key, values:[], description, classification_rules }
  -- Example: { "name": "Portrait", "key": "portrait", "values": ["Dreamer","Builder","Sovereign","Architect"], "description": "Owner identity types", "classification_rules": "..." }

  framework_text text DEFAULT '',    -- Full text blob for Tier 3 (e.g., current FRAMEWORK_CONTEXT)

  -- Configurable option sets (override defaults)
  brand_categories jsonb DEFAULT '["Other"]',
  communication_intents jsonb DEFAULT '["Brand Hero","Brand Tactical","Client Testimonials","Product","Innovation"]',
  standard_dimensions jsonb DEFAULT '["archetype","tone","execution","funnel","rating"]',
  -- Which standard dimensions are active (user can toggle off)

  -- Local competitors (stored as JSON for quick access; also in project_brands)
  local_competitors jsonb DEFAULT '[]',
  -- Each: { name, type: "direct"|"adjacent", category }

  -- Global benchmarks
  global_benchmarks jsonb DEFAULT '[]',
  -- Each: { name, country, industry, reason }

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Index for fast lookup by project
CREATE INDEX IF NOT EXISTS idx_project_frameworks_project_id ON project_frameworks(project_id);

-- Unique constraint: one framework per project (can be relaxed later for multi-framework)
CREATE UNIQUE INDEX IF NOT EXISTS idx_project_frameworks_unique_project ON project_frameworks(project_id);

-- Enable RLS
ALTER TABLE project_frameworks ENABLE ROW LEVEL SECURITY;

-- Policy: authenticated users can read frameworks for projects they have access to
CREATE POLICY "Users can read project frameworks" ON project_frameworks
  FOR SELECT USING (auth.role() = 'authenticated');

-- Policy: authenticated users can insert/update frameworks
CREATE POLICY "Users can insert project frameworks" ON project_frameworks
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can update project frameworks" ON project_frameworks
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Users can delete project frameworks" ON project_frameworks
  FOR DELETE USING (auth.role() = 'authenticated');

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_framework_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_framework_timestamp
  BEFORE UPDATE ON project_frameworks
  FOR EACH ROW
  EXECUTE FUNCTION update_framework_timestamp();
