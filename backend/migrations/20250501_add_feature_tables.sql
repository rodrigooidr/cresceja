CREATE TABLE IF NOT EXISTS whatsapp_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('baileys','api')),
  phone_e164 text NOT NULL,
  display_name text,
  is_active boolean NOT NULL DEFAULT false,
  UNIQUE (org_id, phone_e164)
);

CREATE TABLE IF NOT EXISTS google_calendar_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  google_user_id text NOT NULL,
  email text,
  display_name text,
  is_active boolean NOT NULL DEFAULT false,
  UNIQUE (org_id, google_user_id)
);
