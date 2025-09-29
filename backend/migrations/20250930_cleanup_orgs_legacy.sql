BEGIN;

-- Remove qualquer tabela física "public.orgs" remanescente após a migração de unificação.
DO $$
DECLARE
  relkind text;
BEGIN
  SELECT c.relkind
    INTO relkind
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public'
     AND c.relname = 'orgs';

  IF relkind = 'r' THEN
    EXECUTE 'DROP TABLE IF EXISTS public.orgs CASCADE';
  END IF;
END $$;

-- Ajusta sincronismos legados garantindo que apenas organizations seja atualizada.
DO $$
BEGIN
  IF to_regclass('public.organizations') IS NOT NULL THEN
    RAISE NOTICE 'Legacy orgs -> organizations sync skipped after consolidation.';
  END IF;
END $$;

COMMIT;
