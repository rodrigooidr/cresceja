-- 2025-08-15 • Billing & Plans basic schema (PostgreSQL)

-- Extensions (if not enabled)
-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
-- CREATE EXTENSION IF NOT EXISTS pgcrypto;

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

-- Minimal clients table (adjust if you already have one)
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

-- Seed plans (upsert)
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
