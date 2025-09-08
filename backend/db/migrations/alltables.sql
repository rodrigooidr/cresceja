-- Extensões necessárias
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =========================
-- 1) Tenancy básico
-- =========================
CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  plan TEXT NOT NULL DEFAULT 'free',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NULL REFERENCES companies(id) ON DELETE SET NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'operator', -- admin|marketing|sales|operator
  is_owner BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMP NULL
);

-- =========================
-- 2) Leads / CRM
-- =========================
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NULL REFERENCES companies(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email TEXT NULL,
  phone TEXT NULL,
  status TEXT NOT NULL DEFAULT 'novo',      -- novo|qualificado|cliente|perdido
  source_channel TEXT NULL,                 -- whatsapp|instagram|facebook|landing|import_csv|...
  consent BOOLEAN NOT NULL DEFAULT FALSE,   -- LGPD consent
  score INTEGER NOT NULL DEFAULT 0,
  notes TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  erased_at TIMESTAMP NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_leads_email ON leads(email) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_leads_phone ON leads(phone) WHERE phone IS NOT NULL;

CREATE TABLE IF NOT EXISTS channel_id_map (
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  channel_type TEXT NOT NULL,
  external_id TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  PRIMARY KEY (channel_type, external_id)
);

CREATE TABLE IF NOT EXISTS crm_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Oportunidade',
  value NUMERIC(14,2) NULL,
  stage TEXT NOT NULL DEFAULT 'novo',   -- novo|qualificando|proposta|ganho|perdido
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_crm_opps_lead ON crm_opportunities(lead_id);

-- =========================
-- 3) Conversas e Mensagens
-- =========================
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  channel_type TEXT NOT NULL,                 -- whatsapp|instagram|facebook
  status TEXT NOT NULL DEFAULT 'open',        -- open|closed
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  direction TEXT NOT NULL,                    -- inbound|outbound
  type TEXT NOT NULL DEFAULT 'text',          -- text|image|audio|video|file|location|button
  text TEXT NULL,
  attachments JSONB NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_messages_lead ON messages(lead_id);
CREATE INDEX IF NOT EXISTS idx_conv_lead ON conversations(lead_id);

-- =========================
-- 4) Agenda (compromissos)
-- =========================
CREATE TABLE IF NOT EXISTS appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NULL REFERENCES leads(id) ON DELETE SET NULL,
  user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  title TEXT NOT NULL DEFAULT 'Atendimento',
  start_at TIMESTAMP NOT NULL,
  end_at TIMESTAMP NOT NULL,
  channel_type TEXT NULL,
  status TEXT NOT NULL DEFAULT 'pendente', -- pendente|confirmado|cancelado|reagendado
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_appointments_start ON appointments(start_at);

CREATE TABLE IF NOT EXISTS calendar_integrations (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,                    -- google|outlook
  tokens JSONB NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, provider)
);

-- =========================
-- 5) Marketing / Posts / Repurpose
-- =========================
CREATE TABLE IF NOT EXISTS social_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NULL REFERENCES companies(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  media_url TEXT NULL,
  channel TEXT NOT NULL,          -- instagram|facebook|linkedin|instagram_story|email_marketing|reels_tiktok
  scheduled_at TIMESTAMP NULL,
  status TEXT NOT NULL DEFAULT 'rascunho', -- rascunho|pendente|aprovado|publicado|erro
  created_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  approved_level INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS repurpose_jobs (
  post_id UUID PRIMARY KEY REFERENCES social_posts(id) ON DELETE CASCADE,
  status TEXT NOT NULL, -- queued|completed|failed
  result JSONB NOT NULL DEFAULT '{}'::jsonb,
  finished_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- =========================
-- 6) Anexos e Transcrição
-- =========================
CREATE TABLE IF NOT EXISTS attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  company_id UUID NULL REFERENCES companies(id) ON DELETE SET NULL,
  url TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'generic', -- generic|audio|image|video|document
  mime_type TEXT NULL,
  size INTEGER NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- =========================
-- 7) Segmentação
-- =========================
CREATE TABLE IF NOT EXISTS segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NULL REFERENCES companies(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  filter JSONB NOT NULL, -- { min_score: 60, channel:'whatsapp' ... }
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- =========================
-- 8) Uso de IA / Custos
-- =========================
CREATE TABLE IF NOT EXISTS ai_credit_usage (
  user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  category TEXT NOT NULL, -- attend|content|transcription
  period_start TIMESTAMP NOT NULL,
  period_end TIMESTAMP NOT NULL,
  used INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, category, period_start)
);

CREATE TABLE IF NOT EXISTS ai_usage_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  service TEXT NOT NULL, -- attend|content|transcription
  tokens INT NOT NULL DEFAULT 0,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_created ON ai_usage_logs(created_at);

-- =========================
-- 9) LGPD / Governança
-- =========================
CREATE TABLE IF NOT EXISTS lgpd_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  consent BOOLEAN NOT NULL,
  purpose TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lgpd_erasure_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,             -- ex: message.send, post.approve
  target_type TEXT NULL,            -- lead|message|post|user|...
  target_id UUID NULL,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);

-- =========================
-- 10) WhatsApp Templates
-- =========================
CREATE TABLE IF NOT EXISTS whatsapp_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'pt_BR',
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- =========================
-- 11) Seeds úteis (opcionais)
-- =========================
INSERT INTO companies (id, name, plan)
SELECT '00000000-0000-0000-0000-000000000001', 'CresceJá Demo', 'pro'
WHERE NOT EXISTS (SELECT 1 FROM companies WHERE id='00000000-0000-0000-0000-000000000001');

INSERT INTO users (id, company_id, email, name, role, is_owner)
SELECT '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000001',
       'owner@cresceja.local', 'Owner', 'admin', TRUE
WHERE NOT EXISTS (SELECT 1 FROM users WHERE id='11111111-1111-1111-1111-111111111111');

-- =========================
-- 12) Billing (planos e clientes)
-- =========================
CREATE TABLE IF NOT EXISTS plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  monthly_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'BRL',
  modules JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_published BOOLEAN NOT NULL DEFAULT false,
  sort_order INT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NULL, -- vincule ao seu users.id
  company_name TEXT NULL,
  email TEXT NULL,
  active BOOLEAN NOT NULL DEFAULT false,
  start_date DATE NULL,
  end_date DATE NULL,
  plan_id TEXT NULL REFERENCES plans(id) ON UPDATE CASCADE ON DELETE SET NULL,
  modules JSONB NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

INSERT INTO plans (id, name, monthly_price, currency, modules, is_published)
VALUES
 ('starter','Starter',79,'BRL','{
    "omnichannel":{"enabled":true,"chat_sessions":200},
    "crm":{"enabled":true,"opportunities":500},
    "marketing":{"enabled":true,"posts_per_month":20},
    "approvals":{"enabled":true},
    "ai_credits":{"enabled":true,"credits":10000},
    "governance":{"enabled":true}
 }'::jsonb,false),
 ('pro','Pro',199,'BRL','{
    "omnichannel":{"enabled":true,"chat_sessions":1000},
    "crm":{"enabled":true,"opportunities":5000},
    "marketing":{"enabled":true,"posts_per_month":80},
    "approvals":{"enabled":true},
    "ai_credits":{"enabled":true,"credits":50000},
    "governance":{"enabled":true}
 }'::jsonb,false),
 ('business','Business',399,'BRL','{
    "omnichannel":{"enabled":true,"chat_sessions":5000},
    "crm":{"enabled":true,"opportunities":30000},
    "marketing":{"enabled":true,"posts_per_month":300},
    "approvals":{"enabled":true},
    "ai_credits":{"enabled":true,"credits":200000},
    "governance":{"enabled":true}
 }'::jsonb,false)
ON CONFLICT (id) DO UPDATE
SET name=EXCLUDED.name,
    monthly_price=EXCLUDED.monthly_price,
    currency=EXCLUDED.currency,
    modules=EXCLUDED.modules;

-- =========================
-- 13) Ajustes de planos e contadores de uso
-- =========================
ALTER TABLE plans
  ADD COLUMN IF NOT EXISTS is_free boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS trial_days integer DEFAULT 14,              -- dias do free
  ADD COLUMN IF NOT EXISTS billing_period_months integer DEFAULT 1;    -- meses do ciclo pago

CREATE INDEX IF NOT EXISTS idx_clients_active_dates
  ON clients(active, start_date, end_date);

CREATE TABLE IF NOT EXISTS usage_counters (
  id bigserial PRIMARY KEY,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  module_key text NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  used bigint NOT NULL DEFAULT 0,
  quota bigint,
  UNIQUE (client_id, module_key, period_start, period_end)
);

INSERT INTO plans (id, name, monthly_price, currency, modules, is_published, sort_order, is_free, trial_days, billing_period_months)
VALUES (
  'free',
  'Free',
  0,
  'BRL',
  '{
     "omnichannel": {"enabled": true,  "chat_sessions": 50},
     "crm":         {"enabled": true,  "opportunities": 50},
     "marketing":   {"enabled": false, "posts_per_month": 0},
     "approvals":   {"enabled": false},
     "ai_credits":  {"enabled": true,  "credits": 2000},
     "governance":  {"enabled": true}
   }'::jsonb,
  true,
  0,
  true,
  14,
  0
)
ON CONFLICT (id) DO UPDATE SET
  name='Free',
  monthly_price=0,
  currency='BRL',
  modules=EXCLUDED.modules,
  is_published=true,
  sort_order=0,
  is_free=true,
  trial_days=EXCLUDED.trial_days,
  billing_period_months=0;

CREATE TABLE IF NOT EXISTS leads (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  email TEXT,
  telefone TEXT NOT NULL,
  origem TEXT,
  status TEXT NOT NULL DEFAULT 'novo',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

ALTER TABLE leads ADD COLUMN IF NOT EXISTS score INTEGER DEFAULT 0;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS responsavel TEXT;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS opportunities (
  id SERIAL PRIMARY KEY,                             -- pode manter INTEGER aqui, sem problema
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  cliente TEXT NOT NULL,
  valor_estimado NUMERIC(12,2) DEFAULT 0,
  responsavel TEXT,
  status TEXT NOT NULL DEFAULT 'prospeccao',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_opportunities_status ON opportunities(status);
CREATE INDEX IF NOT EXISTS idx_opportunities_lead_id ON opportunities(lead_id);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_opportunities_set_updated_at ON opportunities;

CREATE TRIGGER trg_opportunities_set_updated_at
BEFORE UPDATE ON opportunities
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS clients (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  email TEXT,
  telefone TEXT,
  contrato_url TEXT,
  status TEXT NOT NULL DEFAULT 'ativo',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE EXTENSION IF NOT EXISTS pgcrypto; -- caso use UUID em outras tabelas

CREATE TABLE IF NOT EXISTS onboarding_tasks (
  id SERIAL PRIMARY KEY,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  contrato BOOLEAN DEFAULT FALSE,
  assinatura BOOLEAN DEFAULT FALSE,
  nota_fiscal BOOLEAN DEFAULT FALSE,
  treinamento BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_onboarding_tasks_client_id ON onboarding_tasks(client_id);
);

CREATE TABLE IF NOT EXISTS conversations (
  id SERIAL PRIMARY KEY,
  client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
  canal TEXT NOT NULL DEFAULT 'whatsapp',
  status TEXT NOT NULL DEFAULT 'pendente', -- pendente, em_andamento, resolvido
  assigned_to TEXT, -- email do atendente
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS messages (
  id SERIAL PRIMARY KEY,
  conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
  sender TEXT NOT NULL, -- 'cliente' | 'agente' | 'sistema'
  content TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);


-- NPS Surveys (liga em clients.id -> UUID)
CREATE TABLE IF NOT EXISTS nps_surveys (
  id SERIAL PRIMARY KEY,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  sent_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_nps_surveys_client_id ON nps_surveys(client_id);

-- NPS Responses (liga em nps_surveys.id -> INTEGER/SERIAL)
CREATE TABLE IF NOT EXISTS nps_responses (
  id SERIAL PRIMARY KEY,
  survey_id INTEGER REFERENCES nps_surveys(id) ON DELETE CASCADE,
  score INTEGER NOT NULL CHECK (score BETWEEN 0 AND 10),
  comment TEXT,
  responded_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_nps_responses_survey_id ON nps_responses(survey_id);

-- Rewards (liga em clients.id -> UUID)
CREATE TABLE IF NOT EXISTS rewards (
  id SERIAL PRIMARY KEY,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- cupom/bonus/upgrade
  value TEXT,
  expires_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rewards_client_id ON rewards(client_id);



CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  user_email TEXT,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  payload JSONB
);

DO $$
DECLARE
  v_user_email text := 'rodrigooidr@hotmail.com';  -- ajuste se precisar
  v_user_id uuid;
  v_org_id  uuid;

  has_created boolean;
  has_updated boolean;

  sql_ins text;
BEGIN
  -- 1) usuário
  SELECT id INTO v_user_id
  FROM public.users
  WHERE email = v_user_email
  LIMIT 1;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário % não encontrado', v_user_email;
  END IF;

  -- 2) org CresceJá (cria se não existir)
  SELECT id INTO v_org_id
  FROM public.orgs
  WHERE name = 'CresceJá'
  LIMIT 1;

  IF v_org_id IS NULL THEN
    -- Se sua tabela orgs não tiver created_at/updated_at, remova-os abaixo
    INSERT INTO public.orgs (id, name, created_at, updated_at)
    VALUES (uuid_generate_v4(), 'CresceJá', now(), now())
    RETURNING id INTO v_org_id;
  END IF;

  -- 3) vincular na org_users (sem coluna perms)
  IF NOT EXISTS (SELECT 1 FROM public.org_users WHERE org_id = v_org_id AND user_id = v_user_id) THEN
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='org_users' AND column_name='created_at'
    ) INTO has_created;

    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='org_users' AND column_name='updated_at'
    ) INTO has_updated;

    sql_ins := 'INSERT INTO public.org_users (org_id, user_id, role';
    IF has_created THEN sql_ins := sql_ins || ', created_at'; END IF;
    IF has_updated THEN sql_ins := sql_ins || ', updated_at'; END IF;
    sql_ins := sql_ins || ') VALUES ($1, $2, ''OrgOwner''';
    IF has_created THEN sql_ins := sql_ins || ', now()'; END IF;
    IF has_updated THEN sql_ins := sql_ins || ', now()'; END IF;
    sql_ins := sql_ins || ')';

    EXECUTE sql_ins USING v_org_id, v_user_id;
  END IF;

  RAISE NOTICE 'OK: usuário % vinculado à org %', v_user_id, v_org_id;
END
$$;

CREATE INDEX IF NOT EXISTS idx_conversations_org_contact ON conversations(org_id, contact_id);
CREATE INDEX IF NOT EXISTS idx_conversations_channel_id   ON conversations(channel_id);
CREATE INDEX IF NOT EXISTS idx_contacts_phone             ON contacts(phone_e164);

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS ai_enabled boolean NOT NULL DEFAULT true;
  
  ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS ai_enabled boolean NOT NULL DEFAULT true;
  
  CREATE INDEX IF NOT EXISTS idx_conversations_org_last ON public.conversations(org_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_org_contact ON public.conversations(org_id, contact_id);
CREATE INDEX IF NOT EXISTS idx_messages_conv_created ON public.messages(conversation_id, created_at DESC);

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DO $$
DECLARE
  v_org_id  uuid := '00000000-0000-0000-0000-000000000001'; -- troque se quiser
  v_phone   text := '+5511999990001';
  v_ch_id   uuid;
  v_ct_id   uuid;
  v_conv_id uuid;
  v_wa_type text;
BEGIN
  -- pega um tipo de WhatsApp aceito pelo seu CHECK
  SELECT CASE
           WHEN EXISTS (
             SELECT 1 FROM pg_constraint
              WHERE conrelid='public.channels'::regclass
                AND conname='channels_type_check'
                AND pg_get_constraintdef(oid) ILIKE '%''whatsapp_cloud''%'
           ) THEN 'whatsapp_cloud'
           WHEN EXISTS (
             SELECT 1 FROM pg_constraint
              WHERE conrelid='public.channels'::regclass
                AND conname='channels_type_check'
                AND pg_get_constraintdef(oid) ILIKE '%''whatsapp_baileys''%'
           ) THEN 'whatsapp_baileys'
           ELSE 'whatsapp_cloud'
         END INTO v_wa_type;

  -- canal
  SELECT id INTO v_ch_id
  FROM public.channels
  WHERE org_id = v_org_id AND type = v_wa_type AND name = 'WhatsApp Principal'
  LIMIT 1;

  IF v_ch_id IS NULL THEN
    INSERT INTO public.channels (id, org_id, type, name, config, secrets, created_at)
    VALUES (uuid_generate_v4(), v_org_id, v_wa_type, 'WhatsApp Principal', '{}'::jsonb, '{}'::jsonb, now())
    RETURNING id INTO v_ch_id;
  END IF;

  -- contato
  SELECT id INTO v_ct_id
  FROM public.contacts
  WHERE org_id = v_org_id AND phone_e164 = v_phone
  LIMIT 1;

  IF v_ct_id IS NULL THEN
    INSERT INTO public.contacts (id, org_id, name, phone_e164, created_at, updated_at, tags)
    VALUES (uuid_generate_v4(), v_org_id, 'Cliente Teste', v_phone, now(), now(), ARRAY['vip'])
    RETURNING id INTO v_ct_id;
  END IF;

  -- conversa
  SELECT id INTO v_conv_id
  FROM public.conversations
  WHERE org_id = v_org_id AND contact_id = v_ct_id AND channel_id = v_ch_id
  LIMIT 1;

  IF v_conv_id IS NULL THEN
    INSERT INTO public.conversations (id, org_id, contact_id, channel_id, status, unread_count, last_message_at, created_at, updated_at)
    VALUES (uuid_generate_v4(), v_org_id, v_ct_id, v_ch_id, 'pending', 0, now(), now(), now())
    RETURNING id INTO v_conv_id;
  END IF;

  -- insere mensagens somente se ainda não houver
  IF NOT EXISTS (SELECT 1 FROM public.messages WHERE org_id=v_org_id AND conversation_id=v_conv_id) THEN
    -- detecta colunas opcionais
    PERFORM 1
    FROM information_schema.columns
    WHERE table_schema='public' AND table_name='messages' AND column_name='sender';

    IF FOUND THEN
      -- sua base exige sender e (provavelmente) direction; use os valores aceitos pelo CHECK
      INSERT INTO public.messages
        (id, org_id, conversation_id, sender, direction, "from", provider, type, text, status, created_at, updated_at)
      VALUES
        -- cliente → inbound
        (uuid_generate_v4(), v_org_id, v_conv_id, 'contact', 'inbound',  'customer', 'wa', 'text', 'Olá! Quero saber sobre o serviço.', 'sent', now(), now()),
        -- agente → outbound
        (uuid_generate_v4(), v_org_id, v_conv_id, 'agent',   'outbound', 'agent',    'wa', 'text', 'Oi! Posso ajudar, qual a sua dúvida?', 'sent', now(), now());
    ELSE
      -- versão simples (sem sender/direction)
      INSERT INTO public.messages
        (id, org_id, conversation_id, "from", provider, type, text, status, created_at, updated_at)
      VALUES
        (uuid_generate_v4(), v_org_id, v_conv_id, 'customer', 'wa', 'text', 'Olá! Quero saber sobre o serviço.', 'sent', now(), now()),
        (uuid_generate_v4(), v_org_id, v_conv_id, 'agent',    'wa', 'text', 'Oi! Posso ajudar, qual a sua dúvida?', 'sent', now(), now());
    END IF;
  END IF;

  UPDATE public.conversations
     SET last_message_at = now(), updated_at = now()
   WHERE id = v_conv_id;
END
$$;


ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS notes     text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS birthdate date;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS tags      text[] DEFAULT '{}';

CREATE TABLE IF NOT EXISTS public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  channel text NOT NULL DEFAULT 'whatsapp',
  status  text NOT NULL DEFAULT 'open',
  ai_enabled boolean NOT NULL DEFAULT false,
  unread_count int NOT NULL DEFAULT 0,
  last_message_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_conversations_org ON public.conversations(org_id);
CREATE INDEX IF NOT EXISTS idx_conversations_last ON public.conversations(org_id, last_message_at DESC);

-- messages
CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  author_id text,
  direction text NOT NULL, -- 'in' | 'out'
  text text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_messages_conv ON public.messages(org_id, conversation_id, created_at);

-- índice para busca por nome
CREATE INDEX IF NOT EXISTS idx_clients_org_name ON public.clients(org_id, lower(name));

-- ==== CLIENTS: colunas opcionais usadas pelo app ====
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS notes     text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS birthdate date;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS tags      text[] DEFAULT '{}';

-- índice de busca por nome
CREATE INDEX IF NOT EXISTS idx_clients_org_name ON public.clients(org_id, lower(name));

-- ==== CONVERSATIONS: alinhar ao modelo atual ====
-- cria tabela se não existir
CREATE TABLE IF NOT EXISTS public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- acrescenta colunas que podem faltar
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS client_id uuid,
  ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'whatsapp',
  ADD COLUMN IF NOT EXISTS status  text NOT NULL DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS ai_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS unread_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_message_at timestamptz;

-- FK para clients (se ainda não existir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_conversations_client'
  ) THEN
    ALTER TABLE public.conversations
      ADD CONSTRAINT fk_conversations_client
      FOREIGN KEY (client_id)
      REFERENCES public.clients(id)
      ON DELETE CASCADE;
  END IF;
END $$;

-- índices úteis
CREATE INDEX IF NOT EXISTS idx_conversations_org       ON public.conversations(org_id);
CREATE INDEX IF NOT EXISTS idx_conversations_last_msg  ON public.conversations(org_id, last_message_at DESC);

-- ==== MESSAGES: cria/ajusta ====
CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  conversation_id uuid NOT NULL,
  author_id text,
  direction text NOT NULL, -- 'in' | 'out'
  text text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- FK para conversations (se ainda não existir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_messages_conversation'
  ) THEN
    ALTER TABLE public.messages
      ADD CONSTRAINT fk_messages_conversation
      FOREIGN KEY (conversation_id)
      REFERENCES public.conversations(id)
      ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_messages_conv ON public.messages(org_id, conversation_id, created_at);

-- ===== Extensions =====
CREATE EXTENSION IF NOT EXISTS pgcrypto;  -- gen_random_uuid()

-- ===== Schema utilitário para GUC helpers =====
CREATE SCHEMA IF NOT EXISTS app;

-- Retorna current_setting('app.user_id', true)::uuid com NULL seguro
CREATE OR REPLACE FUNCTION app.current_user_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT CASE
    WHEN current_setting('app.user_id', true) IS NULL
         OR current_setting('app.user_id', true) = '' THEN NULL
    ELSE current_setting('app.user_id', true)::uuid
  END;
$$;

CREATE OR REPLACE FUNCTION app.current_org_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT CASE
    WHEN current_setting('app.org_id', true) IS NULL
         OR current_setting('app.org_id', true) = '' THEN NULL
    ELSE current_setting('app.org_id', true)::uuid
  END;
$$;

CREATE OR REPLACE FUNCTION app.current_role() RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT COALESCE(NULLIF(current_setting('app.role', true), ''), 'user');
$$;

-- ===== Tabelas =====
CREATE TABLE IF NOT EXISTS organizations (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  slug       text UNIQUE,
  status     text NOT NULL DEFAULT 'active', -- active | suspended | archived
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS org_memberships (
  org_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'Viewer',  -- OrgOwner | OrgAdmin | Manager | Agent | Viewer
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, user_id),
  CONSTRAINT org_memberships_org_fk
    FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE
);

-- Adiciona FK para users(id) se a tabela existir
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'users'
  ) THEN
    PERFORM 1
    FROM pg_constraint c
    WHERE c.conname = 'org_memberships_user_fk';

    IF NOT FOUND THEN
      ALTER TABLE org_memberships
        ADD CONSTRAINT org_memberships_user_fk
        FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
    END IF;
  END IF;
END$$;

-- ===== Índices =====
CREATE INDEX IF NOT EXISTS idx_orgs_name ON organizations (name);
CREATE INDEX IF NOT EXISTS idx_memberships_user ON org_memberships (user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_org ON org_memberships (org_id);

-- ===== RLS =====
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_memberships ENABLE ROW LEVEL SECURITY;

-- Policies: membros veem suas orgs
DROP POLICY IF EXISTS orgs_member_sel ON organizations;
CREATE POLICY orgs_member_sel ON organizations
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM org_memberships m
    WHERE m.org_id = organizations.id
      AND app.current_user_id() IS NOT NULL
      AND m.user_id = app.current_user_id()
  )
);

-- Policies: SuperAdmin/Support veem todas
DROP POLICY IF EXISTS orgs_super_sel ON organizations;
CREATE POLICY orgs_super_sel ON organizations
FOR SELECT
USING ( app.current_role() IN ('SuperAdmin','Support') );

-- Memberships: o próprio usuário enxerga seus vínculos; superusers veem tudo
DROP POLICY IF EXISTS mem_self_sel ON org_memberships;
CREATE POLICY mem_self_sel ON org_memberships
FOR SELECT
USING (
  app.current_role() IN ('SuperAdmin','Support')
  OR (app.current_user_id() IS NOT NULL AND user_id = app.current_user_id())
);

-- (Opcional) você pode criar policies de INSERT/UPDATE/DELETE depois

-- ===== Seed da organização padrão (id já usado no seu token) =====
INSERT INTO organizations (id, name, slug, status)
VALUES ('00000000-0000-0000-0000-000000000001', 'Default Org', 'default', 'active')
ON CONFLICT (id) DO NOTHING;

-- ===== Seed do membership do Rodrigo como OrgOwner (se o usuário existir) =====
DO $$
DECLARE
  v_user_id uuid;
BEGIN
  -- ajuste o email se necessário
  SELECT id INTO v_user_id FROM public.users WHERE email = 'rodrigooidr@hotmail.com' LIMIT 1;

  IF v_user_id IS NOT NULL THEN
    INSERT INTO org_memberships (org_id, user_id, role)
    VALUES ('00000000-0000-0000-0000-000000000001', v_user_id, 'OrgOwner')
    ON CONFLICT (org_id, user_id) DO UPDATE SET role = EXCLUDED.role;
  END IF;
END$$;

-- ===== Gatilho simples de updated_at =====
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'touch_updated_at'
  ) THEN
    CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS trigger AS $f$
    BEGIN
      NEW.updated_at := now();
      RETURN NEW;
    END;
    $f$ LANGUAGE plpgsql;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_orgs_touch_updated_at'
  ) THEN
    CREATE TRIGGER trg_orgs_touch_updated_at
    BEFORE UPDATE ON organizations
    FOR EACH ROW EXECUTE PROCEDURE touch_updated_at();
  END IF;
END$$;
