BEGIN;

-- Compat: se não existir uma tabela de limites por plano,
-- usamos a feature "ai_tokens_limit" no próprio plano como origem da verdade.

-- Só cria a coluna se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='plans' AND column_name='ai_tokens_limit'
  ) THEN
    ALTER TABLE public.plans
      ADD COLUMN ai_tokens_limit bigint DEFAULT 0 NOT NULL;
  END IF;
END$$;

COMMIT;
