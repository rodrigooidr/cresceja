-- CresceJá consolidated database bootstrap
-- This script rebuilds the entire public schema required by the
-- backend services. It is idempotent and may be executed multiple times.
-- It is based on the migrations and the queries present in the source code.

SET client_min_messages = WARNING;
SET search_path = public, pg_catalog;

-- -----------------------------------------------------------------------------
-- Extensions and helper functions
-- -----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS plpgsql;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS citext;

CREATE OR REPLACE FUNCTION util_digits(text)
RETURNS text
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
AS $$ SELECT regexp_replace($1, '\\D', '', 'g') $$;

CREATE OR REPLACE FUNCTION util_email_lower(text)
RETURNS text
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
AS $$ SELECT lower($1) $$;

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION bump_conversation_last_message_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE conversations
     SET last_message_at = COALESCE(NEW.created_at, now()),
         updated_at      = now()
   WHERE id = NEW.conversation_id;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION sync_messages_status_from_event()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE messages SET status = NEW.status WHERE id = NEW.message_id;
  RETURN NEW;
END $$;

-- -----------------------------------------------------------------------------
-- Enumerated types used across the system
-- -----------------------------------------------------------------------------
CREATE TYPE IF NOT EXISTS instagram_media_type AS ENUM ('image','carousel','video');
CREATE TYPE IF NOT EXISTS instagram_publish_status AS ENUM ('pending','creating','ready','publishing','done','failed','canceled');
CREATE TYPE IF NOT EXISTS suggestion_status AS ENUM ('suggested','approved','scheduled','published','rejected');

-- -----------------------------------------------------------------------------
-- Core identity and access tables
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email citext NOT NULL UNIQUE,
  password_hash text,
  name text,
  org_id uuid,
  roles text[] NOT NULL DEFAULT ARRAY[]::text[],
  support_scopes text[] NOT NULL DEFAULT ARRAY[]::text[],
  perms jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_superadmin boolean NOT NULL DEFAULT false,
  is_support boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz
);

CREATE TABLE IF NOT EXISTS organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE,
  status text NOT NULL DEFAULT 'active',
  plan_id uuid,
  trial_ends_at timestamptz,
  email text,
  phone text,
  phone_e164 text,
  document_type text CHECK (document_type IN ('CNPJ','CPF')),
  document_value text,
  cnpj text,
  razao_social text,
  nome_fantasia text,
  ie text,
  ie_isento boolean DEFAULT false,
  site text,
  cep text,
  logradouro text,
  numero text,
  complemento text,
  bairro text,
  cidade text,
  uf text,
  country text DEFAULT 'BR',
  resp_nome text,
  resp_cpf text,
  resp_email text,
  resp_phone_e164 text,
  photo_url text,
  whatsapp_baileys_enabled boolean DEFAULT false,
  whatsapp_baileys_status text DEFAULT 'disabled',
  whatsapp_baileys_phone text,
  whatsapp_baileys_session_id text,
  whatsapp_mode text DEFAULT 'none',
  meta jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_organizations_status_created
  ON organizations (status, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS ux_orgs_email_lower
  ON organizations (util_email_lower(email)) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_orgs_phone_e164
  ON organizations (phone_e164) WHERE phone_e164 IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_orgs_document_digits
  ON organizations (util_digits(document_value))
  WHERE document_value IS NOT NULL;

CREATE TABLE IF NOT EXISTS org_users (
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'OrgViewer',
  perms jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, user_id)
);

CREATE TABLE IF NOT EXISTS user_orgs (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'OrgViewer',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, org_id)
);

CREATE TABLE IF NOT EXISTS support_audit_logs (
  id bigserial PRIMARY KEY,
  actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  target_org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  path text NOT NULL,
  method text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- Plans, features and billing entities
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text UNIQUE,
  price_cents integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'BRL',
  description text,
  ai_tokens_limit bigint NOT NULL DEFAULT 0,
  is_free boolean NOT NULL DEFAULT false,
  trial_days integer NOT NULL DEFAULT 14,
  billing_period_months integer NOT NULL DEFAULT 1,
  is_published boolean NOT NULL DEFAULT false,
  sort_order integer,
  modules jsonb NOT NULL DEFAULT '{}'::jsonb,
  id_legacy_text text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS plans_meta (
  plan_id uuid PRIMARY KEY REFERENCES plans(id) ON DELETE CASCADE,
  max_users integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS feature_defs (
  code text PRIMARY KEY,
  label text NOT NULL,
  type text NOT NULL,
  unit text,
  category text,
  sort_order integer,
  is_public boolean DEFAULT true,
  show_as_tick boolean DEFAULT false
);

CREATE TABLE IF NOT EXISTS plan_features (
  plan_id uuid NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  feature_code text NOT NULL REFERENCES feature_defs(code) ON DELETE CASCADE,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  ai_meter_code text REFERENCES feature_defs(code),
  ai_monthly_quota numeric CHECK (ai_monthly_quota >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (plan_id, feature_code)
);

CREATE TABLE IF NOT EXISTS plan_credits (
  plan_id uuid PRIMARY KEY REFERENCES plans(id) ON DELETE CASCADE,
  ai_attendance_monthly integer NOT NULL DEFAULT 0,
  ai_content_monthly integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS org_plan_history (
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('active','canceled','suspended','pending')),
  start_at timestamptz NOT NULL DEFAULT now(),
  end_at timestamptz,
  source text NOT NULL DEFAULT 'manual',
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, plan_id, start_at)
);

CREATE TABLE IF NOT EXISTS org_credits (
  id bigserial PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  feature_code text NOT NULL,
  delta integer NOT NULL,
  expires_at timestamptz,
  source text NOT NULL DEFAULT 'manual',
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_org_credits_org ON org_credits(org_id);
CREATE INDEX IF NOT EXISTS idx_org_credits_feature ON org_credits(feature_code);

CREATE OR REPLACE VIEW v_org_credits AS
SELECT
  org_id,
  feature_code,
  SUM(delta) AS remaining_total,
  MIN(expires_at) FILTER (WHERE expires_at IS NOT NULL AND expires_at >= now()) AS expires_next
FROM org_credits
GROUP BY org_id, feature_code;

CREATE TABLE IF NOT EXISTS org_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES plans(id) ON DELETE SET NULL,
  period text,
  trial_start timestamptz,
  trial_end timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  plan_id uuid REFERENCES plans(id) ON DELETE SET NULL,
  plan text,
  provider text,
  provider_subscription_id text,
  status text NOT NULL DEFAULT 'active',
  current_period_start timestamptz,
  current_period_end timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES subscriptions(id) ON DELETE SET NULL,
  amount_cents integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'BRL',
  status text NOT NULL DEFAULT 'pending',
  due_date date,
  paid_at timestamptz,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_invoices_org ON invoices(org_id, created_at DESC);

CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES subscriptions(id) ON DELETE SET NULL,
  amount_cents integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  paid_at timestamptz,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payments_org_created ON payments(org_id, created_at DESC);

CREATE TABLE IF NOT EXISTS purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  item text NOT NULL,
  amount_cents integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_purchases_org_created ON purchases(org_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- AI configuration and telemetry
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ai_meters (
  code text PRIMARY KEY,
  name text NOT NULL,
  unit text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_usage (
  id bigserial PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  meter_code text NOT NULL REFERENCES ai_meters(code) ON DELETE CASCADE,
  qty numeric NOT NULL CHECK (qty >= 0),
  source text NOT NULL DEFAULT 'system',
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_usage_org_meter ON ai_usage(org_id, meter_code, created_at);

CREATE TABLE IF NOT EXISTS ai_credit_usage (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category text NOT NULL,
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  used integer NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, category, period_start)
);

CREATE TABLE IF NOT EXISTS ai_usage_logs (
  id bigserial PRIMARY KEY,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  service text NOT NULL,
  tokens integer NOT NULL DEFAULT 0,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_created ON ai_usage_logs(created_at);

CREATE TABLE IF NOT EXISTS ai_guardrail_violations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  channel text,
  intent text,
  rule text NOT NULL,
  message text,
  input_excerpt text,
  output_excerpt text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_guardrail_violations_org_created
  ON ai_guardrail_violations(org_id, created_at DESC);

CREATE TABLE IF NOT EXISTS org_ai_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
  profile jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS org_ai_settings (
  org_id uuid PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS telemetry_events (
  id bigserial PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  source text NOT NULL,
  event_key text NOT NULL,
  value_num numeric,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_te_org_time ON telemetry_events(org_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_te_key ON telemetry_events(event_key);

CREATE TABLE IF NOT EXISTS telemetry_kpis_daily (
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  day date NOT NULL,
  metric text NOT NULL,
  value numeric NOT NULL,
  PRIMARY KEY (org_id, day, metric)
);

-- -----------------------------------------------------------------------------
-- Integrations and OAuth tokens
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS meta_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid UNIQUE NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  token text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS org_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider text NOT NULL,
  status text NOT NULL DEFAULT 'disconnected',
  subscribed boolean NOT NULL DEFAULT false,
  creds jsonb NOT NULL DEFAULT '{}'::jsonb,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, provider)
);

CREATE TABLE IF NOT EXISTS org_integration_logs (
  id bigserial PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider text NOT NULL,
  event text NOT NULL,
  ok boolean NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS integration_events (
  id bigserial PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider text NOT NULL,
  event_type text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  received_at timestamptz NOT NULL DEFAULT now()
);

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
CREATE INDEX IF NOT EXISTS idx_gcal_accounts_org ON google_calendar_accounts(org_id);

CREATE TABLE IF NOT EXISTS google_oauth_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES google_calendar_accounts(id) ON DELETE CASCADE,
  access_token text NOT NULL,
  refresh_token text,
  expiry timestamptz,
  scopes text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id)
);

CREATE TABLE IF NOT EXISTS whatsapp_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('baileys','api')),
  phone_e164 text NOT NULL,
  display_name text,
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, phone_e164)
);

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
  enc_ver smallint NOT NULL DEFAULT 1,
  scopes text[],
  expiry timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (page_id)
);

CREATE TABLE IF NOT EXISTS instagram_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  ig_user_id text NOT NULL,
  username text,
  name text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, ig_user_id)
);

CREATE TABLE IF NOT EXISTS instagram_oauth_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES instagram_accounts(id) ON DELETE CASCADE,
  access_token text NOT NULL,
  enc_ver smallint NOT NULL DEFAULT 1,
  scopes text[],
  expiry timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id)
);

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
  client_dedupe_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, account_id, client_dedupe_key)
    WHERE status IN ('pending','creating','publishing')
);
CREATE INDEX IF NOT EXISTS idx_instagram_jobs_org ON instagram_publish_jobs(org_id);
CREATE INDEX IF NOT EXISTS idx_instagram_jobs_status ON instagram_publish_jobs(status);

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
  client_dedupe_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, page_id, client_dedupe_key)
    WHERE status IN ('pending','creating','publishing')
);
CREATE INDEX IF NOT EXISTS idx_fb_jobs_org_sched ON facebook_publish_jobs(org_id, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_fb_jobs_status ON facebook_publish_jobs(status);

CREATE TABLE IF NOT EXISTS channel_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('facebook','instagram')),
  external_account_id text NOT NULL,
  name text,
  username text,
  access_token_enc text,
  token_expires_at timestamptz,
  webhook_subscribed boolean DEFAULT false,
  permissions_json jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, channel, external_account_id)
);

-- -----------------------------------------------------------------------------
-- Channel + inbox core tables
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('whatsapp','facebook','instagram')),
  mode text NOT NULL CHECK (mode IN ('cloud','session','api','baileys')),
  status text NOT NULL DEFAULT 'disconnected'
    CHECK (status IN ('disconnected','connecting','connected','error')),
  name text,
  kind text,
  config jsonb DEFAULT '{}'::jsonb,
  secrets jsonb DEFAULT '{}'::jsonb,
  webhook_secret text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, type)
);
CREATE INDEX IF NOT EXISTS idx_channels_org ON channels(org_id);

CREATE TABLE IF NOT EXISTS contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider_user_id text,
  name text,
  display_name text,
  first_name text,
  cpf text,
  phone text,
  phone_e164 text,
  email text,
  birthdate date,
  photo_url text,
  photo_asset_id uuid,
  tags text[] NOT NULL DEFAULT ARRAY[]::text[],
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, phone_e164) WHERE phone_e164 IS NOT NULL,
  UNIQUE (org_id, lower(email)) WHERE email IS NOT NULL,
  UNIQUE (org_id, util_digits(cpf)) WHERE cpf IS NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_contacts_org ON contacts(org_id);

CREATE TABLE IF NOT EXISTS contact_identities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('facebook','instagram','whatsapp')),
  account_id uuid REFERENCES channel_accounts(id) ON DELETE SET NULL,
  identity text NOT NULL,
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, channel, account_id, identity)
);

CREATE TABLE IF NOT EXISTS tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, lower(name))
);

CREATE TABLE IF NOT EXISTS contact_tags (
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (contact_id, tag_id)
);

CREATE TABLE IF NOT EXISTS clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  name text,
  company_name text,
  email text,
  phone text,
  phone_e164 text,
  cpf text,
  cnpj text,
  status text,
  contract_url text,
  active boolean DEFAULT false,
  start_date date,
  end_date date,
  plan_id uuid REFERENCES plans(id) ON DELETE SET NULL,
  modules jsonb,
  tags text[] DEFAULT ARRAY[]::text[],
  responsavel text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_clients_org_email
  ON clients(org_id, lower(email)) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_clients_org_phone
  ON clients(org_id, phone_e164) WHERE phone_e164 IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_clients_org_cpf
  ON clients(org_id, util_digits(cpf)) WHERE cpf IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_clients_org_cnpj
  ON clients(org_id, util_digits(cnpj)) WHERE cnpj IS NOT NULL;

CREATE TABLE IF NOT EXISTS usage_counters (
  id bigserial PRIMARY KEY,
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE,
  module_key text NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  used bigint NOT NULL DEFAULT 0,
  quota bigint,
  UNIQUE (client_id, module_key, period_start, period_end)
);

CREATE TABLE IF NOT EXISTS leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  nome text,
  email text,
  telefone text,
  phone text,
  phone_e164 text,
  status text NOT NULL DEFAULT 'novo',
  source_channel text,
  origem text,
  consent boolean NOT NULL DEFAULT false,
  score integer NOT NULL DEFAULT 0,
  tags text[] NOT NULL DEFAULT ARRAY[]::text[],
  responsavel text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  erased_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_leads_email ON leads(email) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_leads_phone ON leads(phone_e164) WHERE phone_e164 IS NOT NULL;

CREATE TABLE IF NOT EXISTS channel_id_map (
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  channel_type text NOT NULL,
  external_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (channel_type, external_id)
);

CREATE TABLE IF NOT EXISTS crm_opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES leads(id) ON DELETE SET NULL,
  client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
  title text NOT NULL DEFAULT 'Oportunidade',
  cliente text,
  valor_estimado numeric(14,2),
  responsavel text,
  stage text NOT NULL DEFAULT 'novo',
  status text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_crm_opportunities_lead ON crm_opportunities(lead_id);

CREATE TABLE IF NOT EXISTS opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES leads(id) ON DELETE SET NULL,
  cliente text NOT NULL,
  valor_estimado numeric(12,2) DEFAULT 0,
  responsavel text,
  status text NOT NULL DEFAULT 'prospeccao',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS org_settings (
  org_id uuid PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  ai_enabled boolean NOT NULL DEFAULT true,
  ai_handoff_keywords text[] NOT NULL DEFAULT ARRAY['humano','atendente','pessoa'],
  ai_max_turns_before_handoff integer DEFAULT 10,
  templates_enabled_channels text[] NOT NULL DEFAULT ARRAY['whatsapp','instagram','facebook'],
  business_hours jsonb,
  alert_volume numeric DEFAULT 0.8,
  alert_sound text DEFAULT '/assets/sounds/alert.mp3',
  allow_baileys boolean NOT NULL DEFAULT false,
  whatsapp_active_mode text NOT NULL DEFAULT 'none'
    CHECK (whatsapp_active_mode IN ('none','baileys','api')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
  channel_id uuid REFERENCES channels(id) ON DELETE SET NULL,
  channel text,
  account_id uuid,
  external_user_id text,
  external_thread_id text,
  chat_id text,
  transport text,
  status text NOT NULL DEFAULT 'pending',
  assigned_to uuid REFERENCES users(id) ON DELETE SET NULL,
  is_ai_active boolean NOT NULL DEFAULT true,
  ai_status text DEFAULT 'bot',
  unread_count integer NOT NULL DEFAULT 0,
  last_message_at timestamptz,
  human_requested_at timestamptz,
  alert_sent boolean NOT NULL DEFAULT false,
  handoff_ack_at timestamptz,
  handoff_ack_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, channel, account_id, external_user_id)
);
CREATE INDEX IF NOT EXISTS idx_conversations_org_last ON conversations(org_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_contact ON conversations(contact_id);

CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES leads(id) ON DELETE SET NULL,
  author_id uuid REFERENCES users(id) ON DELETE SET NULL,
  sender_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  direction text,
  sender text,
  sender_type text,
  "from" text,
  provider text,
  external_message_id text,
  provider_message_id text,
  type text DEFAULT 'text',
  text text,
  body text,
  attachments jsonb DEFAULT '[]'::jsonb,
  attachments_json jsonb,
  status text,
  emojis_json jsonb,
  transcript text,
  meta jsonb DEFAULT '{}'::jsonb,
  raw_json jsonb,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, external_message_id) WHERE external_message_id IS NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_messages_conv_created ON messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_org ON messages(org_id);
CREATE INDEX IF NOT EXISTS idx_messages_external ON messages(external_message_id);

CREATE TABLE IF NOT EXISTS message_status_events (
  id bigserial PRIMARY KEY,
  message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  status text NOT NULL,
  error jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_message_status_events ON message_status_events(message_id, created_at);

CREATE TABLE IF NOT EXISTS message_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  idx integer NOT NULL DEFAULT 0,
  asset_id uuid,
  kind text,
  name text,
  file_name text,
  mime text,
  size_bytes bigint,
  width integer,
  height integer,
  duration_ms integer,
  checksum_sha256 text,
  storage_provider text,
  path_or_key text,
  thumbnail_key text,
  poster_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, idx)
);

CREATE TABLE IF NOT EXISTS message_transcripts (
  id bigserial PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  text text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS message_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  channel_scope text[] NOT NULL DEFAULT ARRAY[]::text[],
  language text,
  body text NOT NULL,
  type text DEFAULT 'text',
  meta jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS quick_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- Marketing, email and social content
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS content_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  url text NOT NULL,
  mime text NOT NULL,
  width integer,
  height integer,
  meta_json jsonb,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_content_assets_org ON content_assets(org_id);

CREATE TABLE IF NOT EXISTS posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text,
  status text NOT NULL DEFAULT 'draft',
  channel text,
  scheduled_at timestamptz,
  published_at timestamptz,
  media jsonb,
  metadata jsonb,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  approved_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS post_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  approver_id uuid REFERENCES users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS content_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title text NOT NULL,
  month_ref date NOT NULL,
  default_targets jsonb NOT NULL DEFAULT '{}'::jsonb,
  strategy_json jsonb,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_content_campaigns_org_month ON content_campaigns(org_id, month_ref);

CREATE TABLE IF NOT EXISTS content_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES content_campaigns(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  date date NOT NULL,
  time time with time zone,
  channel_targets jsonb NOT NULL DEFAULT '{}'::jsonb,
  status suggestion_status NOT NULL DEFAULT 'suggested',
  copy_json jsonb,
  asset_refs jsonb,
  ai_prompt_json jsonb,
  reasoning_json jsonb,
  approved_by uuid REFERENCES users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  published_at timestamptz,
  jobs_map jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_content_suggestions_campaign ON content_suggestions(campaign_id);
CREATE INDEX IF NOT EXISTS idx_content_suggestions_org_date ON content_suggestions(org_id, date);

CREATE TABLE IF NOT EXISTS social_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  post_id uuid REFERENCES posts(id) ON DELETE SET NULL,
  channel_id uuid REFERENCES channels(id) ON DELETE SET NULL,
  scheduled_at timestamptz,
  published_at timestamptz,
  status text DEFAULT 'scheduled',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS repurpose_jobs (
  post_id uuid PRIMARY KEY REFERENCES posts(id) ON DELETE CASCADE,
  status text NOT NULL,
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS email_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  subject text,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS email_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  list_id uuid REFERENCES email_lists(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  email text,
  status text NOT NULL DEFAULT 'subscribed',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS email_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  template_id uuid REFERENCES email_templates(id) ON DELETE SET NULL,
  list_id uuid REFERENCES email_lists(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft',
  scheduled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS email_campaign_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES email_campaigns(id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES email_subscriptions(id) ON DELETE SET NULL,
  email text NOT NULL,
  status text DEFAULT 'queued',
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS email_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  campaign_id uuid REFERENCES email_campaigns(id) ON DELETE SET NULL,
  recipient_id uuid REFERENCES email_campaign_recipients(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  event_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS email_automations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text,
  template_id uuid REFERENCES email_templates(id) ON DELETE SET NULL,
  segment_id uuid,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS email_automation_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id uuid NOT NULL REFERENCES email_automations(id) ON DELETE CASCADE,
  step_order integer NOT NULL,
  kind text NOT NULL,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS email_suppressions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email text NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, lower(email))
);

CREATE TABLE IF NOT EXISTS segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  filter jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- Calendar and agenda
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS calendars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text,
  kind text NOT NULL DEFAULT 'activity',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS calendar_members (
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  calendar_id uuid NOT NULL REFERENCES calendars(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role text DEFAULT 'member',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, calendar_id, user_id)
);

CREATE TABLE IF NOT EXISTS calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  calendar_id uuid REFERENCES calendars(id) ON DELETE SET NULL,
  type text NOT NULL DEFAULT 'meeting',
  title text,
  summary text,
  description text,
  service_name text,
  client_name text,
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  provider text,
  external_event_id text,
  calendar_provider_id text,
  calendar_external_id text,
  reminder_sent boolean NOT NULL DEFAULT false,
  reminder_sent_at timestamptz,
  reminders_count integer NOT NULL DEFAULT 0,
  rsvp_status text DEFAULT 'pending'
    CHECK (rsvp_status IN ('pending','confirmed','canceled','noshow')),
  rsvp_token text,
  confirmed_at timestamptz,
  canceled_at timestamptz,
  noshow_at timestamptz,
  attendee_id uuid,
  contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  opportunity_id uuid REFERENCES crm_opportunities(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_calendar_events_org_start ON calendar_events(org_id, start_at);

CREATE TABLE IF NOT EXISTS reminder_logs (
  id bigserial PRIMARY KEY,
  event_id text NOT NULL,
  channel text NOT NULL,
  recipient text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  hash text NOT NULL UNIQUE
);

-- -----------------------------------------------------------------------------
-- Governance, rewards and NPS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
  id bigserial PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity text,
  entity_id uuid,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

CREATE TABLE IF NOT EXISTS lgpd_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES leads(id) ON DELETE CASCADE,
  consent boolean NOT NULL,
  purpose text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lgpd_erasure_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES leads(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS nps_surveys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE,
  title text,
  sent_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_nps_surveys_client ON nps_surveys(client_id);

CREATE TABLE IF NOT EXISTS nps_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid REFERENCES nps_surveys(id) ON DELETE CASCADE,
  client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
  score integer NOT NULL CHECK (score BETWEEN 0 AND 10),
  comment text,
  responded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_nps_responses_survey ON nps_responses(survey_id);

CREATE TABLE IF NOT EXISTS rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE,
  type text NOT NULL,
  value text,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rewards_client ON rewards(client_id);

CREATE TABLE IF NOT EXISTS onboarding_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE,
  contrato boolean DEFAULT false,
  assinatura boolean DEFAULT false,
  nota_fiscal boolean DEFAULT false,
  treinamento boolean DEFAULT false,
  status text DEFAULT 'pending',
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_onboarding_tasks_client ON onboarding_tasks(client_id);

-- -----------------------------------------------------------------------------
-- Miscellaneous support tables
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS org_features (
  org_id uuid PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  features jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_org_features_gin ON org_features USING GIN (features);

CREATE TABLE IF NOT EXISTS kb_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  source_type text NOT NULL,
  uri text NOT NULL,
  lang text,
  active boolean NOT NULL DEFAULT true,
  title text,
  tags jsonb,
  checksum text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  owner_type text,
  owner_id uuid,
  file_name text,
  mime_type text,
  size_bytes bigint,
  url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS inbox_idempotency (
  key text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  ttl timestamptz
);

CREATE TABLE IF NOT EXISTS inbox_audit_events (
  id bigserial PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES users(id) ON DELETE SET NULL,
  action text NOT NULL,
  target_type text,
  target_id uuid,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS inbox_ai_flags (
  id bigserial PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES conversations(id) ON DELETE CASCADE,
  flag text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  subject text,
  description text,
  status text DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS import_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  kind text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  stats jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS usage_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- Triggers
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  rec record;
BEGIN
  FOR rec IN
    SELECT table_name
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND column_name = 'updated_at'
  LOOP
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE UPDATE ON %I
         FOR EACH ROW EXECUTE FUNCTION set_updated_at()'
      , rec.table_name || '_set_updated_at', rec.table_name
    );
  END LOOP;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER messages_after_insert_bump_last
    AFTER INSERT ON messages
    FOR EACH ROW EXECUTE FUNCTION bump_conversation_last_message_at();
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER mse_after_insert_sync_status
    AFTER INSERT ON message_status_events
    FOR EACH ROW EXECUTE FUNCTION sync_messages_status_from_event();
EXCEPTION WHEN others THEN NULL; END $$;

-- -----------------------------------------------------------------------------
-- Seed data for development
-- -----------------------------------------------------------------------------
INSERT INTO plans (id, name, code, price_cents, currency, ai_tokens_limit, is_free, trial_days, billing_period_months)
VALUES
  ('d085fd00-16ea-4e24-abb0-69021a8b3c7e','Starter','starter',7900,'BRL',10000,false,14,1),
  ('a4a7f5f3-8615-4b02-9334-7adfeb0e76e3','Pro','pro',19900,'BRL',50000,false,14,1)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  code = EXCLUDED.code,
  price_cents = EXCLUDED.price_cents,
  currency = EXCLUDED.currency,
  ai_tokens_limit = EXCLUDED.ai_tokens_limit;

INSERT INTO feature_defs (code, label, type, unit, category, sort_order, is_public)
VALUES
  ('facebook_publish_daily_quota','Facebook – Publicações por dia','number','count','social',33,true)
ON CONFLICT (code) DO UPDATE SET
  label = EXCLUDED.label,
  type = EXCLUDED.type,
  unit = EXCLUDED.unit,
  category = EXCLUDED.category,
  sort_order = EXCLUDED.sort_order,
  is_public = EXCLUDED.is_public;

INSERT INTO organizations (id, name)
SELECT '8f181879-2f22-4831-967a-31c892f271bb','CresceJá DEV'
WHERE NOT EXISTS (
  SELECT 1 FROM organizations WHERE id = '8f181879-2f22-4831-967a-31c892f271bb'
);

INSERT INTO users (id, email, password_hash, name, org_id, roles, is_superadmin)
SELECT
  'cdbdc333-87d6-4dda-9726-a77f20609b75',
  'rodrigooidr@hotmail.com',
  '$2b$10$5xw1u5vGg6Kc2w3hO7jZae4F9a4mB1Q2mO0m3vV2a0b9b3l5uQH1W',
  'Rodrigo Oliveira',
  '8f181879-2f22-4831-967a-31c892f271bb',
  ARRAY['OrgOwner','SuperAdmin'],
  true
WHERE NOT EXISTS (
  SELECT 1 FROM users WHERE id = 'cdbdc333-87d6-4dda-9726-a77f20609b75'
);

INSERT INTO org_users (org_id, user_id, role)
SELECT '8f181879-2f22-4831-967a-31c892f271bb','cdbdc333-87d6-4dda-9726-a77f20609b75','OrgOwner'
ON CONFLICT DO NOTHING;

