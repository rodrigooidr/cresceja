BEGIN;

-- Extensões (ok se já existirem)
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

-- Função para updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

-- Usuários
CREATE TABLE IF NOT EXISTS public.users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         citext NOT NULL UNIQUE,
  full_name     text,
  role          text NOT NULL DEFAULT 'agent',
  avatar_url    text,
  password_hash text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_users_updated_at ON public.users;
CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Empresas
CREATE TABLE IF NOT EXISTS public.companies (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  cnpj        text,
  phone       text,
  email       citext,
  address     text,
  plan        text NOT NULL DEFAULT 'basic',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_companies_updated_at ON public.companies;
CREATE TRIGGER trg_companies_updated_at
  BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Perfis (vínculo usuário/empresa)
CREATE TABLE IF NOT EXISTS public.profiles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  company_id  uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  full_name   text,
  role        text NOT NULL DEFAULT 'agent',
  avatar_url  text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_profiles_company ON public.profiles(company_id);
CREATE INDEX IF NOT EXISTS idx_profiles_user    ON public.profiles(user_id);
DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Limites de créditos de IA
CREATE TABLE IF NOT EXISTS public.ai_credit_limits (
  company_id  uuid PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  atendimento integer NOT NULL DEFAULT 1000,
  texto       integer NOT NULL DEFAULT 100000,
  imagem      integer NOT NULL DEFAULT 100,
  video       integer NOT NULL DEFAULT 50,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Onboarding
CREATE TABLE IF NOT EXISTS public.onboarding_items (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  title        text NOT NULL,
  position     int NOT NULL DEFAULT 0,
  completed    boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_onboarding_company ON public.onboarding_items(company_id);
DROP TRIGGER IF EXISTS trg_onboarding_updated_at ON public.onboarding_items;
CREATE TRIGGER trg_onboarding_updated_at
  BEFORE UPDATE ON public.onboarding_items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;
