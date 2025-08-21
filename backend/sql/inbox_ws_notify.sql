-- backend/sql/inbox_ws_notify.sql

-- Mensagens: status e IDs do provedor
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS provider TEXT,                                 -- 'wa_cloud' | 'baileys' | 'instagram' | 'facebook'
  ADD COLUMN IF NOT EXISTS provider_message_id TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'queued';                  -- 'queued' | 'sent' | 'delivered' | 'read' | 'failed'

CREATE INDEX IF NOT EXISTS idx_messages_org_conv ON messages(org_id, conversation_id, id);
CREATE INDEX IF NOT EXISTS idx_messages_org_status ON messages(org_id, status);

-- Conversas: unread_count já criado na sprint anterior; garantir índice
CREATE INDEX IF NOT EXISTS idx_conv_org_unread ON conversations(org_id, unread_count);

-- Assets: garantir tabela existe (se não, criar rapidamente)
CREATE TABLE IF NOT EXISTS assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES orgs(id),
  owner_user_id UUID,
  kind TEXT NOT NULL CHECK (kind IN ('image','video','audio','file')),
  path TEXT NOT NULL,                 -- ex.: s3://bucket/org_id/... ou local
  meta JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY rls_assets_org ON assets
  USING (org_id = current_setting('app.org_id')::uuid)
  WITH CHECK (org_id = current_setting('app.org_id')::uuid);

