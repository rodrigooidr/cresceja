-- backend/migrations/20250917_03_kb_documents.sql
CREATE TABLE IF NOT EXISTS kb_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  source_type TEXT NOT NULL,
  uri TEXT NOT NULL,
  lang TEXT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  title TEXT NULL,
  tags JSONB NULL,
  checksum TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
