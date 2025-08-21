-- backend/sql/inbox_ux.sql
-- Extensao
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ==== CONTATOS: foto, cpf, data_nascimento opcional, tags normalizadas ====
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS photo_asset_id UUID,
  ADD COLUMN IF NOT EXISTS cpf TEXT,
  ADD COLUMN IF NOT EXISTS birthdate DATE;

-- Tabela de tags gerenciadas pela org (além do contacts.tags[])
CREATE TABLE IF NOT EXISTS tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES orgs(id),
  name TEXT NOT NULL,
  color TEXT,
  UNIQUE(org_id, lower(name))
);
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY rls_tags_org ON tags
  USING (org_id = current_setting('app.org_id')::uuid)
  WITH CHECK (org_id = current_setting('app.org_id')::uuid);

CREATE TABLE IF NOT EXISTS contact_tags (
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES orgs(id),
  PRIMARY KEY (contact_id, tag_id)
);
ALTER TABLE contact_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY rls_contact_tags_org ON contact_tags
  USING (org_id = current_setting('app.org_id')::uuid)
  WITH CHECK (org_id = current_setting('app.org_id')::uuid);

-- ==== CONVERSAS: estados de IA/handoff/atribuição e contadores ====
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS is_ai_active BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS ai_status TEXT NOT NULL DEFAULT 'bot',                    -- 'bot' | 'handed_off'
  ADD COLUMN IF NOT EXISTS human_requested_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS alert_sent BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS assigned_to UUID,                                         -- users.id
  ADD COLUMN IF NOT EXISTS unread_count INTEGER NOT NULL DEFAULT 0;

-- Índices úteis
CREATE INDEX IF NOT EXISTS idx_conversations_org_status ON conversations(org_id, status);
CREATE INDEX IF NOT EXISTS idx_conversations_org_lastmsg ON conversations(org_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_contacts_org_search ON contacts(org_id, lower(display_name));

-- ==== MENSAGENS: anexos e transcrição ====
CREATE TABLE IF NOT EXISTS message_attachments (
  id SERIAL PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES orgs(id),
  message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL,                           -- assets.id
  kind TEXT NOT NULL CHECK (kind IN ('image','file','audio','video')),
  name TEXT,
  size_bytes INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
ALTER TABLE message_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY rls_message_attachments_org ON message_attachments
 USING (org_id = current_setting('app.org_id')::uuid)
 WITH CHECK (org_id = current_setting('app.org_id')::uuid);

CREATE TABLE IF NOT EXISTS message_transcripts (
  id SERIAL PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES orgs(id),
  message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  provider TEXT,               -- ex: 'whisper'
  language TEXT,
  text TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
ALTER TABLE message_transcripts ENABLE ROW LEVEL SECURITY;
CREATE POLICY rls_message_transcripts_org ON message_transcripts
  USING (org_id = current_setting('app.org_id')::uuid)
  WITH CHECK (org_id = current_setting('app.org_id')::uuid);

-- ==== TEMPLATES rápidos (por org) ====
CREATE TABLE IF NOT EXISTS message_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES orgs(id),
  name TEXT NOT NULL,
  channel_scope TEXT[] DEFAULT ARRAY[]::TEXT[],     -- ['whatsapp','instagram','facebook'] vazio = todos
  subject TEXT,
  body TEXT NOT NULL,                               -- pode conter {{cliente.nome}} etc.
  preview_asset_id UUID,
  vars JSONB DEFAULT '{}'::jsonb,
  created_by UUID,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY rls_message_templates_org ON message_templates
  USING (org_id = current_setting('app.org_id')::uuid)
  WITH CHECK (org_id = current_setting('app.org_id')::uuid);

-- ==== Configuração de IA da org ====
CREATE TABLE IF NOT EXISTS org_ai_settings (
  org_id UUID PRIMARY KEY REFERENCES orgs(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  handoff_keywords TEXT[] DEFAULT ARRAY['humano','atendente','pessoa','falar com atendente'],
  collect_fields JSONB DEFAULT '{"nome":true,"cpf":true,"telefone":true}'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
ALTER TABLE org_ai_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY rls_org_ai_settings ON org_ai_settings
  USING (org_id = current_setting('app.org_id')::uuid)
  WITH CHECK (org_id = current_setting('app.org_id')::uuid);
