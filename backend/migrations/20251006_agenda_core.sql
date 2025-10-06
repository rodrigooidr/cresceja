-- professionals
CREATE TABLE IF NOT EXISTS professionals (
  id UUID PRIMARY KEY,
  org_id UUID NOT NULL,
  name TEXT NOT NULL,
  role TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  default_event_duration_min INT DEFAULT 30,
  timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
  color_tag TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- calendar_accounts
CREATE TABLE IF NOT EXISTS calendar_accounts (
  id UUID PRIMARY KEY,
  org_id UUID NOT NULL,
  professional_id UUID,
  provider TEXT NOT NULL CHECK (provider='google'),
  google_account_email TEXT,
  oauth_access_token TEXT,
  oauth_refresh_token TEXT,
  oauth_expiry TIMESTAMPTZ,
  scopes TEXT[],
  sync_token TEXT,
  watch_channel_id TEXT,
  watch_resource_id TEXT,
  watch_expiration TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- calendars
CREATE TABLE IF NOT EXISTS calendars (
  id UUID PRIMARY KEY,
  calendar_account_id UUID NOT NULL REFERENCES calendar_accounts(id) ON DELETE CASCADE,
  google_calendar_id TEXT NOT NULL,
  primary BOOLEAN NOT NULL DEFAULT FALSE,
  name TEXT,
  time_zone TEXT,
  visibility TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

-- appointment_types
CREATE TABLE IF NOT EXISTS appointment_types (
  id UUID PRIMARY KEY,
  org_id UUID NOT NULL,
  name TEXT NOT NULL,
  duration_min INT NOT NULL,
  buffer_before_min INT NOT NULL DEFAULT 0,
  buffer_after_min INT NOT NULL DEFAULT 0,
  location_type TEXT NOT NULL CHECK (location_type IN ('onsite','online')),
  price NUMERIC(12,2),
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

-- appointments
CREATE TABLE IF NOT EXISTS appointments (
  id UUID PRIMARY KEY,
  org_id UUID NOT NULL,
  professional_id UUID NOT NULL,
  contact_id UUID,
  appointment_type_id UUID,
  channel_type TEXT CHECK (channel_type IN ('whatsapp','instagram','facebook','email','other')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','proposed','booked','confirmed','rescheduled','cancelled','no_show')),
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  time_zone TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
  location_text TEXT,
  google_event_id TEXT,
  google_calendar_id TEXT,
  notes TEXT,
  created_by TEXT NOT NULL DEFAULT 'agent' CHECK (created_by IN ('agent','human','system')),
  created_via TEXT NOT NULL DEFAULT 'ui' CHECK (created_via IN ('ai','ui')),
  audit_trace JSONB NOT NULL DEFAULT '[]'::jsonb,
  conversation_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- appointment_messages
CREATE TABLE IF NOT EXISTS appointment_messages (
  id UUID PRIMARY KEY,
  appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('out','in')),
  message_text TEXT,
  channel_message_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- contacts (extensões)
ALTER TABLE IF EXISTS contacts ADD COLUMN IF NOT EXISTS preferred_period TEXT CHECK (preferred_period IN ('morning','afternoon','evening'));
ALTER TABLE IF EXISTS contacts ADD COLUMN IF NOT EXISTS consent_whatsapp BOOLEAN;

-- Índices recomendados
CREATE INDEX IF NOT EXISTS idx_appt_org_prof_start ON appointments(org_id, professional_id, start_at);
CREATE INDEX IF NOT EXISTS idx_appt_google_event ON appointments(google_event_id);
CREATE INDEX IF NOT EXISTS idx_appt_contact_start ON appointments(contact_id, start_at);
