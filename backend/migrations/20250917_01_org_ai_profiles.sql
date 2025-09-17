-- backend/migrations/20250917_01_org_ai_profiles.sql
CREATE TABLE IF NOT EXISTS org_ai_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL UNIQUE,
  profile JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_org_ai_profiles_org_id ON org_ai_profiles(org_id);
