-- organizations
CREATE TABLE IF NOT EXISTS public.organizations (
  id uuid PRIMARY KEY,
  name text,
  slug text UNIQUE,
  status text,
  plan_id uuid NULL,
  trial_ends_at timestamptz NULL,
  email text,
  phone text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname='public' AND indexname='organizations_status_created_idx'
  ) THEN
    CREATE INDEX organizations_status_created_idx
      ON public.organizations (status, created_at DESC);
  END IF;
END $$;

-- plano/creditos
CREATE TABLE IF NOT EXISTS public.plans (
  id uuid PRIMARY KEY,
  name text,
  code text UNIQUE,
  price_cents integer DEFAULT 0,
  ai_tokens_limit bigint NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS code text UNIQUE,
  ADD COLUMN IF NOT EXISTS ai_tokens_limit bigint NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.org_members (
  org_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role text,
  PRIMARY KEY (org_id, user_id)
);

-- seeds coerentes com plan_id das suas orgs
INSERT INTO public.plans (id, name, code)
VALUES
  ('d085fd00-16ea-4e24-abb0-69021a8b3c7e','Starter','starter'),
  ('a4a7f5f3-8615-4b02-9334-7adfeb0e76e3','Pro','pro')
ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, code=EXCLUDED.code;
