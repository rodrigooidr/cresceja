-- organizations: campos empresariais e endereço
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS cnpj              text,
  ADD COLUMN IF NOT EXISTS razao_social      text,
  ADD COLUMN IF NOT EXISTS nome_fantasia     text,
  ADD COLUMN IF NOT EXISTS ie                text,
  ADD COLUMN IF NOT EXISTS ie_isento         boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS site              text,
  ADD COLUMN IF NOT EXISTS email             text,
  ADD COLUMN IF NOT EXISTS phone_e164        text,
  ADD COLUMN IF NOT EXISTS status            text DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS cep               text,
  ADD COLUMN IF NOT EXISTS logradouro        text,
  ADD COLUMN IF NOT EXISTS numero            text,
  ADD COLUMN IF NOT EXISTS complemento       text,
  ADD COLUMN IF NOT EXISTS bairro            text,
  ADD COLUMN IF NOT EXISTS cidade            text,
  ADD COLUMN IF NOT EXISTS uf                text,
  ADD COLUMN IF NOT EXISTS country           text DEFAULT 'BR',
  ADD COLUMN IF NOT EXISTS resp_nome         text,
  ADD COLUMN IF NOT EXISTS resp_cpf          text,
  ADD COLUMN IF NOT EXISTS resp_email        text,
  ADD COLUMN IF NOT EXISTS resp_phone_e164   text;

-- funções util_* (assumimos que já existam)

-- índices de unicidade (aceitam NULL)
CREATE UNIQUE INDEX IF NOT EXISTS ux_orgs_cnpj_digits
  ON organizations (util_digits(cnpj))
  WHERE cnpj IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_orgs_email_lower
  ON organizations (util_email_lower(email))
  WHERE email IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_orgs_phone_e164
  ON organizations (phone_e164)
  WHERE phone_e164 IS NOT NULL;

