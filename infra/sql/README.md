
# CresceJá — Inferência de Esquema a partir do Código

Script Node (`schema-infer/infer_schema_from_code.mjs`) que varre seu repositório
(JS/TS/SQL), deduz tabelas/colunas por meio de SELECT/INSERT/UPDATE/CREATE e
gera DDL Postgres heuristicamente (tabelas -> FKs -> triggers).

## Uso (PowerShell, pasta `infra`)
```powershell
# Gere o SQL a partir do repo (ajuste o caminho do repo):
node .\schema-infer\infer_schema_from_code.mjs "..\.." > .\sql\inferred_schema.sql

# Aplique no Postgres:
type ".\sql\inferred_schema.sql" | docker compose exec -T postgres psql -U cresceja -d cresceja_db
```

### Seeds (opcional)
```powershell
$env:INFER_SEED="true"
node .\schema-infer\infer_schema_from_code.mjs "..\.." > .\sql\inferred_schema_with_seed.sql
```

### Ajustes
- Mapeie FKs específicas em `FK_MAP` dentro do script (ex.: `account_id` -> `whatsapp_channels`).
- O script cria `id/created_at/updated_at` se faltarem.
- Tipos inferidos por nome (`*_id`=uuid, `*_at`=timestamptz, `is_*`=boolean, `*_json`=jsonb, etc.).
