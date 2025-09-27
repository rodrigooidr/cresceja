-- backend/migrations/20250924_admin_orgs_billing.sql
-- Ajustes idempotentes para histórico de plano, créditos por feature e visões auxiliares

-- 1) Sincronismo opcional organizations -> orgs
DO $$
BEGIN
  IF to_regclass('public.orgs') IS NOT NULL THEN
    UPDATE public.orgs g
       SET status = o.status
      FROM public.organizations o
     WHERE o.id = g.id
       AND g.status IS DISTINCT FROM o.status;
  END IF;
END$$;

-- 2) Histórico de plano (garante existência)
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

-- 3) Créditos por feature (PK sintético + FK organizations)
DO $$
BEGIN
  IF to_regclass('public.org_credits') IS NULL THEN
    CREATE TABLE public.org_credits (
      id           bigserial PRIMARY KEY,
      org_id       uuid NOT NULL,
      feature_code text NOT NULL,
      delta        integer NOT NULL,
      expires_at   timestamptz,
      source       text NOT NULL DEFAULT 'manual',
      meta         jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at   timestamptz NOT NULL DEFAULT now()
    );
  ELSE
    -- garantir coluna id
    IF NOT EXISTS (
      SELECT 1
        FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'org_credits'
         AND column_name = 'id'
    ) THEN
      ALTER TABLE public.org_credits ADD COLUMN id bigserial;
    END IF;

    -- garantir default do id
    IF EXISTS (
      SELECT 1
        FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'org_credits'
         AND column_name = 'id'
         AND column_default IS NULL
    ) THEN
      IF to_regclass('public.org_credits_id_seq') IS NULL THEN
        EXECUTE 'CREATE SEQUENCE public.org_credits_id_seq OWNED BY public.org_credits.id';
      END IF;

      PERFORM setval('public.org_credits_id_seq', COALESCE((SELECT MAX(id) FROM public.org_credits), 0));
      ALTER TABLE public.org_credits ALTER COLUMN id SET DEFAULT nextval('public.org_credits_id_seq');
    END IF;

    UPDATE public.org_credits
       SET id = nextval('public.org_credits_id_seq')
     WHERE id IS NULL;

    ALTER TABLE public.org_credits ALTER COLUMN id SET NOT NULL;

    -- normalizar delta
    IF NOT EXISTS (
      SELECT 1
        FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'org_credits'
         AND column_name = 'delta'
    ) THEN
      ALTER TABLE public.org_credits ADD COLUMN delta integer;

      IF EXISTS (
        SELECT 1
          FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = 'org_credits'
           AND column_name = 'remaining'
      ) THEN
        UPDATE public.org_credits SET delta = COALESCE(remaining, 0);
        ALTER TABLE public.org_credits DROP COLUMN remaining;
      ELSE
        UPDATE public.org_credits SET delta = 0 WHERE delta IS NULL;
      END IF;

      ALTER TABLE public.org_credits ALTER COLUMN delta SET NOT NULL;
    ELSE
      UPDATE public.org_credits SET delta = 0 WHERE delta IS NULL;
      ALTER TABLE public.org_credits ALTER COLUMN delta SET NOT NULL;
    END IF;

    -- garantir PK em id
    PERFORM 1
      FROM pg_constraint
     WHERE conrelid = 'public.org_credits'::regclass
       AND contype = 'p';
    IF NOT FOUND THEN
      ALTER TABLE public.org_credits
        ADD CONSTRAINT org_credits_pkey PRIMARY KEY (id);
    END IF;
  END IF;

  -- FK para organizations (sempre recria para garantir ON DELETE CASCADE)
  IF EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conrelid = 'public.org_credits'::regclass
       AND contype = 'f'
       AND conname = 'org_credits_org_id_fkey'
  ) THEN
    ALTER TABLE public.org_credits DROP CONSTRAINT org_credits_org_id_fkey;
  END IF;

  ALTER TABLE public.org_credits
    ADD CONSTRAINT org_credits_org_id_fkey
    FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
END$$;

CREATE INDEX IF NOT EXISTS idx_org_credits_org ON public.org_credits(org_id);
CREATE INDEX IF NOT EXISTS idx_org_credits_feature ON public.org_credits(feature_code);
CREATE INDEX IF NOT EXISTS idx_org_credits_org_feat_created
  ON public.org_credits (org_id, feature_code, created_at DESC);

-- 4) View de créditos agregados
CREATE OR REPLACE VIEW public.v_org_credits AS
SELECT
  org_id,
  feature_code,
  SUM(delta) AS remaining_total,
  MIN(expires_at) FILTER (
    WHERE expires_at IS NOT NULL
      AND expires_at >= now()
  ) AS expires_next
FROM public.org_credits
GROUP BY org_id, feature_code;

-- 5) View de listagem unificada
CREATE OR REPLACE VIEW public.v_org_list AS
SELECT
  id,
  name,
  slug,
  status,
  plan_id,
  trial_ends_at,
  (status = 'active')::boolean AS active
FROM public.organizations;
