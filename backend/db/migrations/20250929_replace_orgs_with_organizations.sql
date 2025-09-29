BEGIN;

-- Utilitários
CREATE OR REPLACE FUNCTION _rename_constraint_if_exists(tbl regclass, old_name text, new_name text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint c WHERE c.conname = old_name) THEN
    EXECUTE format('ALTER TABLE %s RENAME CONSTRAINT %I TO %I', tbl, old_name, new_name);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION _rename_index_if_exists(old_name text, new_name text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname = old_name) THEN
    EXECUTE format('ALTER INDEX %I RENAME TO %I', old_name, new_name);
  END IF;
END $$;

DO $$
DECLARE
  has_orgs boolean;
  has_organizations boolean;
  pk_seq text;
BEGIN
  SELECT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'orgs' AND relkind='r') INTO has_orgs;
  SELECT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'organizations' AND relkind='r') INTO has_organizations;

  IF has_orgs AND NOT has_organizations THEN
    -- CENÁRIO A: só existe orgs -> rename estrutural
    EXECUTE 'ALTER TABLE public.orgs RENAME TO organizations';

    -- Renomear PK/índices comuns
    PERFORM _rename_constraint_if_exists('public.organizations', 'orgs_pkey', 'organizations_pkey');
    PERFORM _rename_index_if_exists('orgs_slug_key', 'organizations_slug_key');

    -- Renomear sequence se existir padrão "orgs_id_seq"
    SELECT pg_get_serial_sequence('public.organizations','id') INTO pk_seq;
    IF pk_seq IS NOT NULL AND pk_seq LIKE '%.orgs_id_seq' THEN
      EXECUTE 'ALTER SEQUENCE public.orgs_id_seq RENAME TO organizations_id_seq';
    END IF;

  ELSIF has_orgs AND has_organizations THEN
    -- CENÁRIO B: já existem as duas -> merge e substituição
    -- Inferimos colunas em comum e fazemos upsert básico por id/slug
    -- (ajuste as colunas conforme seu schema real)
    -- Exemplo genérico: id (uuid), name (text), slug (text), status (text), created_at, updated_at
    -- 1) Completar colunas que faltam (no-ops se já existem)
    ALTER TABLE public.organizations
      ADD COLUMN IF NOT EXISTS slug text,
      ADD COLUMN IF NOT EXISTS status text,
      ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
      ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

    -- 2) Upsert de dados faltantes
    INSERT INTO public.organizations (id, name, slug, status, created_at, updated_at)
    SELECT o.id, o.name, o.slug, o.status, o.created_at, o.updated_at
      FROM public.orgs o
      LEFT JOIN public.organizations z ON z.id = o.id
     WHERE z.id IS NULL
    ON CONFLICT (id) DO NOTHING;

    -- 3) Reapontar todas as FKs que referenciam public.orgs(id) para public.organizations(id)
    DO $fks$
    DECLARE
      r record;
      ddl text;
    BEGIN
      FOR r IN
        SELECT
          con.oid AS fk_oid,
          con.conname AS fk_name,
          nsp.nspname AS sch,
          rel.relname AS tbl,
          att2.attname AS col
        FROM pg_constraint con
        JOIN pg_class rel ON rel.oid = con.conrelid
        JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
        JOIN pg_attribute att2 ON att2.attrelid = con.conrelid AND att2.attnum = con.confkey[1]
        WHERE con.contype = 'f'
          AND con.confrelid = 'public.orgs'::regclass
      LOOP
        ddl := format('ALTER TABLE %I.%I DROP CONSTRAINT %I; ALTER TABLE %I.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES public.organizations(id) ON UPDATE CASCADE ON DELETE RESTRICT;',
                      r.sch, r.tbl, r.fk_name, r.sch, r.tbl, r.fk_name, r.col);
        EXECUTE ddl;
      END LOOP;
    END
    $fks$;

    -- 4) Drop tabela orgs e criar view de compatibilidade
    DROP TABLE public.orgs;

    CREATE VIEW public.orgs AS
      SELECT * FROM public.organizations;

    -- 5) INSTEAD OF triggers para manter compat de INSERT/UPDATE/DELETE durante a transição
    CREATE OR REPLACE FUNCTION public._orgs_view_ins() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      INSERT INTO public.organizations SELECT NEW.*;
      RETURN NEW;
    END $$;

    CREATE OR REPLACE FUNCTION public._orgs_view_upd() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      UPDATE public.organizations SET
        id = NEW.id,
        name = NEW.name,
        slug = NEW.slug,
        status = NEW.status,
        created_at = NEW.created_at,
        updated_at = NEW.updated_at
      WHERE id = OLD.id;
      RETURN NEW;
    END $$;

    CREATE OR REPLACE FUNCTION public._orgs_view_del() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      DELETE FROM public.organizations WHERE id = OLD.id;
      RETURN OLD;
    END $$;

    CREATE TRIGGER orgs_ins INSTEAD OF INSERT ON public.orgs FOR EACH ROW EXECUTE FUNCTION public._orgs_view_ins();
    CREATE TRIGGER orgs_upd INSTEAD OF UPDATE ON public.orgs FOR EACH ROW EXECUTE FUNCTION public._orgs_view_upd();
    CREATE TRIGGER orgs_del INSTEAD OF DELETE ON public.orgs FOR EACH ROW EXECUTE FUNCTION public._orgs_view_del();

  END IF;
END $$;

COMMIT;

