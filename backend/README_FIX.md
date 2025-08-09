# CresceJá Backend – Ajustes Aplicados

Este pacote contém correções para você copiar por cima do seu repositório.

## O que foi feito

1. **Entrypoint corrigido**
   - `package.json`: `main` → `server.js`, scripts `start`/`dev` atualizados.
   - Removido `sequelize`/`sequelize-cli` (não usados).

2. **Dependências**
   - Adicionadas: `jsonwebtoken`, `bcrypt`, `socket.io`, `axios`, `uuid`.

3. **Banco de dados centralizado**
   - `db.js` agora usa `DATABASE_URL` (ou variáveis separadas).
   - Todas as rotas passaram a importar `const pool = require('../db')` (ou `./db`).

4. **JWT**
   - `middleware/authenticate.js` usa `process.env.JWT_SECRET` (fallback `'segredo'`).

5. **WebSocket**
   - `server.js` refeito com Socket.IO + autenticação por JWT.

6. **SQL**
   - `sql/schema.sql`: cria as tabelas mínimas (`users`, `leads`, `crm_opportunities`, `appointments`, `conversations`, `messages`).
   - `sql/seed_demo_user.sql`: adiciona usuário **admin@example.com / admin123** (apenas dev).

7. **.env**
   - Adicionado `backend/.env.example` com todas as chaves.
   - Adicionado `backend/.gitignore` (ignora `node_modules` e `.env`).

8. **Frontend (dev)**
   - `frontend/package.json`: adicionado `"proxy": "http://localhost:4000"`.
   - Substituído `'Bearer fake-jwt-token'` por `Bearer ${localStorage.getItem('token') || ''}` nos componentes afetados.

## Como rodar (dev)

1. **Banco**
   ```bash
   psql "$DATABASE_URL" -f backend/sql/schema.sql
   psql "$DATABASE_URL" -f backend/sql/seed_demo_user.sql   # opcional (dev)
   ```

2. **Backend**
   ```bash
   cd backend
   cp .env.example .env    # edite os valores
   npm install
   npm run dev
   ```

3. **Frontend**
   ```bash
   cd frontend
   npm install
   npm start
   ```

4. **Login de teste (se seed rodou)**
   - E-mail: `admin@example.com`
   - Senha: `admin123`

> **Produção:** configure `DATABASE_URL`, `JWT_SECRET` e variáveis do provedor de WhatsApp conforme for usar (Meta ou Twilio). **Não** versione `.env` nem `node_modules`.
