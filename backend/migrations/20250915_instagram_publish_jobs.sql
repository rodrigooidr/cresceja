CREATE TYPE IF NOT EXISTS instagram_media_type AS ENUM ('image','carousel','video');
CREATE TYPE IF NOT EXISTS instagram_publish_status AS ENUM ('pending','creating','ready','publishing','done','failed','canceled');

CREATE TABLE IF NOT EXISTS instagram_publish_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES instagram_accounts(id) ON DELETE CASCADE,
  type instagram_media_type NOT NULL,
  caption text,
  media jsonb,
  status instagram_publish_status NOT NULL DEFAULT 'pending',
  scheduled_at timestamptz,
  creation_id text,
  published_media_id text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_instagram_jobs_org ON instagram_publish_jobs(org_id);
CREATE INDEX IF NOT EXISTS ix_instagram_jobs_scheduled ON instagram_publish_jobs(scheduled_at);
CREATE INDEX IF NOT EXISTS ix_instagram_jobs_status ON instagram_publish_jobs(status);
