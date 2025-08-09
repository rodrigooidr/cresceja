-- onboarding_schema_local.sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1) Companies (mínimo necessário p/ onboarding)
CREATE TABLE IF NOT EXISTS public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  segment TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2) Onboarding steps (referencia public.users em vez de auth.users)
CREATE TABLE IF NOT EXISTS public.onboarding_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id),
  step TEXT NOT NULL,
  completed_at TIMESTAMPTZ DEFAULT now()
);
