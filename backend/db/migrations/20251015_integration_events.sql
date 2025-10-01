BEGIN;

CREATE TABLE IF NOT EXISTS public.integration_events (
  id bigserial PRIMARY KEY,
  org_id uuid NOT NULL,
  provider text NOT NULL,
  event_type text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  received_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.integration_events
  ALTER COLUMN payload SET DEFAULT '{}'::jsonb;

ALTER TABLE public.integration_events
  ALTER COLUMN received_at SET DEFAULT now();

ALTER TABLE public.integration_events
  ADD COLUMN IF NOT EXISTS event_type text;

CREATE INDEX IF NOT EXISTS integration_events_org_provider_received_idx
  ON public.integration_events (org_id, provider, received_at DESC);

CREATE INDEX IF NOT EXISTS integration_events_received_idx
  ON public.integration_events (received_at DESC);

COMMIT;
