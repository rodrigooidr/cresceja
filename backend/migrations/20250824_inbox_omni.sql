CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- timestamps automáticos
DO $$ BEGIN
  CREATE OR REPLACE FUNCTION set_timestamp()
  RETURNS TRIGGER AS $$
  BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;
EXCEPTION WHEN others THEN NULL; END $$;

-- contacts
CREATE TABLE IF NOT EXISTS contacts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id uuid NOT NULL,
  provider_user_id text,
  name text,
  first_name text,
  cpf text,
  phone_e164 text,
  email text,
  birthdate date,
  photo_url text,
  tags text[] DEFAULT '{}',
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- conversations
CREATE TABLE IF NOT EXISTS conversations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id uuid NOT NULL,
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('whatsapp','instagram','facebook')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','assigned','waiting_customer','resolved')),
  assigned_to uuid,
  ai_enabled boolean NOT NULL DEFAULT true,
  unread_count int NOT NULL DEFAULT 0,
  last_message_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- messages
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id uuid NOT NULL,
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  "from" text NOT NULL CHECK ("from" IN ('customer','agent','ai')),
  provider text NOT NULL CHECK (provider IN ('wa','ig','fb')),
  provider_message_id text,
  type text NOT NULL CHECK (type IN ('text','image','video','audio','file','sticker','template')),
  text text,
  emojis_json jsonb,
  attachments jsonb,
  status text CHECK (status IN ('sent','delivered','read','failed')),
  transcript text,
  meta jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- attachments
CREATE TABLE IF NOT EXISTS attachments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id uuid NOT NULL,
  message_id uuid REFERENCES messages(id) ON DELETE CASCADE,
  kind text CHECK (kind IN ('image','video','audio','file')),
  storage_key text,
  mime text,
  size_bytes bigint,
  width int,
  height int,
  duration_ms int,
  checksum text,
  created_at timestamptz DEFAULT now()
);

-- org_settings
CREATE TABLE IF NOT EXISTS org_settings (
  org_id uuid PRIMARY KEY,
  ai_enabled boolean NOT NULL DEFAULT true,
  ai_handoff_keywords text[] DEFAULT ARRAY['humano','atendente','pessoa'],
  ai_max_turns_before_handoff int DEFAULT 10,
  templates_enabled_channels text[] DEFAULT ARRAY['whatsapp','instagram','facebook'],
  business_hours jsonb,
  alert_volume numeric DEFAULT 0.8,
  alert_sound text DEFAULT '/assets/sounds/alert.mp3',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- templates
CREATE TABLE IF NOT EXISTS templates (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id uuid NOT NULL,
  channel text NOT NULL CHECK (channel IN ('whatsapp','instagram','facebook')),
  name text NOT NULL,
  body text NOT NULL,
  variables text[] DEFAULT '{}',
  category text,
  status text NOT NULL DEFAULT 'approved' CHECK (status IN ('draft','approved','rejected')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- org_tags
CREATE TABLE IF NOT EXISTS org_tags (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id uuid NOT NULL,
  label text NOT NULL,
  color text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contacts_org ON contacts(org_id);
CREATE INDEX IF NOT EXISTS idx_contacts_phone ON contacts(phone_e164);
CREATE UNIQUE INDEX IF NOT EXISTS uq_contacts_org_cpf ON contacts(org_id, cpf) WHERE cpf IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_conversations_org_last ON conversations(org_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_contact ON conversations(contact_id);

CREATE INDEX IF NOT EXISTS idx_messages_conv_created ON messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_org ON messages(org_id);

CREATE INDEX IF NOT EXISTS idx_org_tags_org ON org_tags(org_id);

DO $$ BEGIN
  CREATE TRIGGER set_contacts_updated_at BEFORE UPDATE ON contacts FOR EACH ROW EXECUTE FUNCTION set_timestamp();
EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER set_conversations_updated_at BEFORE UPDATE ON conversations FOR EACH ROW EXECUTE FUNCTION set_timestamp();
EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER set_messages_updated_at BEFORE UPDATE ON messages FOR EACH ROW EXECUTE FUNCTION set_timestamp();
EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER set_org_settings_updated_at BEFORE UPDATE ON org_settings FOR EACH ROW EXECUTE FUNCTION set_timestamp();
EXCEPTION WHEN others THEN NULL; END $$;

ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_tags ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS contacts_isolation ON contacts;
  CREATE POLICY contacts_isolation ON contacts
    USING (org_id = current_setting('app.org_id', true)::uuid)
    WITH CHECK (org_id = current_setting('app.org_id', true)::uuid);
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS conversations_isolation ON conversations;
  CREATE POLICY conversations_isolation ON conversations
    USING (org_id = current_setting('app.org_id', true)::uuid)
    WITH CHECK (org_id = current_setting('app.org_id', true)::uuid);
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS messages_isolation ON messages;
  CREATE POLICY messages_isolation ON messages
    USING (org_id = current_setting('app.org_id', true)::uuid)
    WITH CHECK (org_id = current_setting('app.org_id', true)::uuid);
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS attachments_isolation ON attachments;
  CREATE POLICY attachments_isolation ON attachments
    USING (org_id = current_setting('app.org_id', true)::uuid)
    WITH CHECK (org_id = current_setting('app.org_id', true)::uuid);
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS templates_isolation ON templates;
  CREATE POLICY templates_isolation ON templates
    USING (org_id = current_setting('app.org_id', true)::uuid)
    WITH CHECK (org_id = current_setting('app.org_id', true)::uuid);
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS org_tags_isolation ON org_tags;
  CREATE POLICY org_tags_isolation ON org_tags
    USING (org_id = current_setting('app.org_id', true)::uuid)
    WITH CHECK (org_id = current_setting('app.org_id', true)::uuid);
EXCEPTION WHEN others THEN NULL; END $$;
