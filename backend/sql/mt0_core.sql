CREATE TABLE IF NOT EXISTS plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS orgs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  plan_id uuid REFERENCES plans(id),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS org_users (
  org_id uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('OrgOwner','Manager','Agent','Viewer')),
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (org_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_org_users_user_id ON org_users(user_id);

ALTER TABLE orgs ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS orgs_isolation ON orgs;
CREATE POLICY orgs_isolation ON orgs USING (id = current_setting('app.org_id')::uuid) WITH CHECK (id = current_setting('app.org_id')::uuid);

DROP POLICY IF EXISTS org_users_isolation ON org_users;
CREATE POLICY org_users_isolation ON org_users USING (org_id = current_setting('app.org_id')::uuid) WITH CHECK (org_id = current_setting('app.org_id')::uuid);
