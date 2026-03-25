-- MIGRATION: Multi-tenant architecture
-- Creates organizations, organization_members, folders tables
-- Adds organization_id to projects and clients
-- Migrates existing data (K&D platform org + existing users)

-- 1. Organizations table (tenancy boundary)
CREATE TABLE IF NOT EXISTS organizations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  type text NOT NULL DEFAULT 'client' CHECK (type IN ('platform', 'client')),
  logo_url text,
  plan text DEFAULT 'standard' CHECK (plan IN ('trial', 'basic', 'standard', 'premium')),
  plan_limits jsonb DEFAULT '{}',
  status text DEFAULT 'active',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_select" ON organizations FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "org_insert" ON organizations FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "org_update" ON organizations FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "org_delete" ON organizations FOR DELETE USING (auth.role() = 'authenticated');

-- 2. Organization members table (replaces user_roles for new system)
CREATE TABLE IF NOT EXISTS organization_members (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  email text NOT NULL,
  role text NOT NULL CHECK (role IN ('platform_admin', 'org_admin', 'analyst', 'viewer')),
  invited_by uuid,
  created_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_org_members_user ON organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org ON organization_members(organization_id);

ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "orgm_select" ON organization_members FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "orgm_insert" ON organization_members FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "orgm_update" ON organization_members FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "orgm_delete" ON organization_members FOR DELETE USING (auth.role() = 'authenticated');

-- 3. Folders table (future-proofing for project organization)
CREATE TABLE IF NOT EXISTS folders (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  parent_id uuid REFERENCES folders(id) ON DELETE CASCADE,
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE folders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "folders_select" ON folders FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "folders_insert" ON folders FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "folders_update" ON folders FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "folders_delete" ON folders FOR DELETE USING (auth.role() = 'authenticated');

-- 4. Add organization_id to projects
ALTER TABLE projects ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id) ON DELETE SET NULL;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS folder_id uuid REFERENCES folders(id) ON DELETE SET NULL;

-- 5. Add organization_id to clients
ALTER TABLE clients ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id) ON DELETE SET NULL;
