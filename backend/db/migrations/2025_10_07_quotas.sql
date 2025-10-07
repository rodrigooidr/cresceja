-- Instagram / Facebook publish jobs: created_at para cotas diárias
ALTER TABLE IF EXISTS instagram_publish_jobs
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
CREATE INDEX IF NOT EXISTS idx_instagram_publish_jobs_created_at
  ON instagram_publish_jobs (created_at);

ALTER TABLE IF EXISTS facebook_publish_jobs
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
CREATE INDEX IF NOT EXISTS idx_facebook_publish_jobs_created_at
  ON facebook_publish_jobs (created_at);

-- Garantia de is_active (idempotente) e índice por org/ativo
ALTER TABLE IF EXISTS instagram_accounts
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
CREATE INDEX IF NOT EXISTS idx_instagram_accounts_active
  ON instagram_accounts (org_id, is_active);
