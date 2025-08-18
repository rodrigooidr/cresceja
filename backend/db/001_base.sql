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

-- Unicidade por email/phone quando informados
CREATE UNIQUE INDEX IF NOT EXISTS ux_leads_email ON leads(email) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_leads_phone ON leads(phone) WHERE phone IS NOT NULL;

-- Mapeia IDs externos de canais -> lead
CREATE TABLE IF NOT EXISTS channel_id_map (
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  channel_type TEXT NOT NULL,
  external_id TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  PRIMARY KEY (channel_type, external_id)
);

-- Funil simples de oportunidades
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
  human_requested BOOLEAN NOT NULL DEFAULT FALSE, -- usuário pediu atendimento humano
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

-- Respostas rápidas por empresa
CREATE TABLE IF NOT EXISTS quick_messages (
  id SERIAL PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

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

-- Integrações de calendário
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
       'rodrigooidr@hotmail.com', 'Owner', 'admin', TRUE
WHERE NOT EXISTS (SELECT 1 FROM users WHERE id='11111111-1111-1111-1111-111111111111');