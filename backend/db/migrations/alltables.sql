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
