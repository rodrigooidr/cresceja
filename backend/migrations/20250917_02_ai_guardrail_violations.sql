-- backend/migrations/20250917_02_ai_guardrail_violations.sql
CREATE TABLE IF NOT EXISTS ai_guardrail_violations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  user_id UUID NULL,
  channel TEXT NULL,
  intent TEXT NULL,
  rule TEXT NOT NULL,
  message TEXT NULL,
  input_excerpt TEXT NULL,
  output_excerpt TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ai_guardrail_violations_org_id_created_at
  ON ai_guardrail_violations(org_id, created_at DESC);
