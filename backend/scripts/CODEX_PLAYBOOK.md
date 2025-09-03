# CODEX PLAYBOOK — CresceJá QA + Auto-Fix

Objetivo: garantir que o projeto backend+frontend do CresceJá instala, migra DB, sobe serviços, passa em lint, type-check, testes unitários e E2E, tentando corrigir automaticamente o que for seguro (eslint/prettier/audit). Em caso de falha, gerar relatórios e PRs com correções.

## Passos
1) Rode `./scripts/codex_full_test.sh`. Salve toda a saída em ./reports/full.log.
2) Se houver falhas de lint/prettier, aplique `--fix` e rode novamente os blocos que falharam.
3) Se houver falhas de type-check (tsc), sugira e aplique correções de tipo **mínimas** e localizadas. Re-rodar `tsc`.
4) Se houver falhas de testes unitários:
   - Ler mensagens de erro.
   - Corrigir import/export quebrados, mocks ausentes e erros de rota.
   - Re-rodar somente a suíte falha (ex.: `npm test -- <pattern>`).
5) Se a API não subir, verificar:
   - .env (portas, DB_URL).
   - Migrations/seed. Tente `prisma migrate deploy` ou `knex migrate:latest`.
   - Corrigir erros de schema (FK/colunas ausentes) com migrations compatíveis.
6) Se E2E falhar:
   - Ajustar seletor, timeout, rota ou dados seed.
   - É preferível corrigir o app a adaptar o teste se o comportamento esperado estiver correto.
7) Ao final, gerar um resumo em `./reports/summary.md` com:
   - Status por etapa
   - Correções aplicadas
   - Próximos itens manuais (se houver)
8) Se tudo verde, abrir PR “chore: QA green + fixes” com diffs.

Regras:
- Não mude regras de negócio sem autorização.
- Não comente testes em vez de corrigir o app.
- Toda mudança de contrato deve ter migration/teste/CHANGELOG.
