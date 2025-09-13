BEGIN;

-- EMAIL
WITH d AS (
  SELECT org_id, lower(email) AS k, MIN(id) AS keep_id, array_agg(id) AS all_ids
  FROM clients
  WHERE email IS NOT NULL
  GROUP BY org_id, lower(email)
  HAVING COUNT(*) > 1
)
DELETE FROM clients c
USING d
WHERE c.org_id = d.org_id
  AND lower(c.email) = d.k
  AND c.id <> d.keep_id;

-- PHONE
WITH d AS (
  SELECT org_id, phone_e164 AS k, MIN(id) AS keep_id, array_agg(id) AS all_ids
  FROM clients
  WHERE phone_e164 IS NOT NULL
  GROUP BY org_id, phone_e164
  HAVING COUNT(*) > 1
)
DELETE FROM clients c
USING d
WHERE c.org_id = d.org_id
  AND c.phone_e164 = d.k
  AND c.id <> d.keep_id;

-- CPF
WITH d AS (
  SELECT org_id, regexp_replace(cpf,'\\D','','g') AS k, MIN(id) AS keep_id, array_agg(id) AS all_ids
  FROM clients
  WHERE cpf IS NOT NULL
  GROUP BY org_id, regexp_replace(cpf,'\\D','','g')
  HAVING COUNT(*) > 1
)
DELETE FROM clients c
USING d
WHERE c.org_id = d.org_id
  AND regexp_replace(c.cpf,'\\D','','g') = d.k
  AND c.id <> d.keep_id;

-- CNPJ
WITH d AS (
  SELECT org_id, regexp_replace(cnpj,'\\D','','g') AS k, MIN(id) AS keep_id, array_agg(id) AS all_ids
  FROM clients
  WHERE cnpj IS NOT NULL
  GROUP BY org_id, regexp_replace(cnpj,'\\D','','g')
  HAVING COUNT(*) > 1
)
DELETE FROM clients c
USING d
WHERE c.org_id = d.org_id
  AND regexp_replace(c.cnpj,'\\D','','g') = d.k
  AND c.id <> d.keep_id;

-- Índices únicos (parciais)
CREATE UNIQUE INDEX IF NOT EXISTS ux_clients_org_email_lower
  ON clients (org_id, lower(email))
  WHERE email IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_clients_org_phone
  ON clients (org_id, phone_e164)
  WHERE phone_e164 IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_clients_org_cpf_digits
  ON clients (org_id, regexp_replace(cpf,'\\D','','g'))
  WHERE cpf IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_clients_org_cnpj_digits
  ON clients (org_id, regexp_replace(cnpj,'\\D','','g'))
  WHERE cnpj IS NOT NULL;

COMMIT;
