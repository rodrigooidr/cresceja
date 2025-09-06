ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb NOT NULL;
CREATE INDEX IF NOT EXISTS idx_messages_conv_created
  ON messages (conversation_id, created_at DESC);
