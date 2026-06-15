-- K&D Team — assigns a K&D Analyst to specific clients.
-- K&D Superadmins see all clients; K&D Analysts only their assigned ones.

CREATE TABLE IF NOT EXISTS kd_client_assignments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, client_id)
);

ALTER TABLE kd_client_assignments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Allow all for authenticated" ON kd_client_assignments
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;
