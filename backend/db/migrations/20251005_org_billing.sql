CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  external_id text,
  status text NOT NULL DEFAULT 'open',
  amount_cents integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'BRL',
  due_date timestamptz,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS org_plan_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  event_type text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS org_credits_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  meter text NOT NULL,
  used integer NOT NULL DEFAULT 0,
  period_start date NOT NULL,
  period_end date NOT NULL
);
