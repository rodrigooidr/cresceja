BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- [1] Garantir coluna UUID auxiliar e preencher (caso ainda exista estado legado)
DO $$
DECLARE
  has_id_uuid boolean;
  id_type text;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='plans' AND column_name='id_uuid'
  ) INTO has_id_uuid;

  SELECT data_type INTO id_type
  FROM information_schema.columns
  WHERE table_name='plans' AND column_name='id';

  IF NOT has_id_uuid THEN
    ALTER TABLE plans ADD COLUMN id_uuid uuid;
    IF id_type = 'uuid' THEN
      UPDATE plans SET id_uuid = id::uuid;
    ELSE
      UPDATE plans SET id_uuid = gen_random_uuid();
    END IF;
    ALTER TABLE plans ALTER COLUMN id_uuid SET NOT NULL;
  END IF;

  -- Índice UNIQUE auxiliar (se ainda não existir)
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='plans'::regclass AND conname='plans_id_uuid_key'
  ) THEN
    ALTER TABLE plans ADD CONSTRAINT plans_id_uuid_key UNIQUE (id_uuid);
  END IF;
END$$;

-- [2] Converter plan_id para UUID onde ainda for texto e criar FKs temporárias para id_uuid
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['organizations','subscriptions','orgs','clients','plan_features']
  LOOP
    IF to_regclass(t) IS NULL THEN CONTINUE; END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name=t AND column_name='plan_id' AND data_type <> 'uuid'
    ) THEN
      EXECUTE format('ALTER TABLE %I DROP CONSTRAINT IF EXISTS %I', t, t||'_plan_id_fkey');
      EXECUTE format('ALTER TABLE %I ADD COLUMN plan_id_uuid uuid', t);
      EXECUTE format(
        'UPDATE %I x
            SET plan_id_uuid = p.id_uuid
           FROM plans p
          WHERE x.plan_id::text = p.id::text', t);
      EXECUTE format('ALTER TABLE %I DROP COLUMN plan_id', t);
      EXECUTE format('ALTER TABLE %I RENAME COLUMN plan_id_uuid TO plan_id', t);
      EXECUTE format(
        'ALTER TABLE %I
           ADD CONSTRAINT %I FOREIGN KEY (plan_id)
           REFERENCES plans(id_uuid) ON DELETE %s',
        t, t||'_plan_id_fkey',
        CASE WHEN t='plan_features' THEN 'CASCADE' ELSE 'SET NULL' END
      );
    END IF;
  END LOOP;
END$$;

-- [3] Promover definitivamente: plans.id = UUID + PK (preserva legado em id_legacy_text)
DO $$
DECLARE
  id_type text;
BEGIN
  SELECT data_type INTO id_type
  FROM information_schema.columns
  WHERE table_name='plans' AND column_name='id';

  IF id_type <> 'uuid' THEN
    ALTER TABLE plans DROP CONSTRAINT IF EXISTS plans_pkey;
    ALTER TABLE plans ADD CONSTRAINT plans_pkey PRIMARY KEY (id_uuid);
    ALTER TABLE plans RENAME COLUMN id TO id_legacy_text;
    ALTER TABLE plans RENAME COLUMN id_uuid TO id;
  ELSE
    -- garante PK em id (uuid)
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid='plans'::regclass AND contype='p'
    ) THEN
      ALTER TABLE plans ADD CONSTRAINT plans_pkey PRIMARY KEY (id);
    END IF;
  END IF;
END$$;

-- [4] DROPA QUALQUER FK que hoje referencie plans (independe do nome) — limpa geral
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT conname, conrelid::regclass AS tbl
    FROM pg_constraint
    WHERE contype='f' AND confrelid='plans'::regclass
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', r.tbl, r.conname);
  END LOOP;
END$$;

-- [5] Agora pode remover o UNIQUE antigo com segurança
ALTER TABLE plans DROP CONSTRAINT IF EXISTS plans_id_uuid_key;

-- [6] Recria FKs apontando para a PK (plans.id)
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['organizations','subscriptions','orgs','clients','plan_features']
  LOOP
    IF to_regclass(t) IS NULL THEN CONTINUE; END IF;

    -- só recria se a coluna plan_id existir e for uuid
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name=t AND column_name='plan_id' AND data_type='uuid'
    ) THEN
      EXECUTE format(
        'ALTER TABLE %I
           ADD CONSTRAINT %I FOREIGN KEY (plan_id)
           REFERENCES plans(id) ON DELETE %s',
        t,
        t||'_plan_id_fkey',
        CASE WHEN t='plan_features' THEN 'CASCADE' ELSE 'SET NULL' END
      );
    END IF;
  END LOOP;
END$$;

COMMIT;
