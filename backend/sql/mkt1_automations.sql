-- backend/sql/mkt1_automations.sql
CREATE TABLE IF NOT EXISTS email_automations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'off',
  template_id UUID REFERENCES email_templates(id) ON DELETE SET NULL,
  segment_id UUID REFERENCES email_segments(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE email_automations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS email_automations_rls ON email_automations;
CREATE POLICY email_automations_rls ON email_automations
  USING (org_id = current_setting('app.org_id')::uuid)
  WITH CHECK (org_id = current_setting('app.org_id')::uuid);

CREATE TABLE IF NOT EXISTS email_automation_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  automation_id UUID REFERENCES email_automations(id) ON DELETE CASCADE,
  step_number INT NOT NULL,
  delay_days INT NOT NULL DEFAULT 0,
  template_id UUID REFERENCES email_templates(id) ON DELETE SET NULL,
  stop_on TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE email_automation_steps ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS email_automation_steps_rls ON email_automation_steps;
CREATE POLICY email_automation_steps_rls ON email_automation_steps
  USING (org_id = current_setting('app.org_id')::uuid)
  WITH CHECK (org_id = current_setting('app.org_id')::uuid);
