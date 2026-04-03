-- ═══════════════════════════════════════════════════════════════
-- MIGRATION: Client Management + Link existing data
-- Run this in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- 1. Create clients table (if not already created)
CREATE TABLE IF NOT EXISTS clients (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  slug text UNIQUE,
  logo_url text,
  primary_contact_name text,
  primary_contact_email text,
  primary_contact_phone text,
  website text,
  industry text,
  country text,
  company_size text,
  status text NOT NULL DEFAULT 'active',
  tier text DEFAULT 'standard',
  contract_start date,
  contract_end date,
  monthly_value numeric(10,2),
  billing_notes text,
  notes text,
  tags text[],
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by text
);

-- 2. Create activity log table
CREATE TABLE IF NOT EXISTS client_activity_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE,
  action text NOT NULL,
  description text,
  metadata jsonb DEFAULT '{}',
  performed_by text,
  created_at timestamptz DEFAULT now()
);

-- 3. Add client_id to projects (if not exists)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES clients(id) ON DELETE SET NULL;

-- 4. RLS policies
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_activity_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Allow all for authenticated" ON clients FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Allow all for authenticated" ON client_activity_log FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 5. Create Scotiabank as a client and link existing project
INSERT INTO clients (name, slug, industry, country, status, tier, notes, created_by)
VALUES ('Scotiabank', 'scotiabank', 'Financial Services', 'Canada', 'active', 'premium', 'First client — Scotiabank Business Banking competitive audit', 'sergio@kad.london')
ON CONFLICT (slug) DO NOTHING;

-- 6. Link the existing "Scotiabank Business Banking" project to the Scotiabank client
UPDATE projects
SET client_id = (SELECT id FROM clients WHERE slug = 'scotiabank' LIMIT 1)
WHERE name ILIKE '%scotiabank%' OR name ILIKE '%business banking%';
