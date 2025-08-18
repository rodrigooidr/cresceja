CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('whatsapp_web','whatsapp_api','instagram','facebook','google_calendar')),
  status TEXT NOT NULL DEFAULT 'disabled' CHECK (status IN ('disabled','pending','connected','error')),
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  allowed_for_all BOOLEAN NOT NULL DEFAULT false,
  enabled_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (company_id, type)
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID,
  user_id UUID,
  action TEXT,
  target_integration TEXT,
  status TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
