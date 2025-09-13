CREATE TABLE IF NOT EXISTS google_calendar_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  google_user_id text NOT NULL,
  email text,
  display_name text,
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, google_user_id)
);

CREATE INDEX IF NOT EXISTS ix_gcal_accounts_org ON google_calendar_accounts(org_id);
