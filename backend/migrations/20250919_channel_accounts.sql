CREATE TABLE IF NOT EXISTS channel_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('facebook','instagram')),
  external_account_id TEXT NOT NULL,
  name TEXT,
  username TEXT,
  access_token_enc TEXT,
  token_expires_at TIMESTAMPTZ,
  webhook_subscribed BOOLEAN DEFAULT FALSE,
  permissions_json JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (org_id, channel, external_account_id)
);

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS channel TEXT,
  ADD COLUMN IF NOT EXISTS account_id UUID,
  ADD COLUMN IF NOT EXISTS external_user_id TEXT,
  ADD COLUMN IF NOT EXISTS external_thread_id TEXT,
  ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_conv_org_pool ON conversations(org_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_conv_uniqueness ON conversations(org_id, channel, account_id, external_user_id);

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS external_message_id TEXT,
  ADD COLUMN IF NOT EXISTS direction TEXT,
  ADD COLUMN IF NOT EXISTS raw_json JSONB;

CREATE INDEX IF NOT EXISTS idx_msg_external ON messages(external_message_id);
