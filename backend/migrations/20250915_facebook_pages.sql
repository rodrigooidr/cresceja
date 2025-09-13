CREATE TABLE IF NOT EXISTS facebook_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  page_id text NOT NULL,
  name text,
  category text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, page_id)
);

CREATE TABLE IF NOT EXISTS facebook_oauth_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id uuid NOT NULL REFERENCES facebook_pages(id) ON DELETE CASCADE,
  access_token text NOT NULL,
  enc_ver int2 NOT NULL DEFAULT 1,
  scopes text[],
  expiry timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (page_id)
);

CREATE INDEX IF NOT EXISTS ix_fb_pages_org ON facebook_pages(org_id);
