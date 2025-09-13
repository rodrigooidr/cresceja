CREATE TABLE IF NOT EXISTS instagram_oauth_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES instagram_accounts(id) ON DELETE CASCADE,
  access_token text NOT NULL,
  enc_ver smallint NOT NULL DEFAULT 1,
  scopes text[],
  expiry timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_instagram_tokens_account ON instagram_oauth_tokens(account_id);
