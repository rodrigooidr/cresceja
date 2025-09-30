BEGIN;

CREATE TABLE IF NOT EXISTS public.org_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider text NOT NULL,
  status text NOT NULL DEFAULT 'disconnected',
  subscribed boolean NOT NULL DEFAULT false,
  creds jsonb NOT NULL DEFAULT '{}'::jsonb,
  meta  jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, provider)
);

CREATE TABLE IF NOT EXISTS public.org_integration_logs (
  id bigserial PRIMARY KEY,
  org_id uuid NOT NULL,
  provider text NOT NULL,
  event text NOT NULL,
  ok boolean NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMIT;
