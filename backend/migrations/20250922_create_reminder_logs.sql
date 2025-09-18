-- Idempotent
CREATE TABLE IF NOT EXISTS reminder_logs (
  id BIGSERIAL PRIMARY KEY,
  event_id TEXT NOT NULL,
  channel TEXT NOT NULL,
  recipient TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  hash TEXT NOT NULL UNIQUE
);

CREATE INDEX IF NOT EXISTS idx_reminder_logs_event_id ON reminder_logs(event_id);
