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
