CREATE TABLE IF NOT EXISTS facebook_publish_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  page_id uuid NOT NULL REFERENCES facebook_pages(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('text','link','image','multi_image','video')),
  message text,
  link text,
  media jsonb,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','creating','ready','publishing','done','failed','canceled')),
  error text,
  scheduled_at timestamptz,
  published_post_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  client_dedupe_key text
);

CREATE INDEX IF NOT EXISTS ix_fb_jobs_org_sched ON facebook_publish_jobs(org_id, scheduled_at);
CREATE INDEX IF NOT EXISTS ix_fb_jobs_status ON facebook_publish_jobs(status);

CREATE UNIQUE INDEX IF NOT EXISTS ux_fb_jobs_dedupe
  ON facebook_publish_jobs(org_id, page_id, client_dedupe_key)
  WHERE status IN ('pending','creating','publishing');
