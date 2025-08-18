-- 003b_fix.sql — correção go-live
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Corrige a sintaxe do ALTER TABLE
ALTER TABLE leads ADD COLUMN IF NOT EXISTS erased_at TIMESTAMP NULL;

-- Bootstrap (cria se não existir)
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL,
  channel_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL,
  lead_id UUID NOT NULL,
  direction TEXT NOT NULL,        -- inbound | outbound
  type TEXT NOT NULL DEFAULT 'text',
  text TEXT NULL,
  attachments JSONB NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Índices só se a tabela existir
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='messages') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_messages_lead ON messages(lead_id)';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='conversations') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_conv_lead ON conversations(lead_id)';
  END IF;
END $$;