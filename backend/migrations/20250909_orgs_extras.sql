-- backend/migrations/20250909_orgs_extras.sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS slug                 text UNIQUE,
  ADD COLUMN IF NOT EXISTS document_type        text CHECK (document_type IN ('CNPJ','CPF')),
  ADD COLUMN IF NOT EXISTS document_value       text,
  ADD COLUMN IF NOT EXISTS photo_url            text,
  ADD COLUMN IF NOT EXISTS phone                text,
  ADD COLUMN IF NOT EXISTS email                text,
  ADD COLUMN IF NOT EXISTS address              jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS whatsapp_baileys_enabled    boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS whatsapp_baileys_status     text DEFAULT 'disabled',
  ADD COLUMN IF NOT EXISTS whatsapp_baileys_phone      text,
  ADD COLUMN IF NOT EXISTS whatsapp_baileys_session_id text,
  ADD COLUMN IF NOT EXISTS meta                 jsonb DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_orgs_document_value ON organizations(document_value);
CREATE INDEX IF NOT EXISTS idx_payments_org_created ON payments(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_purchases_org_created ON purchases(org_id, created_at DESC);
