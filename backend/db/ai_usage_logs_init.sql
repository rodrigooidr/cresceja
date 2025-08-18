-- ai_usage_logs_init.sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.ai_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id),
  tokens_used INTEGER DEFAULT 0,
  cost NUMERIC(10,4) DEFAULT 0,
  category TEXT DEFAULT 'content',
  created_at TIMESTAMPTZ DEFAULT now()
);
