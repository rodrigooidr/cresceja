DROP TABLE IF EXISTS audit_logs;
CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  user_email TEXT,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  payload JSONB
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity);
