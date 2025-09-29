-- idempotente
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='plans' AND column_name='id_legacy_text'
  ) THEN
    RAISE EXCEPTION 'Tabela public.plans sem coluna id_legacy_text';
  END IF;

  -- Default gera "plan-xxxxxxxx" se o código do app esquecer de enviar
  EXECUTE $q$
    ALTER TABLE public.plans
    ALTER COLUMN id_legacy_text SET DEFAULT ('plan-' || substr(gen_random_uuid()::text, 1, 8))
  $q$;

  -- Backfill de nulos/vazios (se houver legado)
  UPDATE public.plans
     SET id_legacy_text = 'plan-' || substr(gen_random_uuid()::text, 1, 8)
   WHERE (id_legacy_text IS NULL OR id_legacy_text = '');

  -- índice único se ainda não existir (opcional, mas recomendado)
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='ux_plans_legacy'
  ) THEN
    CREATE UNIQUE INDEX ux_plans_legacy ON public.plans (id_legacy_text);
  END IF;
END$$;
