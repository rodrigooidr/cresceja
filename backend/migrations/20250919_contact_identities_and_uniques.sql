-- Identidades por canal/conta (mapeia PSID/IGSID → contact_id)
CREATE TABLE IF NOT EXISTS contact_identities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('facebook','instagram','whatsapp')),
  account_id UUID,                         -- channel_accounts.id (nullable p/ whatsapp se não usar)
  identity TEXT NOT NULL,                  -- PSID / IGSID / telefone
  contact_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (org_id, channel, account_id, identity)
);

-- Garantir unicidade lógica das conversas (org + canal + conta + usuário externo)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'uq_conversations_uniqueness'
  ) THEN
    CREATE UNIQUE INDEX uq_conversations_uniqueness
      ON conversations(org_id, channel, account_id, external_user_id);
  END IF;
END $$;

-- Mensagens idempotentes por mensagem externa
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'uq_messages_external'
  ) THEN
    CREATE UNIQUE INDEX uq_messages_external
      ON messages(org_id, external_message_id);
  END IF;
END $$;
