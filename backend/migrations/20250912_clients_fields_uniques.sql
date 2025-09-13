ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS phone_e164 text,
  ADD COLUMN IF NOT EXISTS cpf        text,
  ADD COLUMN IF NOT EXISTS cnpj       text;

-- índices únicos por organização (parciais)
CREATE UNIQUE INDEX IF NOT EXISTS ux_clients_org_email_lower
  ON clients (org_id, lower(email))
  WHERE email IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_clients_org_phone
  ON clients (org_id, phone_e164)
  WHERE phone_e164 IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_clients_org_cpf_digits
  ON clients (org_id, regexp_replace(cpf, '\D','','g'))
  WHERE cpf IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_clients_org_cnpj_digits
  ON clients (org_id, regexp_replace(cnpj, '\D','','g'))
  WHERE cnpj IS NOT NULL;

