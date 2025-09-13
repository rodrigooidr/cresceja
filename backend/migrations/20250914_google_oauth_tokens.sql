CREATE TABLE IF NOT EXISTS google_oauth_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES google_calendar_accounts(id) ON DELETE CASCADE,
  access_token text NOT NULL,
  refresh_token text,
  expiry timestamptz,
  scopes text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_gcal_tokens_account ON google_oauth_tokens(account_id);
