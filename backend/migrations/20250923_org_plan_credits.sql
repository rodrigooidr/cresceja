-- backend/migrations/20250923_org_plan_credits.sql
-- Complementa organizations com colunas de plano/trial e cria tabelas de histórico/créditos

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS plan_id uuid REFERENCES public.plans(id),
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz;

CREATE TABLE IF NOT EXISTS public.org_plan_history (
  org_id     uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  plan_id    uuid NOT NULL,
  status     text NOT NULL CHECK (status IN ('active','canceled','suspended','pending')),
  start_at   timestamptz NOT NULL DEFAULT now(),
  end_at     timestamptz,
  source     text NOT NULL DEFAULT 'manual',
  meta       jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_plan_history_org ON public.org_plan_history(org_id);
CREATE INDEX IF NOT EXISTS idx_org_plan_history_plan ON public.org_plan_history(plan_id);

CREATE TABLE IF NOT EXISTS public.org_credits (
  org_id        uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  feature_code  text NOT NULL,
  delta         integer NOT NULL,
  expires_at    timestamptz,
  source        text NOT NULL DEFAULT 'manual',
  meta          jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_credits_org ON public.org_credits(org_id);
CREATE INDEX IF NOT EXISTS idx_org_credits_feature ON public.org_credits(feature_code);

CREATE OR REPLACE VIEW public.v_org_credits AS
SELECT
  org_id,
  feature_code,
  SUM(delta) AS remaining_total,
  MIN(expires_at) FILTER (WHERE expires_at IS NOT NULL AND expires_at >= now()) AS expires_next
FROM public.org_credits
GROUP BY org_id, feature_code;
