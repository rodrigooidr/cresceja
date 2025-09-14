CREATE TYPE IF NOT EXISTS suggestion_status AS ENUM ('suggested','approved','scheduled','published','rejected');

CREATE TABLE IF NOT EXISTS content_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES content_campaigns(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  date date NOT NULL,
  time time with time zone,
  channel_targets jsonb NOT NULL DEFAULT '{}'::jsonb,
  status suggestion_status NOT NULL DEFAULT 'suggested',
  copy_json jsonb,
  asset_refs jsonb,
  ai_prompt_json jsonb,
  reasoning_json jsonb,
  approved_by uuid,
  approved_at timestamptz,
  published_at timestamptz,
  jobs_map jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_suggestions_campaign ON content_suggestions(campaign_id);
CREATE INDEX IF NOT EXISTS ix_suggestions_org_date ON content_suggestions(org_id, date);
