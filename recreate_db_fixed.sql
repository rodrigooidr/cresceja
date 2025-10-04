
-- ============================================================================
-- FOUNDATION: extensions, helper functions, and base catalogs
-- ============================================================================
SET client_min_messages TO WARNING;
SET search_path = public, pg_catalog;

CREATE EXTENSION IF NOT EXISTS plpgsql WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Helper funcs used across indexes/migrations
CREATE OR REPLACE FUNCTION public.util_digits(text) RETURNS text
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE AS $$ SELECT regexp_replace($1, '\D', '', 'g') $$;

CREATE OR REPLACE FUNCTION public.util_email_lower(text) RETURNS text
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE AS $$ SELECT lower($1) $$;

-- updated_at trigger helpers
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW IS DISTINCT FROM OLD THEN
    NEW.updated_at := NOW();
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.set_timestamp() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW IS DISTINCT FROM OLD THEN
    NEW.updated_at := NOW();
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.tg_set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW IS DISTINCT FROM OLD THEN
    NEW.updated_at := NOW();
  END IF;
  RETURN NEW;
END $$;

-- Inbox helpers used later
CREATE OR REPLACE FUNCTION public.bump_conversation_last_message_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.conversations
     SET last_message_at = COALESCE(NEW.created_at, now())
   WHERE id = NEW.conversation_id;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.sync_messages_status_from_event() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.messages SET status = NEW.status WHERE id = NEW.message_id;
  RETURN NEW;
END $$;

-- Base tables frequently referenced; create minimal shape if missing
CREATE TABLE IF NOT EXISTS public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  slug text UNIQUE,
  status text,
  plan_id uuid,
  trial_ends_at timestamptz,
  email text,
  phone text,
  phone_e164 text,
  document_type text,
  document_value text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  code text UNIQUE,
  price_cents integer DEFAULT 0,
  ai_tokens_limit bigint NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  id_legacy_text text
);

CREATE TABLE IF NOT EXISTS public.plan_features (
  plan_id uuid NOT NULL,
  feature_code text NOT NULL,
  value jsonb,
  ai_meter_code text,
  ai_monthly_quota numeric CHECK (ai_monthly_quota >= 0),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY(plan_id, feature_code)
);

CREATE TABLE IF NOT EXISTS public.feature_defs (
  code text PRIMARY KEY,
  label text,
  type text,
  unit text,
  category text,
  sort_order int,
  is_public boolean,
  show_as_tick boolean
);

-- contacts/clients/tags commonly referenced by views & indexes
CREATE TABLE IF NOT EXISTS public.contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  display_name text,
  name text,
  phone text,
  phone_e164 text,
  email text,
  cpf text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  email text,
  phone_e164 text,
  cpf text,
  cnpj text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  name text NOT NULL
);

CREATE TABLE IF NOT EXISTS public.contact_tags (
  contact_id uuid NOT NULL,
  org_id uuid NOT NULL,
  tag_id uuid NOT NULL
);

-- Conversations/messages minimal to satisfy FKs and triggers later
CREATE TABLE IF NOT EXISTS public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  contact_id uuid,
  channel text,
  account_id uuid,
  status text,
  ai_enabled boolean DEFAULT true,
  unread_count int DEFAULT 0,
  chat_id text,
  transport text,
  last_message_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid,
  conversation_id uuid,
  direction text,
  provider text,
  external_message_id text,
  provider_msg_id text,
  type text,
  text text,
  attachments jsonb DEFAULT '[]'::jsonb,
  meta jsonb DEFAULT '{}'::jsonb,
  raw_json jsonb,
  status text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);


-- ===== ORIGINAL (sanitized) CONTENT BELOW =====
-- Recreated DB from provided migrations.zip + prior index bootstrap
-- Generated at runtime.
SET client_min_messages TO WARNING;
SET search_path = public, pg_catalog;

-- Recommended extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";



-- ===== BEGIN FILE: migrations/2025-09-29_organizations_and_plan_credits.sql =====
BEGIN;
-- organizations
CREATE TABLE IF NOT EXISTS public.organizations (
  id uuid PRIMARY KEY,
  name text,
  slug text UNIQUE,
  status text,
  plan_id uuid NULL,
  trial_ends_at timestamptz NULL,
  email text,
  phone text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname='public' AND indexname='organizations_status_created_idx'
  ) THEN
    CREATE INDEX organizations_status_created_idx
      ON public.organizations (status, created_at DESC);
  END IF;
END $$;

-- plano/creditos
CREATE TABLE IF NOT EXISTS public.plans (
  id uuid PRIMARY KEY,
  name text,
  code text UNIQUE,
  price_cents integer DEFAULT 0,
  ai_tokens_limit bigint NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS code text UNIQUE,
  ADD COLUMN IF NOT EXISTS ai_tokens_limit bigint NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.org_members (
  org_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role text,
  PRIMARY KEY (org_id, user_id)
);

-- seeds coerentes com plan_id das suas orgs
INSERT INTO public.plans (id, name, code)
VALUES
  ('d085fd00-16ea-4e24-abb0-69021a8b3c7e','Starter','starter'),
  ('a4a7f5f3-8615-4b02-9334-7adfeb0e76e3','Pro','pro')
ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, code=EXCLUDED.code;
COMMIT;
-- ===== END FILE =====


-- ===== BEGIN FILE: migrations/2025-10-01_enable_unaccent.sql =====
BEGIN;
-- Habilita extensões usadas por buscas acentuadas/semelhantes
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
COMMIT;
-- ===== END FILE =====


-- ===== BEGIN FILE: migrations/20250219_meta_tokens.sql =====
BEGIN;
-- ensures meta_tokens exists for storing Meta OAuth tokens
CREATE TABLE IF NOT EXISTS public.meta_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid UNIQUE NOT NULL,
  token text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_meta_tokens_org ON public.meta_tokens(org_id);
COMMIT;
-- ===== END FILE =====


-- ===== BEGIN FILE: migrations/20250501_add_feature_tables.sql =====
BEGIN;
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
COMMIT;
-- ===== END FILE =====


-- ===== BEGIN FILE: migrations/20250824_inbox_omni.sql =====
BEGIN;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- timestamps automáticos
DO $$ BEGIN
  CREATE OR REPLACE FUNCTION set_timestamp()
  RETURNS TRIGGER AS $$
  BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;
EXCEPTION WHEN others THEN NULL; END $$;

-- contacts
CREATE TABLE IF NOT EXISTS contacts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id uuid NOT NULL,
  provider_user_id text,
  name text,
  first_name text,
  cpf text,
  phone_e164 text,
  email text,
  birthdate date,
  photo_url text,
  tags text[] DEFAULT '{}',
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- conversations
CREATE TABLE IF NOT EXISTS conversations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id uuid NOT NULL,
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('whatsapp','instagram','facebook')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','assigned','waiting_customer','resolved')),
  assigned_to uuid,
  ai_enabled boolean NOT NULL DEFAULT true,
  unread_count int NOT NULL DEFAULT 0,
  last_message_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- messages
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id uuid NOT NULL,
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  "from" text NOT NULL CHECK ("from" IN ('customer','agent','ai')),
  provider text NOT NULL CHECK (provider IN ('wa','ig','fb')),
  provider_message_id text,
  type text NOT NULL CHECK (type IN ('text','image','video','audio','file','sticker','template')),
  text text,
  emojis_json jsonb,
  attachments jsonb,
  status text CHECK (status IN ('sent','delivered','read','failed')),
  transcript text,
  meta jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- attachments
CREATE TABLE IF NOT EXISTS attachments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id uuid NOT NULL,
  message_id uuid REFERENCES messages(id) ON DELETE CASCADE,
  kind text CHECK (kind IN ('image','video','audio','file')),
  storage_key text,
  mime text,
  size_bytes bigint,
  width int,
  height int,
  duration_ms int,
  checksum text,
  created_at timestamptz DEFAULT now()
);

-- org_settings
CREATE TABLE IF NOT EXISTS org_settings (
  org_id uuid PRIMARY KEY,
  ai_enabled boolean NOT NULL DEFAULT true,
  ai_handoff_keywords text[] DEFAULT ARRAY['humano','atendente','pessoa'],
  ai_max_turns_before_handoff int DEFAULT 10,
  templates_enabled_channels text[] DEFAULT ARRAY['whatsapp','instagram','facebook'],
  business_hours jsonb,
  alert_volume numeric DEFAULT 0.8,
  alert_sound text DEFAULT '/assets/sounds/alert.mp3',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- templates
CREATE TABLE IF NOT EXISTS templates (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id uuid NOT NULL,
  channel text NOT NULL CHECK (channel IN ('whatsapp','instagram','facebook')),
  name text NOT NULL,
  body text NOT NULL,
  variables text[] DEFAULT '{}',
  category text,
  status text NOT NULL DEFAULT 'approved' CHECK (status IN ('draft','approved','rejected')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- org_tags
CREATE TABLE IF NOT EXISTS org_tags (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id uuid NOT NULL,
  label text NOT NULL,
  color text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contacts_org ON contacts(org_id);
CREATE INDEX IF NOT EXISTS idx_contacts_phone ON contacts(phone_e164);
CREATE UNIQUE INDEX IF NOT EXISTS uq_contacts_org_cpf ON contacts(org_id, cpf) WHERE cpf IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_conversations_org_last ON conversations(org_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_contact ON conversations(contact_id);

CREATE INDEX IF NOT EXISTS idx_messages_conv_created ON messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_org ON messages(org_id);

CREATE INDEX IF NOT EXISTS idx_org_tags_org ON org_tags(org_id);

DO $$ BEGIN
  CREATE TRIGGER set_contacts_updated_at BEFORE UPDATE ON contacts FOR EACH ROW EXECUTE FUNCTION set_timestamp();
EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER set_conversations_updated_at BEFORE UPDATE ON conversations FOR EACH ROW EXECUTE FUNCTION set_timestamp();
EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER set_messages_updated_at BEFORE UPDATE ON messages FOR EACH ROW EXECUTE FUNCTION set_timestamp();
EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER set_org_settings_updated_at BEFORE UPDATE ON org_settings FOR EACH ROW EXECUTE FUNCTION set_timestamp();
EXCEPTION WHEN others THEN NULL; END $$;

ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_tags ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS contacts_isolation ON contacts;
  CREATE POLICY contacts_isolation ON contacts
    USING (org_id = current_setting('app.org_id', true)::uuid)
    WITH CHECK (org_id = current_setting('app.org_id', true)::uuid);
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS conversations_isolation ON conversations;
  CREATE POLICY conversations_isolation ON conversations
    USING (org_id = current_setting('app.org_id', true)::uuid)
    WITH CHECK (org_id = current_setting('app.org_id', true)::uuid);
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS messages_isolation ON messages;
  CREATE POLICY messages_isolation ON messages
    USING (org_id = current_setting('app.org_id', true)::uuid)
    WITH CHECK (org_id = current_setting('app.org_id', true)::uuid);
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS attachments_isolation ON attachments;
  CREATE POLICY attachments_isolation ON attachments
    USING (org_id = current_setting('app.org_id', true)::uuid)
    WITH CHECK (org_id = current_setting('app.org_id', true)::uuid);
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS templates_isolation ON templates;
  CREATE POLICY templates_isolation ON templates
    USING (org_id = current_setting('app.org_id', true)::uuid)
    WITH CHECK (org_id = current_setting('app.org_id', true)::uuid);
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS org_tags_isolation ON org_tags;
  CREATE POLICY org_tags_isolation ON org_tags
    USING (org_id = current_setting('app.org_id', true)::uuid)
    WITH CHECK (org_id = current_setting('app.org_id', true)::uuid);
EXCEPTION WHEN others THEN NULL; END $$;
COMMIT;
-- ===== END FILE =====


-- ===== BEGIN FILE: migrations/20250906_messages_attachments.sql =====
BEGIN;
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb NOT NULL;
CREATE INDEX IF NOT EXISTS idx_messages_conv_created
  ON messages (conversation_id, created_at DESC);
COMMIT;
-- ===== END FILE =====


-- ===== BEGIN FILE: migrations/20250909_orgs_extras.sql =====
BEGIN;
-- backend/migrations/20250909_orgs_extras.sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS slug                 text UNIQUE,
  ADD COLUMN IF NOT EXISTS document_type        text CHECK (document_type IN ('CNPJ','CPF')),
  ADD COLUMN IF NOT EXISTS document_value       text,
  ADD COLUMN IF NOT EXISTS photo_url            text,
  ADD COLUMN IF NOT EXISTS phone                text,
  ADD COLUMN IF NOT EXISTS email                text,
  ADD COLUMN IF NOT EXISTS address              jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS whatsapp_baileys_enabled    boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS whatsapp_baileys_status     text DEFAULT 'disabled',
  ADD COLUMN IF NOT EXISTS whatsapp_baileys_phone      text,
  ADD COLUMN IF NOT EXISTS whatsapp_baileys_session_id text,
  ADD COLUMN IF NOT EXISTS meta                 jsonb DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_orgs_document_value ON organizations(document_value);
CREATE INDEX IF NOT EXISTS idx_payments_org_created ON payments(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_purchases_org_created ON purchases(org_id, created_at DESC);
COMMIT;
-- ===== END FILE =====


-- ===== BEGIN FILE: migrations/20250909_plans_features.sql =====
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- [1] Garantir coluna UUID auxiliar e preencher (caso ainda exista estado legado)
DO $$
DECLARE
  has_id_uuid boolean;
  id_type text;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='plans' AND column_name='id_uuid'
  ) INTO has_id_uuid;

  SELECT data_type INTO id_type
  FROM information_schema.columns
  WHERE table_name='plans' AND column_name='id';

  IF NOT has_id_uuid THEN
    ALTER TABLE plans ADD COLUMN id_uuid uuid;
    IF id_type = 'uuid' THEN
      UPDATE plans SET id_uuid = id::uuid;
    ELSE
      UPDATE plans SET id_uuid = gen_random_uuid();
    END IF;
    ALTER TABLE plans ALTER COLUMN id_uuid SET NOT NULL;
  END IF;

  -- Índice UNIQUE auxiliar (se ainda não existir)
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='plans'::regclass AND conname='plans_id_uuid_key'
  ) THEN
    ALTER TABLE plans ADD CONSTRAINT plans_id_uuid_key UNIQUE (id_uuid);
  END IF;
END$$;

-- [2] Converter plan_id para UUID onde ainda for texto e criar FKs temporárias para id_uuid
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['organizations','subscriptions','orgs','clients','plan_features']
  LOOP
    IF to_regclass(t) IS NULL THEN CONTINUE; END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name=t AND column_name='plan_id' AND data_type <> 'uuid'
    ) THEN
      EXECUTE format('ALTER TABLE %I DROP CONSTRAINT IF EXISTS %I', t, t||'_plan_id_fkey');
      EXECUTE format('ALTER TABLE %I ADD COLUMN plan_id_uuid uuid', t);
      EXECUTE format(
        'UPDATE %I x
            SET plan_id_uuid = p.id_uuid
           FROM plans p
          WHERE x.plan_id::text = p.id::text', t);
      EXECUTE format('ALTER TABLE %I DROP COLUMN plan_id', t);
      EXECUTE format('ALTER TABLE %I RENAME COLUMN plan_id_uuid TO plan_id', t);
      EXECUTE format(
        'ALTER TABLE %I
           ADD CONSTRAINT %I FOREIGN KEY (plan_id)
           REFERENCES plans(id_uuid) ON DELETE %s',
        t, t||'_plan_id_fkey',
        CASE WHEN t='plan_features' THEN 'CASCADE' ELSE 'SET NULL' END
      );
    END IF;
  END LOOP;
END$$;

-- [3] Promover definitivamente: plans.id = UUID + PK (preserva legado em id_legacy_text)
DO $$
DECLARE
  id_type text;
BEGIN
  SELECT data_type INTO id_type
  FROM information_schema.columns
  WHERE table_name='plans' AND column_name='id';

  IF id_type <> 'uuid' THEN
    ALTER TABLE plans DROP CONSTRAINT IF EXISTS plans_pkey;
    ALTER TABLE plans ADD CONSTRAINT plans_pkey PRIMARY KEY (id_uuid);
    ALTER TABLE plans RENAME COLUMN id TO id_legacy_text;
    ALTER TABLE plans RENAME COLUMN id_uuid TO id;
  ELSE
    -- garante PK em id (uuid)
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid='plans'::regclass AND contype='p'
    ) THEN
      ALTER TABLE plans ADD CONSTRAINT plans_pkey PRIMARY KEY (id);
    END IF;
  END IF;
END$$;

-- [4] DROPA QUALQUER FK que hoje referencie plans (independe do nome) — limpa geral
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT conname, conrelid::regclass AS tbl
    FROM pg_constraint
    WHERE contype='f' AND confrelid='plans'::regclass
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', r.tbl, r.conname);
  END LOOP;
END$$;

-- [5] Agora pode remover o UNIQUE antigo com segurança
ALTER TABLE plans DROP CONSTRAINT IF EXISTS plans_id_uuid_key;

-- [6] Recria FKs apontando para a PK (plans.id)
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['organizations','subscriptions','orgs','clients','plan_features']
  LOOP
    IF to_regclass(t) IS NULL THEN CONTINUE; END IF;

    -- só recria se a coluna plan_id existir e for uuid
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name=t AND column_name='plan_id' AND data_type='uuid'
    ) THEN
      EXECUTE format(
        'ALTER TABLE %I
           ADD CONSTRAINT %I FOREIGN KEY (plan_id)
           REFERENCES plans(id) ON DELETE %s',
        t,
        t||'_plan_id_fkey',
        CASE WHEN t='plan_features' THEN 'CASCADE' ELSE 'SET NULL' END
      );
    END IF;
  END LOOP;
END$$;

COMMIT;
-- ===== END FILE =====


-- ===== BEGIN FILE: migrations/20250910_channels.sql =====
BEGIN;
CREATE TABLE IF NOT EXISTS channels (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id uuid NOT NULL,
  type text NOT NULL CHECK (type IN ('whatsapp','facebook','instagram')),
  mode text NOT NULL CHECK (mode IN ('cloud','session')),
  status text NOT NULL DEFAULT 'disconnected' CHECK (status IN ('disconnected','connecting','connected','error')),
  credentials_json jsonb,
  webhook_secret text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_channels_org_type ON channels(org_id, type);

ALTER TABLE channels ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS channels_isolation ON channels;
  CREATE POLICY channels_isolation ON channels
    USING (org_id = current_setting('app.org_id', true)::uuid)
    WITH CHECK (org_id = current_setting('app.org_id', true)::uuid);
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER set_channels_updated_at BEFORE UPDATE ON channels FOR EACH ROW EXECUTE FUNCTION set_timestamp();
EXCEPTION WHEN others THEN NULL; END $$;
COMMIT;
-- ===== END FILE =====


-- ===== BEGIN FILE: migrations/20250911_whatsapp_exclusive.sql =====
BEGIN;
-- backend/migrations/20250911_whatsapp_exclusive.sql
-- Adds Baileys visibility and Whatsapp mode exclusivity settings
-- plus uniqueness constraints for contacts and organizations

-- organization settings: allow_baileys flag and whatsapp_active_mode
ALTER TABLE org_settings
  ADD COLUMN IF NOT EXISTS allow_baileys boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS whatsapp_active_mode text NOT NULL DEFAULT 'none'
    CHECK (whatsapp_active_mode IN ('none','baileys','api'));

-- uniqueness indexes for contacts (per organization)
CREATE UNIQUE INDEX IF NOT EXISTS ux_contacts_org_phone
  ON contacts(org_id, phone_e164)
  WHERE phone_e164 IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_contacts_org_email
  ON contacts(org_id, lower(email))
  WHERE email IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_contacts_org_cpf_digits
  ON contacts(org_id, regexp_replace(cpf, '\\D', '', 'g'))
  WHERE cpf IS NOT NULL;

-- uniqueness indexes for organizations (global)
CREATE UNIQUE INDEX IF NOT EXISTS ux_orgs_cnpj_digits
  ON organizations((regexp_replace(document_value, '\\D', '', 'g')))
  WHERE document_type = 'CNPJ' AND document_value IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_orgs_owner_email
  ON organizations(lower(email))
  WHERE email IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_orgs_company_phone
  ON organizations(phone)
  WHERE phone IS NOT NULL;
COMMIT;
-- ===== END FILE =====


-- ===== BEGIN FILE: migrations/20250912_clients_fields_uniques.sql =====
BEGIN;
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS phone_e164 text,
  ADD COLUMN IF NOT EXISTS cpf        text,
  ADD COLUMN IF NOT EXISTS cnpj       text;

-- índices únicos por organização (parciais)
CREATE UNIQUE INDEX IF NOT EXISTS ux_clients_org_email_lower
  ON clients (org_id, lower(email))
  WHERE email IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_clients_org_phone
  ON clients (org_id, phone_e164)
  WHERE phone_e164 IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_clients_org_cpf_digits
  ON clients (org_id, regexp_replace(cpf, '\D','','g'))
  WHERE cpf IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_clients_org_cnpj_digits
  ON clients (org_id, regexp_replace(cnpj, '\D','','g'))
  WHERE cnpj IS NOT NULL;
COMMIT;
-- ===== END FILE =====


-- ===== BEGIN FILE: migrations/20250912_orgs_fields.sql =====
BEGIN;
-- organizations: campos empresariais e endereço
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS cnpj              text,
  ADD COLUMN IF NOT EXISTS razao_social      text,
  ADD COLUMN IF NOT EXISTS nome_fantasia     text,
  ADD COLUMN IF NOT EXISTS ie                text,
  ADD COLUMN IF NOT EXISTS ie_isento         boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS site              text,
  ADD COLUMN IF NOT EXISTS email             text,
  ADD COLUMN IF NOT EXISTS phone_e164        text,
  ADD COLUMN IF NOT EXISTS status            text DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS cep               text,
  ADD COLUMN IF NOT EXISTS logradouro        text,
  ADD COLUMN IF NOT EXISTS numero            text,
  ADD COLUMN IF NOT EXISTS complemento       text,
  ADD COLUMN IF NOT EXISTS bairro            text,
  ADD COLUMN IF NOT EXISTS cidade            text,
  ADD COLUMN IF NOT EXISTS uf                text,
  ADD COLUMN IF NOT EXISTS country           text DEFAULT 'BR',
  ADD COLUMN IF NOT EXISTS resp_nome         text,
  ADD COLUMN IF NOT EXISTS resp_cpf          text,
  ADD COLUMN IF NOT EXISTS resp_email        text,
  ADD COLUMN IF NOT EXISTS resp_phone_e164   text;

-- funções util_* (assumimos que já existam)

-- índices de unicidade (aceitam NULL)
CREATE UNIQUE INDEX IF NOT EXISTS ux_orgs_cnpj_digits
  ON organizations (util_digits(cnpj))
  WHERE cnpj IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_orgs_email_lower
  ON organizations (util_email_lower(email))
  WHERE email IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_orgs_phone_e164
  ON organizations (phone_e164)
  WHERE phone_e164 IS NOT NULL;
COMMIT;
-- ===== END FILE =====


-- ===== BEGIN FILE: migrations/20250913_calendar_accounts.sql =====
BEGIN;
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
COMMIT;
-- ===== END FILE =====


-- ===== BEGIN FILE: migrations/20250913_clients_dedupe_then_uniques.sql =====
BEGIN;
-- EMAIL
WITH d AS (
  SELECT org_id, lower(email) AS k, MIN(id) AS keep_id, array_agg(id) AS all_ids
  FROM clients
  WHERE email IS NOT NULL
  GROUP BY org_id, lower(email)
  HAVING COUNT(*) > 1
)
DELETE FROM clients c
USING d
WHERE c.org_id = d.org_id
  AND lower(c.email) = d.k
  AND c.id <> d.keep_id;

-- PHONE
WITH d AS (
  SELECT org_id, phone_e164 AS k, MIN(id) AS keep_id, array_agg(id) AS all_ids
  FROM clients
  WHERE phone_e164 IS NOT NULL
  GROUP BY org_id, phone_e164
  HAVING COUNT(*) > 1
)
DELETE FROM clients c
USING d
WHERE c.org_id = d.org_id
  AND c.phone_e164 = d.k
  AND c.id <> d.keep_id;

-- CPF
WITH d AS (
  SELECT org_id, regexp_replace(cpf,'\\D','','g') AS k, MIN(id) AS keep_id, array_agg(id) AS all_ids
  FROM clients
  WHERE cpf IS NOT NULL
  GROUP BY org_id, regexp_replace(cpf,'\\D','','g')
  HAVING COUNT(*) > 1
)
DELETE FROM clients c
USING d
WHERE c.org_id = d.org_id
  AND regexp_replace(c.cpf,'\\D','','g') = d.k
  AND c.id <> d.keep_id;

-- CNPJ
WITH d AS (
  SELECT org_id, regexp_replace(cnpj,'\\D','','g') AS k, MIN(id) AS keep_id, array_agg(id) AS all_ids
  FROM clients
  WHERE cnpj IS NOT NULL
  GROUP BY org_id, regexp_replace(cnpj,'\\D','','g')
  HAVING COUNT(*) > 1
)
DELETE FROM clients c
USING d
WHERE c.org_id = d.org_id
  AND regexp_replace(c.cnpj,'\\D','','g') = d.k
  AND c.id <> d.keep_id;

-- Índices únicos (parciais)
CREATE UNIQUE INDEX IF NOT EXISTS ux_clients_org_email_lower
  ON clients (org_id, lower(email))
  WHERE email IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_clients_org_phone
  ON clients (org_id, phone_e164)
  WHERE phone_e164 IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_clients_org_cpf_digits
  ON clients (org_id, regexp_replace(cpf,'\\D','','g'))
  WHERE cpf IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_clients_org_cnpj_digits
  ON clients (org_id, regexp_replace(cnpj,'\\D','','g'))
  WHERE cnpj IS NOT NULL;

COMMIT;
-- ===== END FILE =====


-- ===== BEGIN FILE: migrations/20250914_google_oauth_tokens.sql =====
BEGIN;
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
COMMIT;
-- ===== END FILE =====


-- ===== BEGIN FILE: migrations/20250915_facebook_pages.sql =====
BEGIN;
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
COMMIT;
-- ===== END FILE =====


-- ===== BEGIN FILE: migrations/20250915_instagram_accounts.sql =====
BEGIN;
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

CREATE INDEX IF NOT EXISTS ix_instagram_accounts_org ON instagram_accounts(org_id);
COMMIT;
-- ===== END FILE =====


-- ===== BEGIN FILE: migrations/20250915_instagram_oauth_tokens.sql =====
BEGIN;
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
COMMIT;
-- ===== END FILE =====


-- ===== BEGIN FILE: migrations/20250915_instagram_publish_feature.sql =====
BEGIN;
INSERT INTO feature_defs (code, label, type, unit, category, sort_order, is_public, show_as_tick)
VALUES ('instagram_publish_daily_quota','Instagram – Publicações por dia','number','count','social',50,true,false)
ON CONFLICT (code) DO NOTHING;

INSERT INTO plan_features (plan_id, feature_code, value)
SELECT id, 'instagram_publish_daily_quota', jsonb_build_object('enabled', true, 'limit', 10)
FROM plans
ON CONFLICT (plan_id, feature_code) DO NOTHING;
COMMIT;
-- ===== END FILE =====


-- ===== BEGIN FILE: migrations/20250915_instagram_publish_jobs.sql =====
BEGIN;
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
COMMIT;
-- ===== END FILE =====


-- ===== BEGIN FILE: migrations/20250916_instagram_publish_jobs_dedupe.sql =====
BEGIN;
ALTER TABLE instagram_publish_jobs
  ADD COLUMN IF NOT EXISTS client_dedupe_key text;

CREATE UNIQUE INDEX IF NOT EXISTS ux_ig_jobs_dedupe
  ON instagram_publish_jobs(org_id, account_id, client_dedupe_key)
  WHERE status IN ('pending','creating','publishing');
COMMIT;
-- ===== END FILE =====


-- ===== BEGIN FILE: migrations/20250917_01_org_ai_profiles.sql =====
BEGIN;
-- backend/migrations/20250917_01_org_ai_profiles.sql
CREATE TABLE IF NOT EXISTS org_ai_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL UNIQUE,
  profile JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_org_ai_profiles_org_id ON org_ai_profiles(org_id);
COMMIT;
-- ===== END FILE =====


-- ===== BEGIN FILE: migrations/20250917_02_ai_guardrail_violations.sql =====
BEGIN;
-- backend/migrations/20250917_02_ai_guardrail_violations.sql
CREATE TABLE IF NOT EXISTS ai_guardrail_violations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  user_id UUID NULL,
  channel TEXT NULL,
  intent TEXT NULL,
  rule TEXT NOT NULL,
  message TEXT NULL,
  input_excerpt TEXT NULL,
  output_excerpt TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ai_guardrail_violations_org_id_created_at
  ON ai_guardrail_violations(org_id, created_at DESC);
COMMIT;
-- ===== END FILE =====


-- ===== BEGIN FILE: migrations/20250917_03_kb_documents.sql =====
BEGIN;
-- backend/migrations/20250917_03_kb_documents.sql
CREATE TABLE IF NOT EXISTS kb_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  source_type TEXT NOT NULL,
  uri TEXT NOT NULL,
  lang TEXT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  title TEXT NULL,
  tags JSONB NULL,
  checksum TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMIT;
-- ===== END FILE =====


-- ===== BEGIN FILE: migrations/20250917_facebook_publish_feature.sql =====
BEGIN;
INSERT INTO feature_defs (code, label, type, unit, category, sort_order, is_public)
VALUES ('facebook_publish_daily_quota','Facebook – Publicações por dia','number','count','social',33,true)
ON CONFLICT (code) DO UPDATE SET label=EXCLUDED.label, type=EXCLUDED.type, unit=EXCLUDED.unit,
  category=EXCLUDED.category, sort_order=EXCLUDED.sort_order, is_public=EXCLUDED.is_public;

WITH data(plan_name, feature_code, val) AS (
  VALUES
  ('Free','facebook_publish_daily_quota','{"enabled": true, "limit": 1}'),
  ('Starter','facebook_publish_daily_quota','{"enabled": true, "limit": 5}'),
  ('Pro','facebook_publish_daily_quota','{"enabled": true, "limit": 20}')
)
INSERT INTO plan_features (plan_id, feature_code, value)
SELECT p.id, d.feature_code, d.val::jsonb
FROM data d JOIN plans p ON p.name ILIKE d.plan_name
ON CONFLICT (plan_id, feature_code) DO UPDATE SET value=EXCLUDED.value, updated_at=now();
COMMIT;
-- ===== END FILE =====


-- ===== BEGIN FILE: migrations/20250917_facebook_publish_jobs.sql =====
BEGIN;
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
COMMIT;
-- ===== END FILE =====


-- ===== BEGIN FILE: migrations/20250918_content_assets.sql =====
BEGIN;
CREATE TABLE IF NOT EXISTS content_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  url text NOT NULL,
  mime text NOT NULL,
  width int,
  height int,
  meta_json jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_assets_org ON content_assets(org_id);
COMMIT;
-- ===== END FILE =====


-- ===== BEGIN FILE: migrations/20250918_content_campaigns.sql =====
BEGIN;
CREATE TABLE IF NOT EXISTS content_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title text NOT NULL,
  month_ref date NOT NULL,
  default_targets jsonb NOT NULL DEFAULT '{}'::jsonb,
  strategy_json jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_campaigns_org_month ON content_campaigns(org_id, month_ref);
COMMIT;
-- ===== END FILE =====


-- ===== BEGIN FILE: migrations/20250918_content_suggestions.sql =====
BEGIN;
CREATE TYPE IF NOT EXISTS suggestion_status AS ENUM ('suggested','approved','scheduled','published','rejected');

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
  approved_by uuid,
  approved_at timestamptz,
  published_at timestamptz,
  jobs_map jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_suggestions_campaign ON content_suggestions(campaign_id);
CREATE INDEX IF NOT EXISTS ix_suggestions_org_date ON content_suggestions(org_id, date);
COMMIT;
-- ===== END FILE =====


-- ===== BEGIN FILE: migrations/20250919_channel_accounts.sql =====
BEGIN;
CREATE TABLE IF NOT EXISTS channel_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('facebook','instagram')),
  external_account_id TEXT NOT NULL,
  name TEXT,
  username TEXT,
  access_token_enc TEXT,
  token_expires_at TIMESTAMPTZ,
  webhook_subscribed BOOLEAN DEFAULT FALSE,
  permissions_json JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (org_id, channel, external_account_id)
);

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS channel TEXT,
  ADD COLUMN IF NOT EXISTS account_id UUID,
  ADD COLUMN IF NOT EXISTS external_user_id TEXT,
  ADD COLUMN IF NOT EXISTS external_thread_id TEXT,
  ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_conv_org_pool ON conversations(org_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_conv_uniqueness ON conversations(org_id, channel, account_id, external_user_id);

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS external_message_id TEXT,
  ADD COLUMN IF NOT EXISTS direction TEXT,
  ADD COLUMN IF NOT EXISTS raw_json JSONB;

CREATE INDEX IF NOT EXISTS idx_msg_external ON messages(external_message_id);
COMMIT;
-- ===== END FILE =====


-- ===== BEGIN FILE: migrations/20250919_contact_identities_and_uniques.sql =====
BEGIN;
-- Identidades por canal/conta (mapeia PSID/IGSID → contact_id)
CREATE TABLE IF NOT EXISTS contact_identities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('facebook','instagram','whatsapp')),
  account_id UUID,                         -- channel_accounts.id (nullable p/ whatsapp se não usar)
  identity TEXT NOT NULL,                  -- PSID / IGSID / telefone
  contact_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (org_id, channel, account_id, identity)
);

-- Garantir unicidade lógica das conversas (org + canal + conta + usuário externo)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'uq_conversations_uniqueness'
  ) THEN
    CREATE UNIQUE INDEX uq_conversations_uniqueness
      ON conversations(org_id, channel, account_id, external_user_id);
  END IF;
END $$;

-- Mensagens idempotentes por mensagem externa
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'uq_messages_external'
  ) THEN
    CREATE UNIQUE INDEX uq_messages_external
      ON messages(org_id, external_message_id);
  END IF;
END $$;
COMMIT;
-- ===== END FILE =====


-- ===== BEGIN FILE: migrations/20250920_telemetry_and_handoff.sql =====
BEGIN;
-- Add columns for handoff tracking (idempotent)
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS human_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS alert_sent BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS handoff_ack_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS handoff_ack_by UUID;

-- Telemetry raw events (append-only)
CREATE TABLE IF NOT EXISTS public.telemetry_events (
  id          BIGSERIAL PRIMARY KEY,
  org_id      UUID NOT NULL,
  user_id     UUID,
  source      TEXT NOT NULL,
  event_key   TEXT NOT NULL,
  value_num   NUMERIC,
  metadata    JSONB DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_te_org_time ON public.telemetry_events(org_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_te_key ON public.telemetry_events(event_key);

-- Daily aggregates table (optional materialisation)
CREATE TABLE IF NOT EXISTS public.telemetry_kpis_daily (
  org_id UUID NOT NULL,
  day    DATE NOT NULL,
  metric TEXT NOT NULL,
  value  NUMERIC NOT NULL,
  PRIMARY KEY (org_id, day, metric)
);

-- Utility view (last 30 days of raw events)
CREATE OR REPLACE VIEW public.vw_telemetry_last30 AS
SELECT
  org_id,
  date_trunc('day', occurred_at)::date AS day,
  event_key,
  count(*)::int AS cnt
FROM public.telemetry_events
WHERE occurred_at >= now() - interval '30 days'
GROUP BY 1, 2, 3;

-- Recreate vw_inbox_threads preserving tag order and adding handoff helpers
DROP VIEW IF EXISTS public.vw_inbox_threads;
DO $$BEGIN
  IF to_regclass('public.conversations') IS NOT NULL
     AND to_regclass('public.channels') IS NOT NULL
     AND to_regclass('public.contacts') IS NOT NULL THEN
    EXECUTE $$\
CREATE OR REPLACE VIEW public.vw_inbox_threads AS
CREATE VIEW public.vw_inbox_threads AS
SELECT
  c.id                AS conversation_id,
  c.org_id,
  c.channel,
  ch.mode             AS transport,
  c.account_id,
  c.chat_id,
  c.contact_id,
  COALESCE(ct.display_name, ct.name, ct.phone_e164, ct.phone, c.chat_id) AS contact_name,
  c.status,
  c.ai_enabled,
  c.unread_count,
  c.last_message_at,
  COALESCE(
    (
      SELECT ARRAY_AGG(t.name ORDER BY t.name)
      FROM public.contact_tags  ctags
      JOIN public.tags          t ON t.id = ctags.tag_id
      WHERE ctags.contact_id = c.contact_id
        AND ctags.org_id    = c.org_id
        AND t.org_id        = c.org_id
    ),
    ARRAY[]::text[]
  ) AS tags,
  c.human_requested_at,
  c.alert_sent,
  (c.human_requested_at IS NOT NULL AND c.ai_enabled = FALSE) AS needs_human
FROM public.conversations c
JOIN public.channels      ch ON ch.id = c.channel_id
LEFT JOIN public.contacts ct ON ct.id = c.contact_id;$$;
  END IF;
END$$;

COMMIT;
-- ===== END FILE =====


-- ===== BEGIN FILE: migrations/20250920b_telemetry_handoff_safety.sql =====
BEGIN;
-- Handoff: garanta que o script anterior não quebre se os campos já existem
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='conversations' AND column_name='ai_enabled'
  ) THEN
    EXECUTE 'ALTER TABLE public.conversations ADD COLUMN ai_enabled boolean DEFAULT FALSE';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='conversations' AND column_name='ai_status'
  ) THEN
    EXECUTE 'ALTER TABLE public.conversations ADD COLUMN ai_status text DEFAULT ''idle''';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='conversations' AND column_name='human_requested_at'
  ) THEN
    EXECUTE 'ALTER TABLE public.conversations ADD COLUMN human_requested_at timestamptz';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='conversations' AND column_name='alert_sent'
  ) THEN
    EXECUTE 'ALTER TABLE public.conversations ADD COLUMN alert_sent boolean DEFAULT FALSE';
  END IF;
END $$;

-- Telemetria: se o Codex criou tabelas, ok; se não, as views continuam válidas.
-- Recrie/garanta as views sugeridas (leem de audit_logs/messages)
CREATE OR REPLACE VIEW public.vw_wa_send_events AS
SELECT
  a.org_id,
  a.action,
  a.created_at,
  COALESCE(a.meta->>'transport', a.target_type, a.action) AS transport,
  a.meta->>'idempotencyKey'           AS idempotency_key,
  a.meta->>'provider_message_id'      AS provider_message_id,
  NULLIF((a.meta->>'latency_ms')::int, NULL) AS latency_ms,
  NULLIF((a.meta->>'attempts')::int,   NULL) AS attempts,
  a.meta->>'error_code'               AS error_code
FROM public.audit_logs a
WHERE a.action IN ('wa.send.provider','wa.send.fallback');

CREATE OR REPLACE VIEW public.vw_wa_send_daily AS
SELECT
  org_id,
  date_trunc('day', created_at)::date AS day,
  LOWER(COALESCE(transport,'unknown')) AS transport,
  SUM(CASE WHEN action='wa.send.provider' THEN 1 ELSE 0 END) AS provider_ok,
  SUM(CASE WHEN action='wa.send.fallback' THEN 1 ELSE 0 END) AS provider_fallback,
  COUNT(*) AS total_attempts
FROM public.vw_wa_send_events
GROUP BY org_id, day, transport;

CREATE OR REPLACE VIEW public.vw_wa_latency_daily AS
WITH base AS (
  SELECT org_id,
         date_trunc('day', created_at)::date AS day,
         LOWER(COALESCE(transport,'unknown')) AS transport,
         latency_ms
  FROM public.vw_wa_send_events
  WHERE action='wa.send.provider' AND latency_ms IS NOT NULL
)
SELECT
  org_id, day, transport,
  percentile_cont(0.5) WITHIN GROUP (ORDER BY latency_ms) AS p50_ms,
  percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms) AS p95_ms,
  COUNT(*) AS samples
FROM base
GROUP BY org_id, day, transport;

CREATE OR REPLACE VIEW public.vw_inbox_ttfr AS
WITH inbound AS (
  SELECT m.conversation_id, m.created_at AS t_in
  FROM public.messages m
  WHERE m.direction IN ('inbound','incoming','in')
),
outbound AS (
  SELECT m.conversation_id, m.created_at AS t_out
  FROM public.messages m
  WHERE m.direction IN ('outbound','outgoing','out')
),
pairs AS (
  SELECT i.conversation_id, i.t_in,
         (SELECT MIN(o.t_out)
          FROM outbound o
          WHERE o.conversation_id = i.conversation_id
            AND o.t_out > i.t_in) AS t_first_out
  FROM inbound i
)
SELECT
  p.conversation_id,
  p.t_in::date AS day,
  EXTRACT(EPOCH FROM (p.t_first_out - p.t_in))::int AS ttfr_seconds
FROM pairs p
WHERE p.t_first_out IS NOT NULL;

CREATE OR REPLACE VIEW public.vw_inbox_ttfr_daily AS
SELECT
  conversation_id, day, ttfr_seconds
FROM public.vw_inbox_ttfr;

CREATE OR REPLACE VIEW public.vw_inbox_volume_daily AS
SELECT
  date_trunc('day', m.created_at)::date AS day,
  SUM(CASE WHEN m.direction IN ('inbound','incoming','in')  THEN 1 ELSE 0 END) AS inbound_count,
  SUM(CASE WHEN m.direction IN ('outbound','outgoing','out') THEN 1 ELSE 0 END) AS outbound_count,
  COUNT(*) AS total
FROM public.messages m
GROUP BY day;

COMMIT;
-- ===== END FILE =====


-- ===== BEGIN FILE: migrations/20250921_calendar_events.sql =====
BEGIN;
-- P17 calendar events table adjustments
DO $$
BEGIN
  IF to_regclass('public.calendar_events') IS NULL THEN
    CREATE TABLE public.calendar_events (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id uuid NOT NULL,
      summary text,
      description text,
      start_at timestamptz NOT NULL,
      end_at timestamptz NOT NULL,
      provider text,
      external_event_id text,
      calendar_id text,
      contact_id uuid,
      reminder_sent boolean DEFAULT FALSE,
      created_at timestamptz NOT NULL DEFAULT now()
    );
  ELSE
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='calendar_events' AND column_name='external_event_id') THEN
      EXECUTE 'ALTER TABLE public.calendar_events ADD COLUMN external_event_id text';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='calendar_events' AND column_name='calendar_id') THEN
      EXECUTE 'ALTER TABLE public.calendar_events ADD COLUMN calendar_id text';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='calendar_events' AND column_name='reminder_sent') THEN
      EXECUTE 'ALTER TABLE public.calendar_events ADD COLUMN reminder_sent boolean DEFAULT FALSE';
    END IF;
  END IF;
END $$;
COMMIT;
-- ===== END FILE =====


-- ===== BEGIN FILE: migrations/20250922_create_audit_logs.sql =====
BEGIN;
-- Idempotent
CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  org_id TEXT NOT NULL,
  user_id TEXT,
  action TEXT NOT NULL,
  entity TEXT,
  entity_id TEXT,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
COMMIT;
-- ===== END FILE =====


-- ===== BEGIN FILE: migrations/20250922_create_reminder_logs.sql =====
BEGIN;
-- Idempotent
CREATE TABLE IF NOT EXISTS reminder_logs (
  id BIGSERIAL PRIMARY KEY,
  event_id TEXT NOT NULL,
  channel TEXT NOT NULL,
  recipient TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  hash TEXT NOT NULL UNIQUE
);

CREATE INDEX IF NOT EXISTS idx_reminder_logs_event_id ON reminder_logs(event_id);
COMMIT;
-- ===== END FILE =====


-- ===== BEGIN FILE: migrations/20250923_org_plan_credits.sql =====
BEGIN;
-- backend/migrations/20250923_org_plan_credits.sql
-- Complementa organizations com colunas de plano/trial e cria tabelas de histórico/créditos

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS plan_id uuid REFERENCES public.plans(id),
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz;

CREATE TABLE IF NOT EXISTS public.org_plan_history (
  org_id     uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  plan_id    uuid NOT NULL,
  status     text NOT NULL CHECK (status IN ('active','canceled','suspended','pending')),
  start_at   timestamptz NOT NULL DEFAULT now(),
  end_at     timestamptz,
  source     text NOT NULL DEFAULT 'manual',
  meta       jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_plan_history_org ON public.org_plan_history(org_id);
CREATE INDEX IF NOT EXISTS idx_org_plan_history_plan ON public.org_plan_history(plan_id);

CREATE TABLE IF NOT EXISTS public.org_credits (
  org_id        uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  feature_code  text NOT NULL,
  delta         integer NOT NULL,
  expires_at    timestamptz,
  source        text NOT NULL DEFAULT 'manual',
  meta          jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_credits_org ON public.org_credits(org_id);
CREATE INDEX IF NOT EXISTS idx_org_credits_feature ON public.org_credits(feature_code);

CREATE OR REPLACE VIEW public.v_org_credits AS
SELECT
  org_id,
  feature_code,
  SUM(delta) AS remaining_total,
  MIN(expires_at) FILTER (WHERE expires_at IS NOT NULL AND expires_at >= now()) AS expires_next
FROM public.org_credits
GROUP BY org_id, feature_code;
COMMIT;
-- ===== END FILE =====


-- ===== BEGIN FILE: migrations/20250924_admin_orgs_billing.sql =====
BEGIN;
-- backend/migrations/20250924_admin_orgs_billing.sql
-- Ajustes idempotentes para histórico de plano, créditos por feature e visões auxiliares

-- 1) Sincronismo opcional organizations -> orgs
DO $$
BEGIN
  IF to_regclass('public.orgs') IS NOT NULL THEN
    UPDATE public.organizations g
       SET status = o.status
      FROM public.organizations o
     WHERE o.id = g.id
       AND g.status IS DISTINCT FROM o.status;
  END IF;
END$$;

-- 2) Histórico de plano (garante existência)
CREATE TABLE IF NOT EXISTS public.org_plan_history (
  org_id     uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  plan_id    uuid NOT NULL,
  status     text NOT NULL CHECK (status IN ('active','canceled','suspended','pending')),
  start_at   timestamptz NOT NULL DEFAULT now(),
  end_at     timestamptz,
  source     text NOT NULL DEFAULT 'manual',
  meta       jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_plan_history_org ON public.org_plan_history(org_id);
CREATE INDEX IF NOT EXISTS idx_org_plan_history_plan ON public.org_plan_history(plan_id);

-- 3) Créditos por feature (PK sintético + FK organizations)
DO $$
BEGIN
  IF to_regclass('public.org_credits') IS NULL THEN
    CREATE TABLE public.org_credits (
      id           bigserial PRIMARY KEY,
      org_id       uuid NOT NULL,
      feature_code text NOT NULL,
      delta        integer NOT NULL,
      expires_at   timestamptz,
      source       text NOT NULL DEFAULT 'manual',
      meta         jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at   timestamptz NOT NULL DEFAULT now()
    );
  ELSE
    -- garantir coluna id
    IF NOT EXISTS (
      SELECT 1
        FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'org_credits'
         AND column_name = 'id'
    ) THEN
      ALTER TABLE public.org_credits ADD COLUMN id bigserial;
    END IF;

    -- garantir default do id
    IF EXISTS (
      SELECT 1
        FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'org_credits'
         AND column_name = 'id'
         AND column_default IS NULL
    ) THEN
      IF to_regclass('public.org_credits_id_seq') IS NULL THEN
        EXECUTE 'CREATE SEQUENCE public.org_credits_id_seq OWNED BY public.org_credits.id';
      END IF;

      PERFORM setval('public.org_credits_id_seq', COALESCE((SELECT MAX(id) FROM public.org_credits), 0));
      ALTER TABLE public.org_credits ALTER COLUMN id SET DEFAULT nextval('public.org_credits_id_seq');
    END IF;

    UPDATE public.org_credits
       SET id = nextval('public.org_credits_id_seq')
     WHERE id IS NULL;

    ALTER TABLE public.org_credits ALTER COLUMN id SET NOT NULL;

    -- normalizar delta
    IF NOT EXISTS (
      SELECT 1
        FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'org_credits'
         AND column_name = 'delta'
    ) THEN
      ALTER TABLE public.org_credits ADD COLUMN delta integer;

      IF EXISTS (
        SELECT 1
          FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = 'org_credits'
           AND column_name = 'remaining'
      ) THEN
        UPDATE public.org_credits SET delta = COALESCE(remaining, 0);
        ALTER TABLE public.org_credits DROP COLUMN remaining;
      ELSE
        UPDATE public.org_credits SET delta = 0 WHERE delta IS NULL;
      END IF;

      ALTER TABLE public.org_credits ALTER COLUMN delta SET NOT NULL;
    ELSE
      UPDATE public.org_credits SET delta = 0 WHERE delta IS NULL;
      ALTER TABLE public.org_credits ALTER COLUMN delta SET NOT NULL;
    END IF;

    -- garantir PK em id
    PERFORM 1
      FROM pg_constraint
     WHERE conrelid = 'public.org_credits'::regclass
       AND contype = 'p';
    IF NOT FOUND THEN
      ALTER TABLE public.org_credits
        ADD CONSTRAINT org_credits_pkey PRIMARY KEY (id);
    END IF;
  END IF;

  -- FK para organizations (sempre recria para garantir ON DELETE CASCADE)
  IF EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conrelid = 'public.org_credits'::regclass
       AND contype = 'f'
       AND conname = 'org_credits_org_id_fkey'
  ) THEN
    ALTER TABLE public.org_credits DROP CONSTRAINT org_credits_org_id_fkey;
  END IF;

  ALTER TABLE public.org_credits
    ADD CONSTRAINT org_credits_org_id_fkey
    FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
END$$;

CREATE INDEX IF NOT EXISTS idx_org_credits_org ON public.org_credits(org_id);
CREATE INDEX IF NOT EXISTS idx_org_credits_feature ON public.org_credits(feature_code);
CREATE INDEX IF NOT EXISTS idx_org_credits_org_feat_created
  ON public.org_credits (org_id, feature_code, created_at DESC);

-- 4) View de créditos agregados
CREATE OR REPLACE VIEW public.v_org_credits AS
SELECT
  org_id,
  feature_code,
  SUM(delta) AS remaining_total,
  MIN(expires_at) FILTER (
    WHERE expires_at IS NOT NULL
      AND expires_at >= now()
  ) AS expires_next
FROM public.org_credits
GROUP BY org_id, feature_code;

-- 5) View de listagem unificada
CREATE OR REPLACE VIEW public.v_org_list AS
SELECT
  id,
  name,
  slug,
  status,
  plan_id,
  trial_ends_at,
  (status = 'active')::boolean AS active
FROM public.organizations;
COMMIT;
-- ===== END FILE =====


-- ===== BEGIN FILE: migrations/20250930_ai_meters.sql =====
BEGIN;
-- 20250930_ai_meters.sql
-- Catálogos e uso de IA, além de colunas auxiliares em plan_features.

-- A. catálogos e uso de IA
CREATE TABLE IF NOT EXISTS public.ai_meters (
  code        text PRIMARY KEY,
  name        text NOT NULL,
  unit        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_usage (
  id          bigserial PRIMARY KEY,
  org_id      uuid NOT NULL REFERENCES public.organizations(id),
  meter_code  text NOT NULL REFERENCES public.ai_meters(code),
  qty         numeric NOT NULL CHECK (qty >= 0),
  source      text NOT NULL DEFAULT 'system',
  meta        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_usage_org_meter_created_at_idx
  ON public.ai_usage (org_id, meter_code, created_at);
CREATE INDEX IF NOT EXISTS ai_usage_meter_created_at_idx
  ON public.ai_usage (meter_code, created_at);

-- B. colunas extras em plan_features (se ainda não existirem)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='plan_features' AND column_name='ai_meter_code'
  ) THEN
    ALTER TABLE public.plan_features
      ADD COLUMN ai_meter_code text NULL REFERENCES public.ai_meters(code);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='plan_features' AND column_name='ai_monthly_quota'
  ) THEN
    ALTER TABLE public.plan_features
      ADD COLUMN ai_monthly_quota numeric NULL CHECK (ai_monthly_quota >= 0);
  END IF;
END$$;

-- C. sementes (idempotente)
INSERT INTO public.ai_meters (code, name, unit)
VALUES
  ('content_tokens', 'Tokens de conteúdo', 'tokens'),
  ('assist_tokens',  'Tokens do assistente', 'tokens'),
  ('speech_seconds', 'Segundos de fala', 'seconds')
ON CONFLICT (code) DO NOTHING;
COMMIT;
-- ===== END FILE =====


-- ===== BEGIN FILE: migrations/20250930_cleanup_orgs_legacy.sql =====
BEGIN;
-- Remove qualquer tabela física "public.orgs" remanescente após a migração de unificação.
DO $$
DECLARE
  relkind text;
BEGIN
  SELECT c.relkind
    INTO relkind
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public'
     AND c.relname = 'orgs';

  IF relkind = 'r' THEN
    EXECUTE 'DROP TABLE IF EXISTS public.organizations CASCADE';
  END IF;
END $$;

-- Ajusta sincronismos legados garantindo que apenas organizations seja atualizada.
DO $$
BEGIN
  IF to_regclass('public.organizations') IS NOT NULL THEN
    RAISE NOTICE 'Legacy orgs -> organizations sync skipped after consolidation.';
  END IF;
END $$;

COMMIT;
-- ===== END FILE =====


-- ===== BEGIN FILE: migrations/20250930_fix_plans_legacy_default.sql =====
BEGIN;
-- idempotente
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='plans' AND column_name='id_legacy_text'
  ) THEN
    RAISE EXCEPTION 'Tabela public.plans sem coluna id_legacy_text';
  END IF;

  -- Default gera "plan-xxxxxxxx" se o código do app esquecer de enviar
  EXECUTE $q$
    ALTER TABLE public.plans
    ALTER COLUMN id_legacy_text SET DEFAULT ('plan-' || substr(gen_random_uuid()::text, 1, 8))
  $q$;

  -- Backfill de nulos/vazios (se houver legado)
  UPDATE public.plans
     SET id_legacy_text = 'plan-' || substr(gen_random_uuid()::text, 1, 8)
   WHERE (id_legacy_text IS NULL OR id_legacy_text = '');

  -- índice único se ainda não existir (opcional, mas recomendado)
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='ux_plans_legacy'
  ) THEN
    CREATE UNIQUE INDEX ux_plans_legacy ON public.plans (id_legacy_text);
  END IF;
END$$;
COMMIT;
-- ===== END FILE =====


-- ===== BEGIN FILE: migrations/20251001_plan_credits.sql =====
BEGIN;
-- Compat: se não existir uma tabela de limites por plano,
-- usamos a feature "ai_tokens_limit" no próprio plano como origem da verdade.

-- Só cria a coluna se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='plans' AND column_name='ai_tokens_limit'
  ) THEN
    ALTER TABLE public.plans
      ADD COLUMN ai_tokens_limit bigint DEFAULT 0 NOT NULL;
  END IF;
END$$;

COMMIT;
-- ===== END FILE =====


-- ===== BEGIN FILE: migrations/202409271200_plan_features_unique.sql =====
BEGIN;
CREATE UNIQUE INDEX IF NOT EXISTS ux_plan_features_plan_code
  ON plan_features(plan_id, feature_code);
COMMIT;
-- ===== END FILE =====


-- ===== BEGIN FILE: migrations/202410140900_seed_feature_defs.sql =====
BEGIN;
INSERT INTO feature_defs (code, label, type, unit, category, sort_order, is_public, show_as_tick)
VALUES
  ('whatsapp_numbers', 'WhatsApp – Quantidade de números', 'number', NULL, 'whatsapp', 10, true, false),
  ('google_calendar_accounts', 'Google Calendar – Contas conectadas', 'number', NULL, 'google', 20, true, false),
  ('whatsapp_mode_baileys', 'WhatsApp – Baileys habilitado', 'boolean', NULL, 'whatsapp', 30, false, false),
  ('facebook_pages', 'Facebook – Páginas conectadas', 'number', NULL, 'facebook', 40, true, false)
ON CONFLICT (code) DO NOTHING;
COMMIT;
-- ===== END FILE =====


-- ===== BEGIN FILE: migrations/zzz_calendar_rsvp.sql =====
BEGIN;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='calendar_events' AND column_name='rsvp_status') THEN
    ALTER TABLE public.calendar_events ADD COLUMN rsvp_status text NOT NULL DEFAULT 'pending';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='calendar_events' AND column_name='rsvp_token') THEN
    ALTER TABLE public.calendar_events ADD COLUMN rsvp_token text;
    CREATE UNIQUE INDEX IF NOT EXISTS calendar_events_rsvp_token_idx ON public.calendar_events (rsvp_token);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='calendar_events' AND column_name='reminder_sent_at') THEN
    ALTER TABLE public.calendar_events ADD COLUMN reminder_sent_at timestamptz;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='calendar_events' AND column_name='reminders_count') THEN
    ALTER TABLE public.calendar_events ADD COLUMN reminders_count integer NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='calendar_events' AND column_name='confirmed_at') THEN
    ALTER TABLE public.calendar_events ADD COLUMN confirmed_at timestamptz;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='calendar_events' AND column_name='canceled_at') THEN
    ALTER TABLE public.calendar_events ADD COLUMN canceled_at timestamptz;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='calendar_events' AND column_name='noshow_at') THEN
    ALTER TABLE public.calendar_events ADD COLUMN noshow_at timestamptz;
  END IF;
END $$;
COMMIT;
-- ===== END FILE =====


-- ===== BEGIN FILE: migrations/zzz_inbox_compat.sql =====
BEGIN;
-- 1) Colunas em messages (ADD ONLY)
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS provider_msg_id TEXT;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- 2) Índices úteis
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='msg_provider_unique')
  THEN EXECUTE 'CREATE UNIQUE INDEX msg_provider_unique ON public.messages(provider_msg_id) WHERE provider_msg_id IS NOT NULL'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='msg_conv_created_idx')
  THEN EXECUTE 'CREATE INDEX msg_conv_created_idx ON public.messages(conversation_id, created_at)'; END IF;
END $$;

-- 3) message_status_events compatível com tipo de messages.id
DO $$
DECLARE msg_id_sqltype text;
BEGIN
  SELECT format_type(a.atttypid, a.atttypmod)
    INTO msg_id_sqltype
  FROM pg_attribute a
  JOIN pg_class c ON c.oid=a.attrelid
  JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relname='messages' AND a.attname='id' AND a.attnum>0;

  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='message_status_events') THEN
    EXECUTE format($f$
      CREATE TABLE public.message_status_events (
        id BIGSERIAL PRIMARY KEY,
        message_id %s REFERENCES public.messages(id) ON DELETE CASCADE,
        status TEXT NOT NULL,
        error JSONB,
        created_at TIMESTAMPTZ DEFAULT now()
      )
    $f$, msg_id_sqltype);
  ELSE
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='message_status_events' AND column_name='message_id'
      AND format_type((SELECT a2.atttypid FROM pg_attribute a2 JOIN pg_class c2 ON c2.oid=a2.attrelid JOIN pg_namespace n2 ON n2.oid=c2.relnamespace
                       WHERE n2.nspname='public' AND c2.relname='message_status_events' AND a2.attname='message_id' AND a2.attnum>0), NULL) <> msg_id_sqltype
    ) THEN
      EXECUTE 'ALTER TABLE public.message_status_events ALTER COLUMN message_id TYPE '||msg_id_sqltype||' USING message_id::'||msg_id_sqltype;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE table_schema='public' AND table_name='message_status_events' AND constraint_type='FOREIGN KEY' AND constraint_name='message_status_events_message_id_fkey'
    ) THEN
      EXECUTE 'ALTER TABLE public.message_status_events ADD CONSTRAINT message_status_events_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.messages(id) ON DELETE CASCADE';
    END IF;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='mse_message_id_created_idx')
  THEN EXECUTE 'CREATE INDEX mse_message_id_created_idx ON public.message_status_events(message_id, created_at)'; END IF;
END $$;

-- 4) conversations: (chat_id, transport) e índices — sem mexer no que você já tem
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS chat_id TEXT;
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS transport TEXT;
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMPTZ;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='conv_chat_transport_idx')
  THEN EXECUTE 'CREATE UNIQUE INDEX conv_chat_transport_idx ON public.conversations(chat_id, transport)'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='conv_channel_idx')
  THEN EXECUTE 'CREATE INDEX conv_channel_idx ON public.conversations(channel)'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='conv_last_message_at_desc_idx')
  THEN EXECUTE 'CREATE INDEX conv_last_message_at_desc_idx ON public.conversations(last_message_at DESC)'; END IF;
END $$;

-- 5) triggers
CREATE OR REPLACE FUNCTION public.bump_conversation_last_message_at()
RETURNS trigger AS $$
BEGIN
  UPDATE public.conversations SET last_message_at = COALESCE(NEW.created_at, now()) WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='messages_after_insert_bump_last')
  THEN CREATE TRIGGER messages_after_insert_bump_last AFTER INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.bump_conversation_last_message_at();
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.sync_messages_status_from_event()
RETURNS trigger AS $$
BEGIN
  UPDATE public.messages SET status = NEW.status WHERE id = NEW.message_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='mse_after_insert_sync_status')
  THEN CREATE TRIGGER mse_after_insert_sync_status AFTER INSERT ON public.message_status_events FOR EACH ROW EXECUTE FUNCTION public.sync_messages_status_from_event();
  END IF;
END $$;

COMMIT;
-- ===== END FILE =====


-- ===== BEGIN FILE: migrations/zzz_vw_inbox_threads.sql =====
BEGIN;
CREATE OR REPLACE VIEW public.vw_inbox_threads AS
SELECT
  c.id                AS conversation_id,
  c.org_id,
  c.channel,
  ch.mode             AS transport,
  c.account_id,
  c.chat_id,
  c.contact_id,
  COALESCE(ct.display_name, ct.name, ct.phone_e164, ct.phone, c.chat_id) AS contact_name,
  c.status,
  c.ai_enabled,
  c.unread_count,
  c.last_message_at,
  COALESCE(
    (
      SELECT ARRAY_AGG(t.name ORDER BY t.name)
      FROM public.contact_tags  ctags
      JOIN public.tags          t ON t.id = ctags.tag_id
      WHERE ctags.contact_id = c.contact_id
        AND ctags.org_id    = c.org_id
        AND t.org_id        = c.org_id
    ),
    ARRAY[]::text[]
  ) AS tags
FROM public.conversations c
JOIN public.channels      ch ON ch.id = c.channel_id
LEFT JOIN public.contacts ct ON ct.id = c.contact_id;

COMMIT;
-- ===== END FILE =====


-- ===== APPENDED: bootstrap_from_indexes.sql =====

-- Bootstrap SQL generated from uploaded index list


CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.util_digits(text) RETURNS text
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE AS $$ SELECT regexp_replace($1, '\D', '', 'g') $$;


CREATE OR REPLACE FUNCTION public.util_email_lower(text) RETURNS text
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE AS $$ SELECT lower($1) $$;


CREATE OR REPLACE FUNCTION public.util_br_e164(text) RETURNS text
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE AS $$ 
  SELECT CASE 
    WHEN $1 IS NULL THEN NULL
    ELSE '+' || regexp_replace(regexp_replace($1, '\D', '', 'g'), '^(?!55)', '55')
  END;
$$;



-- === Minimal tables inferred from indexes ===

CREATE TABLE IF NOT EXISTS public.ai_credit_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text,
  org_id uuid,
  period_start timestamptz,
  user_id uuid
);

CREATE TABLE IF NOT EXISTS public.ai_usage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);

CREATE TABLE IF NOT EXISTS public.appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);

CREATE TABLE IF NOT EXISTS public.assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);

CREATE TABLE IF NOT EXISTS public.attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);

CREATE TABLE IF NOT EXISTS public.calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);

CREATE TABLE IF NOT EXISTS public.calendar_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);

CREATE TABLE IF NOT EXISTS public.calendar_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);

CREATE TABLE IF NOT EXISTS public.calendars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);

CREATE TABLE IF NOT EXISTS public.channel_accounts (
  channel text,
  external_account_id uuid,
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid
);

CREATE TABLE IF NOT EXISTS public.channel_id_map (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_type text,
  external_id uuid,
  org_id uuid
);

CREATE TABLE IF NOT EXISTS public.channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mode text,
  org_id uuid,
  type text
);

CREATE TABLE IF NOT EXISTS public.clients (
  NULL text,
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid
);

CREATE TABLE IF NOT EXISTS public.contact_identities (
  account_id uuid,
  channel text,
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identity text,
  org_id uuid
);

CREATE TABLE IF NOT EXISTS public.contact_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid,
  tag_id uuid
);

CREATE TABLE IF NOT EXISTS public.contacts (
  NULL text,
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid
);

CREATE TABLE IF NOT EXISTS public.content_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);

CREATE TABLE IF NOT EXISTS public.content_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);

CREATE TABLE IF NOT EXISTS public.content_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);

CREATE TABLE IF NOT EXISTS public.conversations (
  account_id uuid,
  channel text,
  chat_id uuid,
  external_user_id uuid,
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid,
  transport text
);

CREATE TABLE IF NOT EXISTS public.crm_opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);

CREATE TABLE IF NOT EXISTS public.email_automation_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);

CREATE TABLE IF NOT EXISTS public.email_automations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);

CREATE TABLE IF NOT EXISTS public.email_campaign_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);

CREATE TABLE IF NOT EXISTS public.email_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);

CREATE TABLE IF NOT EXISTS public.email_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);

CREATE TABLE IF NOT EXISTS public.email_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);

CREATE TABLE IF NOT EXISTS public.email_segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);

CREATE TABLE IF NOT EXISTS public.email_subscriptions (
  email text,
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id uuid,
  org_id uuid
);

CREATE TABLE IF NOT EXISTS public.email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);

CREATE TABLE IF NOT EXISTS public.facebook_oauth_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id uuid
);

CREATE TABLE IF NOT EXISTS public.facebook_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid,
  page_id uuid
);

CREATE TABLE IF NOT EXISTS public.facebook_publish_jobs (
  client_dedupe_key) WHERE (status = ANY (ARRAY['pending'::text, 'creating'::text, 'publishing'::text]) text,
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid,
  page_id uuid
);

CREATE TABLE IF NOT EXISTS public.feature_defs (
  code text,
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);

CREATE TABLE IF NOT EXISTS public.google_calendar_accounts (
  google_user_id uuid,
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid
);

CREATE TABLE IF NOT EXISTS public.google_oauth_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);

CREATE TABLE IF NOT EXISTS public.import_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);

CREATE TABLE IF NOT EXISTS public.instagram_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ig_user_id uuid,
  org_id uuid
);

CREATE TABLE IF NOT EXISTS public.instagram_oauth_tokens (
  account_id uuid,
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);

CREATE TABLE IF NOT EXISTS public.instagram_publish_jobs (
  account_id uuid,
  client_dedupe_key) WHERE (status = ANY (ARRAY['pending'::text, 'creating'::text, 'publishing'::text]) text,
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid
);

CREATE TABLE IF NOT EXISTS public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);

CREATE TABLE IF NOT EXISTS public.leads (
  NULL text,
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid
);

CREATE TABLE IF NOT EXISTS public.lgpd_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);

CREATE TABLE IF NOT EXISTS public.lgpd_erasure_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);

CREATE TABLE IF NOT EXISTS public.message_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idx text,
  message_id uuid
);

CREATE TABLE IF NOT EXISTS public.message_status_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);

CREATE TABLE IF NOT EXISTS public.message_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);

CREATE TABLE IF NOT EXISTS public.message_transcripts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);

CREATE TABLE IF NOT EXISTS public.messages (
  NULL text,
  external_message_id uuid,
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid,
  platform text,
  thread_id uuid
);

CREATE TABLE IF NOT EXISTS public.nps_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);

CREATE TABLE IF NOT EXISTS public.nps_surveys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);

CREATE TABLE IF NOT EXISTS public.onboarding_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);

CREATE TABLE IF NOT EXISTS public.org_ai_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid
);

CREATE TABLE IF NOT EXISTS public.org_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid,
  user_id uuid
);

CREATE TABLE IF NOT EXISTS public.org_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);

CREATE TABLE IF NOT EXISTS public.org_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid,
  user_id uuid
);

CREATE TABLE IF NOT EXISTS public.organization_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid
);

CREATE TABLE IF NOT EXISTS public.organizations (
  NULL text,
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text
);

CREATE TABLE IF NOT EXISTS public.orgs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);

CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);

CREATE TABLE IF NOT EXISTS public.plan_features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_code text,
  plan_id uuid
);

CREATE TABLE IF NOT EXISTS public.plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);

CREATE TABLE IF NOT EXISTS public.posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);

CREATE TABLE IF NOT EXISTS public.purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);

CREATE TABLE IF NOT EXISTS public.repurpose_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid
);

CREATE TABLE IF NOT EXISTS public.rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);

CREATE TABLE IF NOT EXISTS public.social_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid
);

CREATE TABLE IF NOT EXISTS public.support_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);

CREATE TABLE IF NOT EXISTS public.tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  org_id uuid
);

CREATE TABLE IF NOT EXISTS public.templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);

CREATE TABLE IF NOT EXISTS public.usage_counters (
  client_id uuid,
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_key text,
  period_end timestamptz,
  period_start timestamptz
);

CREATE TABLE IF NOT EXISTS public.users (
  email text,
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);

CREATE TABLE IF NOT EXISTS public.whatsapp_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid,
  phone_e164 text
);

CREATE TABLE IF NOT EXISTS public.whatsapp_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);


-- === Recreate indexes (idempotent) ===

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='ai_credit_usage_pkey') THEN
    CREATE UNIQUE INDEX ai_credit_usage_pkey ON public.ai_credit_usage USING btree (org_id, user_id, category, period_start);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='ai_usage_logs_pkey') THEN
    CREATE UNIQUE INDEX ai_usage_logs_pkey ON public.ai_usage_logs USING btree (id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='appointments_pkey') THEN
    CREATE UNIQUE INDEX appointments_pkey ON public.appointments USING btree (id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='assets_pkey') THEN
    CREATE UNIQUE INDEX assets_pkey ON public.assets USING btree (id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='attachments_pkey') THEN
    CREATE UNIQUE INDEX attachments_pkey ON public.attachments USING btree (id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='audit_logs_pkey') THEN
    CREATE UNIQUE INDEX audit_logs_pkey ON public.audit_logs USING btree (id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='calendar_events_pkey') THEN
    CREATE UNIQUE INDEX calendar_events_pkey ON public.calendar_events USING btree (id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='calendar_integrations_pkey') THEN
    CREATE UNIQUE INDEX calendar_integrations_pkey ON public.calendar_integrations USING btree (id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='calendar_members_pkey') THEN
    CREATE UNIQUE INDEX calendar_members_pkey ON public.calendar_members USING btree (id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='calendars_pkey') THEN
    CREATE UNIQUE INDEX calendars_pkey ON public.calendars USING btree (id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='channel_accounts_org_id_channel_external_account_id_key') THEN
    CREATE UNIQUE INDEX channel_accounts_org_id_channel_external_account_id_key ON public.channel_accounts USING btree (org_id, channel, external_account_id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='channel_accounts_pkey') THEN
    CREATE UNIQUE INDEX channel_accounts_pkey ON public.channel_accounts USING btree (id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='channel_id_map_pkey') THEN
    CREATE UNIQUE INDEX channel_id_map_pkey ON public.channel_id_map USING btree (org_id, channel_type, external_id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='channels_pkey') THEN
    CREATE UNIQUE INDEX channels_pkey ON public.channels USING btree (id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='idx_channels_org_type_mode') THEN
    CREATE UNIQUE INDEX idx_channels_org_type_mode ON public.channels USING btree (org_id, type, mode);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='clients_pkey') THEN
    CREATE UNIQUE INDEX clients_pkey ON public.clients USING btree (id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='ux_clients_org_email_lower') THEN
    CREATE UNIQUE INDEX ux_clients_org_email_lower ON public.clients USING btree (org_id, lower(email)) WHERE (email IS NOT NULL);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='contact_identities_org_id_channel_account_id_identity_key') THEN
    CREATE UNIQUE INDEX contact_identities_org_id_channel_account_id_identity_key ON public.contact_identities USING btree (org_id, channel, account_id, identity);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='contact_identities_pkey') THEN
    CREATE UNIQUE INDEX contact_identities_pkey ON public.contact_identities USING btree (id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='contact_tags_pkey') THEN
    CREATE UNIQUE INDEX contact_tags_pkey ON public.contact_tags USING btree (contact_id, tag_id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='contacts_pkey') THEN
    CREATE UNIQUE INDEX contacts_pkey ON public.contacts USING btree (id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='uq_contacts_org_cpf') THEN
    CREATE UNIQUE INDEX uq_contacts_org_cpf ON public.contacts USING btree (org_id, cpf) WHERE (cpf IS NOT NULL);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='ux_contacts_org_cnpj_digits') THEN
    CREATE UNIQUE INDEX ux_contacts_org_cnpj_digits ON public.contacts USING btree (org_id, util_digits(cnpj)) WHERE (cnpj IS NOT NULL);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='ux_contacts_org_cpf_digits') THEN
    CREATE UNIQUE INDEX ux_contacts_org_cpf_digits ON public.contacts USING btree (org_id, util_digits(cpf)) WHERE (cpf IS NOT NULL);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='ux_contacts_org_email_lower') THEN
    CREATE UNIQUE INDEX ux_contacts_org_email_lower ON public.contacts USING btree (org_id, util_email_lower(email)) WHERE (email IS NOT NULL);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='ux_contacts_org_phone_e164') THEN
    CREATE UNIQUE INDEX ux_contacts_org_phone_e164 ON public.contacts USING btree (org_id, phone_e164) WHERE (phone_e164 IS NOT NULL);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='content_assets_pkey') THEN
    CREATE UNIQUE INDEX content_assets_pkey ON public.content_assets USING btree (id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='content_campaigns_pkey') THEN
    CREATE UNIQUE INDEX content_campaigns_pkey ON public.content_campaigns USING btree (id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='content_suggestions_pkey') THEN
    CREATE UNIQUE INDEX content_suggestions_pkey ON public.content_suggestions USING btree (id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='conv_chat_transport_idx') THEN
    CREATE UNIQUE INDEX conv_chat_transport_idx ON public.conversations USING btree (chat_id, transport);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='conversations_pkey') THEN
    CREATE UNIQUE INDEX conversations_pkey ON public.conversations USING btree (id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='uq_conversations_uniqueness') THEN
    CREATE UNIQUE INDEX uq_conversations_uniqueness ON public.conversations USING btree (org_id, channel, account_id, external_user_id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='crm_opportunities_pkey') THEN
    CREATE UNIQUE INDEX crm_opportunities_pkey ON public.crm_opportunities USING btree (id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='email_automation_steps_pkey') THEN
    CREATE UNIQUE INDEX email_automation_steps_pkey ON public.email_automation_steps USING btree (id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='email_automations_pkey') THEN
    CREATE UNIQUE INDEX email_automations_pkey ON public.email_automations USING btree (id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='email_campaign_recipients_pkey') THEN
    CREATE UNIQUE INDEX email_campaign_recipients_pkey ON public.email_campaign_recipients USING btree (id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='email_campaigns_pkey') THEN
    CREATE UNIQUE INDEX email_campaigns_pkey ON public.email_campaigns USING btree (id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='email_events_pkey') THEN
    CREATE UNIQUE INDEX email_events_pkey ON public.email_events USING btree (id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='email_lists_pkey') THEN
    CREATE UNIQUE INDEX email_lists_pkey ON public.email_lists USING btree (id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='email_segments_pkey') THEN
    CREATE UNIQUE INDEX email_segments_pkey ON public.email_segments USING btree (id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='email_subscriptions_org_id_list_id_email_key') THEN
    CREATE UNIQUE INDEX email_subscriptions_org_id_list_id_email_key ON public.email_subscriptions USING btree (org_id, list_id, email);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='email_subscriptions_pkey') THEN
    CREATE UNIQUE INDEX email_subscriptions_pkey ON public.email_subscriptions USING btree (id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='email_templates_pkey') THEN
    CREATE UNIQUE INDEX email_templates_pkey ON public.email_templates USING btree (id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='facebook_oauth_tokens_page_id_key') THEN
    CREATE UNIQUE INDEX facebook_oauth_tokens_page_id_key ON public.facebook_oauth_tokens USING btree (page_id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='facebook_oauth_tokens_pkey') THEN
    CREATE UNIQUE INDEX facebook_oauth_tokens_pkey ON public.facebook_oauth_tokens USING btree (id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='facebook_pages_org_id_page_id_key') THEN
    CREATE UNIQUE INDEX facebook_pages_org_id_page_id_key ON public.facebook_pages USING btree (org_id, page_id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='facebook_pages_pkey') THEN
    CREATE UNIQUE INDEX facebook_pages_pkey ON public.facebook_pages USING btree (id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='facebook_publish_jobs_pkey') THEN
    CREATE UNIQUE INDEX facebook_publish_jobs_pkey ON public.facebook_publish_jobs USING btree (id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='ux_fb_jobs_dedupe') THEN
    CREATE UNIQUE INDEX ux_fb_jobs_dedupe ON public.facebook_publish_jobs USING btree (org_id, page_id, client_dedupe_key) WHERE (status = ANY (ARRAY['pending'::text, 'creating'::text, 'publishing'::text]));
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='feature_defs_code_key') THEN
    CREATE UNIQUE INDEX feature_defs_code_key ON public.feature_defs USING btree (code);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='feature_defs_pkey') THEN
    CREATE UNIQUE INDEX feature_defs_pkey ON public.feature_defs USING btree (id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='google_calendar_accounts_org_id_google_user_id_key') THEN
    CREATE UNIQUE INDEX google_calendar_accounts_org_id_google_user_id_key ON public.google_calendar_accounts USING btree (org_id, google_user_id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='google_calendar_accounts_pkey') THEN
    CREATE UNIQUE INDEX google_calendar_accounts_pkey ON public.google_calendar_accounts USING btree (id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='google_oauth_tokens_pkey') THEN
    CREATE UNIQUE INDEX google_oauth_tokens_pkey ON public.google_oauth_tokens USING btree (id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='import_runs_pkey') THEN
    CREATE UNIQUE INDEX import_runs_pkey ON public.import_runs USING btree (id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='instagram_accounts_org_id_ig_user_id_key') THEN
    CREATE UNIQUE INDEX instagram_accounts_org_id_ig_user_id_key ON public.instagram_accounts USING btree (org_id, ig_user_id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='instagram_accounts_pkey') THEN
    CREATE UNIQUE INDEX instagram_accounts_pkey ON public.instagram_accounts USING btree (id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='instagram_oauth_tokens_account_id_key') THEN
    CREATE UNIQUE INDEX instagram_oauth_tokens_account_id_key ON public.instagram_oauth_tokens USING btree (account_id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='instagram_oauth_tokens_pkey') THEN
    CREATE UNIQUE INDEX instagram_oauth_tokens_pkey ON public.instagram_oauth_tokens USING btree (id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='instagram_publish_jobs_pkey') THEN
    CREATE UNIQUE INDEX instagram_publish_jobs_pkey ON public.instagram_publish_jobs USING btree (id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='ux_ig_jobs_dedupe') THEN
    CREATE UNIQUE INDEX ux_ig_jobs_dedupe ON public.instagram_publish_jobs USING btree (org_id, account_id, client_dedupe_key) WHERE (status = ANY (ARRAY['pending'::text, 'creating'::text, 'publishing'::text]));
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='invoices_pkey') THEN
    CREATE UNIQUE INDEX invoices_pkey ON public.invoices USING btree (id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='leads_pkey') THEN
    CREATE UNIQUE INDEX leads_pkey ON public.leads USING btree (id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='ux_leads_email') THEN
    CREATE UNIQUE INDEX ux_leads_email ON public.leads USING btree (org_id, email) WHERE (email IS NOT NULL);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='ux_leads_phone') THEN
    CREATE UNIQUE INDEX ux_leads_phone ON public.leads USING btree (org_id, phone) WHERE (phone IS NOT NULL);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='lgpd_consents_pkey') THEN
    CREATE UNIQUE INDEX lgpd_consents_pkey ON public.lgpd_consents USING btree (id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='lgpd_erasure_requests_pkey') THEN
    CREATE UNIQUE INDEX lgpd_erasure_requests_pkey ON public.lgpd_erasure_requests USING btree (id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='message_attachments_pkey') THEN
    CREATE UNIQUE INDEX message_attachments_pkey ON public.message_attachments USING btree (id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='uq_ma_message_idx') THEN
    CREATE UNIQUE INDEX uq_ma_message_idx ON public.message_attachments USING btree (message_id, idx);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='message_status_events_pkey') THEN
    CREATE UNIQUE INDEX message_status_events_pkey ON public.message_status_events USING btree (id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='message_templates_pkey') THEN
    CREATE UNIQUE INDEX message_templates_pkey ON public.message_templates USING btree (id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='message_transcripts_pkey') THEN
    CREATE UNIQUE INDEX message_transcripts_pkey ON public.message_transcripts USING btree (id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='messages_pkey') THEN
    CREATE UNIQUE INDEX messages_pkey ON public.messages USING btree (id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='msg_provider_unique') THEN
    CREATE UNIQUE INDEX msg_provider_unique ON public.messages USING btree (provider_msg_id) WHERE (provider_msg_id IS NOT NULL);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='uq_messages_external') THEN
    CREATE UNIQUE INDEX uq_messages_external ON public.messages USING btree (org_id, external_message_id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='uq_messages_platform_thread_msg') THEN
    CREATE UNIQUE INDEX uq_messages_platform_thread_msg ON public.messages USING btree (platform, thread_id, external_message_id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='nps_responses_pkey') THEN
    CREATE UNIQUE INDEX nps_responses_pkey ON public.nps_responses USING btree (id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='nps_surveys_pkey') THEN
    CREATE UNIQUE INDEX nps_surveys_pkey ON public.nps_surveys USING btree (id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='onboarding_tasks_pkey') THEN
    CREATE UNIQUE INDEX onboarding_tasks_pkey ON public.onboarding_tasks USING btree (id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='org_ai_settings_pkey') THEN
    CREATE UNIQUE INDEX org_ai_settings_pkey ON public.org_ai_settings USING btree (org_id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='uq_org_ai_settings_org') THEN
    CREATE UNIQUE INDEX uq_org_ai_settings_org ON public.org_ai_settings USING btree (org_id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='org_memberships_pkey') THEN
    CREATE UNIQUE INDEX org_memberships_pkey ON public.org_memberships USING btree (org_id, user_id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='org_tags_pkey') THEN
    CREATE UNIQUE INDEX org_tags_pkey ON public.org_tags USING btree (id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='org_users_pkey') THEN
    CREATE UNIQUE INDEX org_users_pkey ON public.org_users USING btree (org_id, user_id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='organization_settings_pkey') THEN
    CREATE UNIQUE INDEX organization_settings_pkey ON public.organization_settings USING btree (org_id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='organizations_pkey') THEN
    CREATE UNIQUE INDEX organizations_pkey ON public.organizations USING btree (id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='organizations_slug_key') THEN
    CREATE UNIQUE INDEX organizations_slug_key ON public.organizations USING btree (slug);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='ux_organizations_document_digits') THEN
    CREATE UNIQUE INDEX ux_organizations_document_digits ON public.organizations USING btree (util_digits(document_value)) WHERE (document_value IS NOT NULL);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='ux_organizations_email_lower') THEN
    CREATE UNIQUE INDEX ux_organizations_email_lower ON public.organizations USING btree (util_email_lower(email)) WHERE (email IS NOT NULL);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='ux_organizations_phone_e164') THEN
    CREATE UNIQUE INDEX ux_organizations_phone_e164 ON public.organizations USING btree (util_br_e164(phone)) WHERE (phone IS NOT NULL);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='ux_organizations_slug') THEN
    CREATE UNIQUE INDEX ux_organizations_slug ON public.organizations USING btree (slug);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='ux_orgs_cnpj_digits') THEN
    CREATE UNIQUE INDEX ux_orgs_cnpj_digits ON public.organizations USING btree (util_digits(cnpj)) WHERE (cnpj IS NOT NULL);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='ux_orgs_email_lower') THEN
    CREATE UNIQUE INDEX ux_orgs_email_lower ON public.organizations USING btree (util_email_lower(email)) WHERE (email IS NOT NULL);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='ux_orgs_phone_e164') THEN
    CREATE UNIQUE INDEX ux_orgs_phone_e164 ON public.organizations USING btree (phone_e164) WHERE (phone_e164 IS NOT NULL);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='orgs_pkey') THEN
    CREATE UNIQUE INDEX orgs_pkey ON public.orgs USING btree (id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='payments_pkey') THEN
    CREATE UNIQUE INDEX payments_pkey ON public.payments USING btree (id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='plan_features_pkey') THEN
    CREATE UNIQUE INDEX plan_features_pkey ON public.plan_features USING btree (plan_id, feature_code);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='ux_plan_features') THEN
    CREATE UNIQUE INDEX ux_plan_features ON public.plan_features USING btree (plan_id, feature_code);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='ux_plan_features_plan_code') THEN
    CREATE UNIQUE INDEX ux_plan_features_plan_code ON public.plan_features USING btree (plan_id, feature_code);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='plans_pkey') THEN
    CREATE UNIQUE INDEX plans_pkey ON public.plans USING btree (id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='posts_pkey') THEN
    CREATE UNIQUE INDEX posts_pkey ON public.posts USING btree (id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='purchases_pkey') THEN
    CREATE UNIQUE INDEX purchases_pkey ON public.purchases USING btree (id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='repurpose_jobs_pkey') THEN
    CREATE UNIQUE INDEX repurpose_jobs_pkey ON public.repurpose_jobs USING btree (post_id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='rewards_pkey') THEN
    CREATE UNIQUE INDEX rewards_pkey ON public.rewards USING btree (id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='social_posts_pkey') THEN
    CREATE UNIQUE INDEX social_posts_pkey ON public.social_posts USING btree (id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='subscriptions_org_id_key') THEN
    CREATE UNIQUE INDEX subscriptions_org_id_key ON public.subscriptions USING btree (org_id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='subscriptions_pkey') THEN
    CREATE UNIQUE INDEX subscriptions_pkey ON public.subscriptions USING btree (id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='support_audit_logs_pkey') THEN
    CREATE UNIQUE INDEX support_audit_logs_pkey ON public.support_audit_logs USING btree (id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='tags_pkey') THEN
    CREATE UNIQUE INDEX tags_pkey ON public.tags USING btree (id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='ux_tags_org_lower_name') THEN
    CREATE UNIQUE INDEX ux_tags_org_lower_name ON public.tags USING btree (org_id, lower(name));
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='templates_pkey') THEN
    CREATE UNIQUE INDEX templates_pkey ON public.templates USING btree (id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='usage_counters_client_id_module_key_period_start_period_end_key') THEN
    CREATE UNIQUE INDEX usage_counters_client_id_module_key_period_start_period_end_key ON public.usage_counters USING btree (client_id, module_key, period_start, period_end);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='usage_counters_pkey') THEN
    CREATE UNIQUE INDEX usage_counters_pkey ON public.usage_counters USING btree (id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='idx_users_email') THEN
    CREATE UNIQUE INDEX idx_users_email ON public.users USING btree (email);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='users_email_key') THEN
    CREATE UNIQUE INDEX users_email_key ON public.users USING btree (email);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='users_pkey') THEN
    CREATE UNIQUE INDEX users_pkey ON public.users USING btree (id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='whatsapp_channels_org_id_id_key') THEN
    CREATE UNIQUE INDEX whatsapp_channels_org_id_id_key ON public.whatsapp_channels USING btree (org_id, id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='whatsapp_channels_org_id_phone_e164_key') THEN
    CREATE UNIQUE INDEX whatsapp_channels_org_id_phone_e164_key ON public.whatsapp_channels USING btree (org_id, phone_e164);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='whatsapp_channels_pkey') THEN
    CREATE UNIQUE INDEX whatsapp_channels_pkey ON public.whatsapp_channels USING btree (id);
  END IF;
END$$;

DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname='whatsapp_templates_pkey') THEN
    CREATE UNIQUE INDEX whatsapp_templates_pkey ON public.whatsapp_templates USING btree (id);
  END IF;
END$$;





-- === Rich schema adjustments for commonly used tables ===
-- USERS
DO $$BEGIN
  IF to_regclass('public.users') IS NULL THEN
    RAISE EXCEPTION 'public.users should exist at this point';
  END IF;
END$$;

ALTER TABLE public.users
  ALTER COLUMN email TYPE text,
  ALTER COLUMN email DROP NOT NULL,
  ALTER COLUMN email SET NOT NULL;

-- ensure columns exist
DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='password_hash') THEN
    ALTER TABLE public.users ADD COLUMN password_hash text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='name') THEN
    ALTER TABLE public.users ADD COLUMN name text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='is_active') THEN
    ALTER TABLE public.users ADD COLUMN is_active boolean NOT NULL DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='created_at') THEN
    ALTER TABLE public.users ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='updated_at') THEN
    ALTER TABLE public.users ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='last_login_at') THEN
    ALTER TABLE public.users ADD COLUMN last_login_at timestamptz;
  END IF;
END$$;

-- MESSAGES
DO $$BEGIN
  IF to_regclass('public.messages') IS NULL THEN
    -- If messages wasn't in minimal set (unlikely), create it richer now
    CREATE TABLE public.messages (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id uuid,
      conversation_id uuid,
      channel text NOT NULL,
      direction text NOT NULL,
      external_message_id text,
      sender_id uuid,
      sender_name text,
      sender_role text,
      content text,
      content_type text DEFAULT 'text',
      attachments jsonb NOT NULL DEFAULT '[]',
      meta jsonb NOT NULL DEFAULT '{}',
      status text NOT NULL DEFAULT 'queued',
      error text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      sent_at timestamptz,
      delivered_at timestamptz,
      read_at timestamptz
    );
  END IF;
END$$;

DO $$BEGIN
  IF to_regclass('public.messages') IS NOT NULL THEN
    -- Ensure required columns exist
    PERFORM 1;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='messages' AND column_name='org_id') THEN
      ALTER TABLE public.messages ADD COLUMN org_id uuid;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='messages' AND column_name='conversation_id') THEN
      ALTER TABLE public.messages ADD COLUMN conversation_id uuid;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='messages' AND column_name='channel') THEN
      ALTER TABLE public.messages ADD COLUMN channel text NOT NULL DEFAULT 'whatsapp';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='messages' AND column_name='direction') THEN
      ALTER TABLE public.messages ADD COLUMN direction text NOT NULL DEFAULT 'in';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='messages' AND column_name='status') THEN
      ALTER TABLE public.messages ADD COLUMN status text NOT NULL DEFAULT 'queued';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='messages' AND column_name='attachments') THEN
      ALTER TABLE public.messages ADD COLUMN attachments jsonb NOT NULL DEFAULT '[]';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='messages' AND column_name='meta') THEN
      ALTER TABLE public.messages ADD COLUMN meta jsonb NOT NULL DEFAULT '{}';
    END IF;
  END IF;
END$$;

-- Direction/status checks
DO $$BEGIN
  IF to_regclass('public.messages') IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='messages_direction_check' AND conrelid=to_regclass('public.messages')) THEN
      ALTER TABLE public.messages ADD CONSTRAINT messages_direction_check CHECK (direction IN ('in','out'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='messages_status_check' AND conrelid=to_regclass('public.messages')) THEN
      ALTER TABLE public.messages ADD CONSTRAINT messages_status_check CHECK (status IN ('queued','sent','delivered','read','failed','received'));
    END IF;
  END IF;
END$$;
