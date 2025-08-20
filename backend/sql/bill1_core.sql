ALTER TABLE orgs
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive'));

CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL UNIQUE REFERENCES orgs(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES plans(id),
  provider text,
  provider_subscription_id text,
  status text NOT NULL DEFAULT 'active',
  current_period_end date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES subscriptions(id) ON DELETE CASCADE,
  amount_cents integer NOT NULL DEFAULT 0,
  due_date date NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  provider_invoice_id text,
  paid_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoices_org ON invoices(org_id);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS subscriptions_isolation ON subscriptions;
CREATE POLICY subscriptions_isolation ON subscriptions USING (org_id = current_setting('app.org_id')::uuid) WITH CHECK (org_id = current_setting('app.org_id')::uuid);

DROP POLICY IF EXISTS invoices_isolation ON invoices;
CREATE POLICY invoices_isolation ON invoices USING (org_id = current_setting('app.org_id')::uuid) WITH CHECK (org_id = current_setting('app.org_id')::uuid);
