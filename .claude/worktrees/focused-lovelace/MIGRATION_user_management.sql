-- =============================================
-- USER MANAGEMENT MIGRATION
-- Run this in Supabase → SQL Editor
-- =============================================

-- 1. User roles table (global roles)
CREATE TABLE IF NOT EXISTS user_roles (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'client' CHECK (role IN ('full_admin', 'analyst', 'client')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

-- 2. Project access table (which users can access which projects)
CREATE TABLE IF NOT EXISTS project_access (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  project_id text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, project_id)
);

-- 3. Set existing users as full_admin
INSERT INTO user_roles (user_id, email, role)
SELECT id, email, 'full_admin'
FROM auth.users
WHERE email IN ('sergio@kad.london', 'charlotte@kad.london', 'monica@kad.london')
ON CONFLICT (user_id) DO NOTHING;

-- 4. Give existing full_admins access to all existing projects
INSERT INTO project_access (user_id, email, project_id)
SELECT u.id, u.email, p.id
FROM auth.users u
CROSS JOIN projects p
WHERE u.email IN ('sergio@kad.london', 'charlotte@kad.london', 'monica@kad.london')
ON CONFLICT (user_id, project_id) DO NOTHING;

-- 5. Enable RLS
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_access ENABLE ROW LEVEL SECURITY;

-- 6. RLS policies — authenticated users can read all roles/access
CREATE POLICY "Authenticated users can read user_roles"
  ON user_roles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can read project_access"
  ON project_access FOR SELECT
  TO authenticated
  USING (true);

-- Full admins can insert/update/delete
CREATE POLICY "Full admins can insert user_roles"
  ON user_roles FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Full admins can update user_roles"
  ON user_roles FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Full admins can delete user_roles"
  ON user_roles FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Full admins can insert project_access"
  ON project_access FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Full admins can update project_access"
  ON project_access FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Full admins can delete project_access"
  ON project_access FOR DELETE
  TO authenticated
  USING (true);
