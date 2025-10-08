# Plano Único de Setup e Testes E2E

Este guia descreve, passo a passo, como preparar o ambiente local, configurar as integrações necessárias e executar os testes de validação ponta a ponta do Cresceja. Execute as etapas na ordem apresentada para garantir que todos os serviços estejam operacionais.

## 0. Pré-requisitos locais

- **Node.js**: utilize a mesma versão especificada em `env_meta_20251008_142226/node_version.txt`.
- **Docker & Docker Compose**: já configurados conforme `infra/docker-compose.yml`.
- **ngrok** (ou Cloudflare Tunnel): necessário para expor o backend na porta `4000` e receber webhooks externos.

## 1. Banco de dados e migrações

No diretório raiz do projeto:

```bash
# Inicializa Postgres e Redis
docker compose -f infra/docker-compose.yml up -d postgres redis

# Aguarde os serviços ficarem saudáveis e aplique as migrações do backend
cd backend
node scripts/migrate.js
```

As migrações criam/atualizam as tabelas necessárias, como `google_calendar_accounts`, `google_oauth_tokens`, `integration_events`, `facebook_pages`, `instagram_accounts`, `whatsapp_*`, `plan_features`, entre outras.

### Ajuste opcional de features do plano

Se a organização utilizada não estiver vinculada a um plano com as features mínimas, habilite-as executando os comandos abaixo (substitua `:org_id` e `:plan_id` pelos valores corretos):

```sql
-- Permite até 3 agendas Google e suporte a WhatsApp Session/Cloud
INSERT INTO plan_features (plan_id, feature_code, value)
VALUES
  (:plan_id, 'google_calendars', 3)
ON CONFLICT (plan_id, feature_code) DO UPDATE SET value = EXCLUDED.value;

INSERT INTO plan_features (plan_id, feature_code, value)
VALUES
  (:plan_id, 'whatsapp_session', 1),
  (:plan_id, 'whatsapp_cloud', 1)
ON CONFLICT (plan_id, feature_code) DO UPDATE SET value = EXCLUDED.value;
```

## 2. Configuração do backend (`.env` completo)

Crie o arquivo `backend/.env.docker` com o conteúdo abaixo, preenchendo os campos marcados com `***`:

```env
# ===== Core =====
NODE_ENV=production
PORT=4000
BASE_URL=http://localhost:4000
FRONTEND_URL=http://localhost:3000
CORS_ORIGINS=http://localhost:3000
CORS_ORIGIN=http://localhost:3000
LOG_PRETTY=0

# ===== Auth =====
JWT_SECRET=troque-por-uma-chave-forte
SSE_TOKEN_SECRET=troque-por-uma-chave-forte
ALLOW_DEV_TOKENS=1

# ===== Database =====
DATABASE_URL=postgres://cresceja:cresceja123@postgres:5432/cresceja_db
PG_POOL_MAX=10

# ===== Redis =====
REDIS_URL=redis://redis:6379

# ===== Storage (uploads opcionais) =====
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
S3_BUCKET=
S3_REGION=

# ===== E-mail (SMTP) =====
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=
EMAIL_FROM=

# ===== Google OAuth / Calendar =====
GOOGLE_CLIENT_ID=***.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=***
PUBLIC_BASE_URL=https://SEU-SUBDOMINIO.ngrok.io
GCAL_REDIRECT_URI=${PUBLIC_BASE_URL}/api/auth/google/callback

# ===== Meta (Facebook/Instagram/Messenger) =====
META_APP_ID=***
META_APP_SECRET=***
META_VERIFY_TOKEN=uma-frase-secreta-para-verificacao
META_PAGE_ACCESS_TOKEN=***
META_IG_APP_ID=***
META_IG_APP_SECRET=***
META_WEBHOOK_VERIFY_URL=${PUBLIC_BASE_URL}/api/webhooks/meta

# ===== WhatsApp =====
WPP_SESSION_DIR=./.wpp_auth
WHATSAPP_CLOUD_TOKEN=***
WHATSAPP_PHONE_NUMBER_ID=***
WHATSAPP_BUSINESS_ACCOUNT_ID=***
WHATSAPP_CLOUD_WEBHOOK_URL=${PUBLIC_BASE_URL}/api/webhooks/whatsapp

# ===== OpenAI (opcional) =====
OPENAI_API_KEY=

# ===== Diagnóstico =====
DIAG_SQL=0
DIAG_UNHANDLED=1
```

> **Importante**
> - No Google Cloud Console, cadastre o redirect: `https://SEU-SUBDOMINIO.ngrok.io/api/auth/google/callback`.
> - No painel da Meta, cadastre o webhook: `https://SEU-SUBDOMINIO.ngrok.io/api/webhooks/meta`, utilizando o `META_VERIFY_TOKEN` informado.

## 3. Subindo backend e workers

1. Em um terminal separado, gere a URL pública do backend:

   ```bash
   ngrok http 4000
   ```

2. No diretório raiz, suba os serviços do backend e os workers:

   ```bash
   docker compose -f infra/docker-compose.yml up -d --build
   ```

O arquivo `infra/docker-compose.yml` já define os serviços `backend`, `worker`, `social-worker`, `calendar` e outros consumidores de fila. Se preferir rodar workers específicos manualmente:

```bash
cd backend
node queues/instagram.publish.worker.js
node queues/facebook.publish.worker.js
node queues/calendar.worker.js
```

## 4. Testes de saúde e integrações

### 4.1 Health & Auth Dev

```bash
# Health check
curl -fsS http://localhost:4000/api/public/health

# Login de desenvolvimento (requer ALLOW_DEV_TOKENS=1)
curl -fsS -X POST http://localhost:4000/api/auth/dev-login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@local","orgId":"<UUID_DA_ORG>","role":"OrgAdmin"}'
```

Guarde o token retornado (Bearer) para os testes subsequentes.

### 4.2 Google Calendar

1. Inicie o fluxo OAuth:

   ```text
   GET ${PUBLIC_BASE_URL}/api/auth/google/install?returnTo=${FRONTEND_URL}/agenda
   ```

   Após consentir, você será redirecionado para `${FRONTEND_URL}/agenda?connected=1`.

2. Listar agendas e eventos:

   ```bash
   curl -fsS -H "Authorization: Bearer <TOKEN>" \
     "${PUBLIC_BASE_URL}/api/integrations/google/calendar/list"
   ```

3. Criar evento de teste:

   ```bash
   curl -fsS -X POST -H "Authorization: Bearer <TOKEN>" \
     -H "Content-Type: application/json" \
     -d '{"summary":"Teste E2E","start":"2025-10-08T18:00:00-03:00","end":"2025-10-08T18:30:00-03:00"}' \
     "${PUBLIC_BASE_URL}/api/integrations/google/calendar/events"
   ```

   Se receber `403` por limite, garanta que o plano possua a feature `google_calendars` configurada conforme a etapa 1.

### 4.3 Meta (Facebook/Instagram/Messenger)

- **Verificação de webhook (GET)** – chamada automática do painel da Meta:

  ```text
  GET ${PUBLIC_BASE_URL}/api/webhooks/meta?hub.mode=subscribe&hub.verify_token=${META_VERIFY_TOKEN}&hub.challenge=123
  ```

  O backend deve responder com `200` e corpo `123`.

- **Assinar e receber eventos** – no App da Meta, inscreva os tópicos desejados (messages, instagram, pages_messaging) apontando para o mesmo webhook. Envie uma DM no Instagram ou mensagem na Page; o backend normaliza o evento via `services/inbox/ingest.js`, exibindo a conversa no Inbox.

- **Envio de mensagens** – requer `META_APP_ID/SECRET` e `META_PAGE_ACCESS_TOKEN` válidos, além do `social-worker` em execução.

### 4.4 WhatsApp

#### A) WhatsApp Session (Baileys via QR)

```bash
# Inicia a sessão via QR
curl -fsS -X POST -H "Authorization: Bearer <TOKEN>" \
  ${PUBLIC_BASE_URL}/api/integrations/whatsapp/session/start

# Consulta status da sessão
curl -fsS ${PUBLIC_BASE_URL}/api/integrations/whatsapp/session/status
```

O backend emitirá `wa:session:qr` via Socket.IO; a interface de Integração no frontend exibe o QR para leitura. Após autenticar, o status deve retornar `{ "status": "connected" }`. Mensagens recebidas serão direcionadas ao Inbox. O envio utiliza as rotas existentes em `routes/whatsapp.js` e `services/whatsapp.js`. Certifique-se de que `@whiskeysockets/baileys` esteja instalado (já presente em `backend/package.json`) e que o diretório `WPP_SESSION_DIR` exista para persistência.

#### B) WhatsApp Cloud (API Meta)

Configure as variáveis `WHATSAPP_CLOUD_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` e `WHATSAPP_BUSINESS_ACCOUNT_ID`. Cadastre o webhook na Meta apontando para:

```text
POST ${PUBLIC_BASE_URL}/api/webhooks/whatsapp
```

Teste de envio:

```bash
curl -fsS -X POST -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"to":"+55XXXXXXXXXXX","template":"hello_world"}' \
  ${PUBLIC_BASE_URL}/api/integrations/whatsapp/cloud/send
```

## 5. Frontend

- O backend atende em `http://localhost:4000` e o CORS já libera `http://localhost:3000`.
- As páginas principais para monitorar as integrações são `src/pages/agenda/AgendaPage.jsx` e as telas de Integrações/Inbox.
- Com o backend configurado, a UI exibirá QR codes, botões de conexão do Google e status das integrações.

> Se necessário, ajuste a UI para refletir o endpoint `GET /api/integrations/status`, exibindo alertas como “Webhook não verificado” ou “Token expirado”.

## 6. Checagens finais (smoke tests)

- `GET /api/public/health` → deve retornar `200 OK`.
- `GET /api/integrations/status` (com Bearer token) → deve listar o status `connected` ou `pending` para cada provedor.
- Inbox: envie uma mensagem real (IG/FB/WA) e confirme que aparece na conversa.
- Responda pelo Inbox e valide a entrega.
- Agenda: crie um evento e valide sua criação no Google.

## 7. Garantias já presentes no código

- Rotas registradas em `server.js`: `/api/integrations`, `/api/webhooks/meta`, `/api/webhooks/whatsapp`, `/api/auth/google/*`.
- Workers configurados no `docker-compose.yml` (`repurpose`, `social`, `calendar`, etc.).
- Implementação do Baileys em `services/whatsappSession.js` utilizando `useMultiFileAuthState`.
- Consulta de features via `services/features.js` (use os comandos SQL da etapa 1 quando necessário).
- CORS e Socket.IO preparados para `http://localhost:3000`.

---

Seguindo este fluxo você terá o ambiente completo do Cresceja pronto para validar integrações com Google Calendar, Meta (Facebook/Instagram/Messenger) e WhatsApp (Session e Cloud).
