-- cria tabela/coluna de features (se ainda não existir)
CREATE TABLE IF NOT EXISTS org_features (
  org_id UUID PRIMARY KEY,
  features JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- índice para consultas por chave
CREATE INDEX IF NOT EXISTS idx_org_features_gin ON org_features USING GIN (features);

-- seed opcional: não habilita nada por padrão
