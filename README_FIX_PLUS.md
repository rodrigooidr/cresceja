# CresceJá – Fix Pack PLUS (com melhorias)

Inclui:
- DB consolidado (`backend/config/db.js`)
- Logs (`pino`, `pino-http`)
- Validação (`zod`) em auth
- WebSocket (`socket.io`) com JWT e modo de teste
- Índices SQL (`backend/sql/indices.sql`)
- Scripts de bootstrap (`backend/scripts/db_bootstrap.ps1|.sh`) e smoke test (`npm run smoke`)
- Compose atualizado com envs do WS
- `backend/package.merge.json` para mesclar deps/scripts

## Uso rápido
1) Suba Postgres + Backend:
```bash
cd infra && docker compose -f docker-compose.dev.yml up -d --build
```

2) Bootstrap do banco (Windows):
```powershell
npm --prefix ./backend run db:bootstrap:ps
```
ou (bash):
```bash
npm --prefix ./backend run db:bootstrap:sh
```

3) Seed do admin (se necessário):
```powershell
Get-Content .\infra\seed_admin.sql | docker compose -f .\infra\docker-compose.dev.yml exec -T postgres psql -U cresceja -d cresceja_db -v ON_ERROR_STOP=1
```

4) Instalar deps (após mesclar `backend/package.merge.json`):
```bash
cd backend
npm install pino pino-http zod socket.io cors helmet express express-rate-limit jsonwebtoken bcrypt pg nodemon --save
```

5) Smoke test:
```bash
npm run smoke --prefix ./backend
```

6) Frontend local: mantenha o proxy para `http://localhost:4000` e rode `npm start`.
