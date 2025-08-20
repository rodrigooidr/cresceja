-- MT-1: add org_id to CRM and Inbox tables

-- Leads
ALTER TABLE leads ADD COLUMN IF NOT EXISTS org_id uuid;
UPDATE leads SET org_id = :ORG_DEFAULT_UUID WHERE org_id IS NULL;
ALTER TABLE leads ALTER COLUMN org_id SET NOT NULL;
DO $$ BEGIN
  ALTER TABLE leads ADD CONSTRAINT fk_leads_org FOREIGN KEY (org_id) REFERENCES orgs(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
CREATE INDEX IF NOT EXISTS idx_leads_org_id ON leads(org_id);
CREATE INDEX IF NOT EXISTS idx_leads_org_status ON leads(org_id, status);
CREATE INDEX IF NOT EXISTS idx_leads_org_created_at ON leads(org_id, created_at);
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS leads_isolation ON leads;
CREATE POLICY leads_isolation ON leads USING (org_id = current_setting('app.org_id')::uuid) WITH CHECK (org_id = current_setting('app.org_id')::uuid);

-- Opportunities
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS org_id uuid;
UPDATE opportunities SET org_id = :ORG_DEFAULT_UUID WHERE org_id IS NULL;
ALTER TABLE opportunities ALTER COLUMN org_id SET NOT NULL;
DO $$ BEGIN
  ALTER TABLE opportunities ADD CONSTRAINT fk_opportunities_org FOREIGN KEY (org_id) REFERENCES orgs(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
CREATE INDEX IF NOT EXISTS idx_opportunities_org_id ON opportunities(org_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_org_status ON opportunities(org_id, status);
CREATE INDEX IF NOT EXISTS idx_opportunities_org_updated_at ON opportunities(org_id, updated_at);
ALTER TABLE opportunities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS opportunities_isolation ON opportunities;
CREATE POLICY opportunities_isolation ON opportunities USING (org_id = current_setting('app.org_id')::uuid) WITH CHECK (org_id = current_setting('app.org_id')::uuid);

-- Clients
ALTER TABLE clients ADD COLUMN IF NOT EXISTS org_id uuid;
UPDATE clients SET org_id = :ORG_DEFAULT_UUID WHERE org_id IS NULL;
ALTER TABLE clients ALTER COLUMN org_id SET NOT NULL;
DO $$ BEGIN
  ALTER TABLE clients ADD CONSTRAINT fk_clients_org FOREIGN KEY (org_id) REFERENCES orgs(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
CREATE INDEX IF NOT EXISTS idx_clients_org_id ON clients(org_id);
CREATE INDEX IF NOT EXISTS idx_clients_org_status ON clients(org_id, status);
CREATE INDEX IF NOT EXISTS idx_clients_org_created_at ON clients(org_id, created_at);
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS clients_isolation ON clients;
CREATE POLICY clients_isolation ON clients USING (org_id = current_setting('app.org_id')::uuid) WITH CHECK (org_id = current_setting('app.org_id')::uuid);

-- Onboarding tasks
ALTER TABLE onboarding_tasks ADD COLUMN IF NOT EXISTS org_id uuid;
UPDATE onboarding_tasks ot SET org_id = c.org_id FROM clients c WHERE ot.client_id = c.id AND ot.org_id IS NULL;
UPDATE onboarding_tasks SET org_id = :ORG_DEFAULT_UUID WHERE org_id IS NULL;
ALTER TABLE onboarding_tasks ALTER COLUMN org_id SET NOT NULL;
DO $$ BEGIN
  ALTER TABLE onboarding_tasks ADD CONSTRAINT fk_onboarding_tasks_org FOREIGN KEY (org_id) REFERENCES orgs(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
CREATE INDEX IF NOT EXISTS idx_onboarding_tasks_org_id ON onboarding_tasks(org_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_tasks_client ON onboarding_tasks(org_id, client_id);
ALTER TABLE onboarding_tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS onboarding_tasks_isolation ON onboarding_tasks;
CREATE POLICY onboarding_tasks_isolation ON onboarding_tasks USING (org_id = current_setting('app.org_id')::uuid) WITH CHECK (org_id = current_setting('app.org_id')::uuid);

-- Conversations
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS org_id uuid;
UPDATE conversations SET org_id = :ORG_DEFAULT_UUID WHERE org_id IS NULL;
ALTER TABLE conversations ALTER COLUMN org_id SET NOT NULL;
DO $$ BEGIN
  ALTER TABLE conversations ADD CONSTRAINT fk_conversations_org FOREIGN KEY (org_id) REFERENCES orgs(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
CREATE INDEX IF NOT EXISTS idx_conversations_org_id ON conversations(org_id);
CREATE INDEX IF NOT EXISTS idx_conversations_org_status ON conversations(org_id, status);
CREATE INDEX IF NOT EXISTS idx_conversations_org_created_at ON conversations(org_id, created_at);
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS conversations_isolation ON conversations;
CREATE POLICY conversations_isolation ON conversations USING (org_id = current_setting('app.org_id')::uuid) WITH CHECK (org_id = current_setting('app.org_id')::uuid);

-- Messages
ALTER TABLE messages ADD COLUMN IF NOT EXISTS org_id uuid;
UPDATE messages m SET org_id = c.org_id FROM conversations c WHERE m.conversation_id = c.id AND m.org_id IS NULL;
UPDATE messages SET org_id = :ORG_DEFAULT_UUID WHERE org_id IS NULL;
ALTER TABLE messages ALTER COLUMN org_id SET NOT NULL;
DO $$ BEGIN
  ALTER TABLE messages ADD CONSTRAINT fk_messages_org FOREIGN KEY (org_id) REFERENCES orgs(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
CREATE INDEX IF NOT EXISTS idx_messages_org_id ON messages(org_id);
CREATE INDEX IF NOT EXISTS idx_messages_org_conv ON messages(org_id, conversation_id, created_at);
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS messages_isolation ON messages;
CREATE POLICY messages_isolation ON messages USING (org_id = current_setting('app.org_id')::uuid) WITH CHECK (org_id = current_setting('app.org_id')::uuid);
