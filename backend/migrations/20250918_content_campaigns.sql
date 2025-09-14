CREATE TABLE IF NOT EXISTS content_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title text NOT NULL,
  month_ref date NOT NULL,
  default_targets jsonb NOT NULL DEFAULT '{}'::jsonb,
  strategy_json jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_campaigns_org_month ON content_campaigns(org_id, month_ref);
