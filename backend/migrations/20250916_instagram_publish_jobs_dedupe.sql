ALTER TABLE instagram_publish_jobs
  ADD COLUMN IF NOT EXISTS client_dedupe_key text;

CREATE UNIQUE INDEX IF NOT EXISTS ux_ig_jobs_dedupe
  ON instagram_publish_jobs(org_id, account_id, client_dedupe_key)
  WHERE status IN ('pending','creating','publishing');
