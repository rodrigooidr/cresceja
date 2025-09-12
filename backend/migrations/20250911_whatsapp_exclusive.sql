-- backend/migrations/20250911_whatsapp_exclusive.sql
-- Adds Baileys visibility and Whatsapp mode exclusivity settings
-- plus uniqueness constraints for contacts and organizations

-- organization settings: allow_baileys flag and whatsapp_active_mode
ALTER TABLE org_settings
  ADD COLUMN IF NOT EXISTS allow_baileys boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS whatsapp_active_mode text NOT NULL DEFAULT 'none'
    CHECK (whatsapp_active_mode IN ('none','baileys','api'));

-- uniqueness indexes for contacts (per organization)
CREATE UNIQUE INDEX IF NOT EXISTS ux_contacts_org_phone
  ON contacts(org_id, phone_e164)
  WHERE phone_e164 IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_contacts_org_email
  ON contacts(org_id, lower(email))
  WHERE email IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_contacts_org_cpf_digits
  ON contacts(org_id, regexp_replace(cpf, '\\D', '', 'g'))
  WHERE cpf IS NOT NULL;

-- uniqueness indexes for organizations (global)
CREATE UNIQUE INDEX IF NOT EXISTS ux_orgs_cnpj_digits
  ON organizations((regexp_replace(document_value, '\\D', '', 'g')))
  WHERE document_type = 'CNPJ' AND document_value IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_orgs_owner_email
  ON organizations(lower(email))
  WHERE email IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_orgs_company_phone
  ON organizations(phone)
  WHERE phone IS NOT NULL;
