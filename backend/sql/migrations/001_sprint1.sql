
-- Minimal schema (idempotent)

CREATE TABLE IF NOT EXISTS subscriptions (
  user_id UUID PRIMARY KEY,
  plan TEXT NOT NULL DEFAULT 'free',
  status TEXT NOT NULL DEFAULT 'no_subscription',
  trial_started_at TIMESTAMP NULL,
  trial_ends_at TIMESTAMP NULL
);

CREATE TABLE IF NOT EXISTS ai_credit_usage (
  user_id UUID NOT NULL,
  category TEXT NOT NULL,
  period_start TIMESTAMP NOT NULL,
  period_end TIMESTAMP NOT NULL,
  used INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, category, period_start, period_end)
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NULL,
  company_id UUID NULL,
  action TEXT NOT NULL,
  resource TEXT NOT NULL,
  channel TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NULL,
  name TEXT NOT NULL,
  email TEXT NULL,
  phone TEXT NULL,
  source_channel TEXT NOT NULL,
  consent BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS crm_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  stage TEXT NOT NULL DEFAULT 'novo',
  owner_id UUID NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  notes TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS social_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  media_url TEXT NULL,
  channel TEXT NOT NULL,
  scheduled_at TIMESTAMP NULL,
  status TEXT NOT NULL DEFAULT 'pendente',
  created_by UUID NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS post_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
  level INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL, -- aprovado | reprovado
  comment TEXT NULL,
  decided_by UUID NULL,
  decided_at TIMESTAMP NULL
);

-- Optional columns that may not exist on existing installs
DO $$ BEGIN
  ALTER TABLE crm_opportunities ADD COLUMN IF NOT EXISTS stage TEXT NOT NULL DEFAULT 'novo';
EXCEPTION WHEN others THEN END $$;

