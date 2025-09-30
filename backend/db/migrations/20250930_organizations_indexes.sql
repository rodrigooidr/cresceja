BEGIN;

-- Ensure organizations.slug remains unique
CREATE UNIQUE INDEX IF NOT EXISTS organizations_slug_key
  ON public.organizations (slug);

-- Support filtering by status and ordering by creation date
CREATE INDEX IF NOT EXISTS organizations_status_created_idx
  ON public.organizations (status, created_at DESC);

-- Add digit-only constraints for CEP and CNPJ when present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'organizations_cep_digits_chk'
  ) THEN
    ALTER TABLE public.organizations
      ADD CONSTRAINT organizations_cep_digits_chk
        CHECK (cep IS NULL OR cep ~ '^[0-9]{8}$');
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'organizations_cnpj_digits_chk'
  ) THEN
    ALTER TABLE public.organizations
      ADD CONSTRAINT organizations_cnpj_digits_chk
        CHECK (cnpj IS NULL OR cnpj ~ '^[0-9]{14}$');
  END IF;
END
$$;

COMMIT;
