# Mapeamento dos processos de configuração das integrações

Este guia resume, card a card, o fluxo completo para configurar e validar cada integração disponível no painel. Todas as rotas aqui listadas exigem os cabeçalhos `Authorization: Bearer <jwt>` e `X-Org-Id: 8f181879-2f22-4831-967a-31c892f271bb`, salvo menção explícita em contrário.

> **Importante:** todos os fluxos assumem que o backend já está em execução localmente em `http://localhost:3000`.

## 1. WhatsApp Sessão (Baileys)

### Pré-requisito

1. Habilite o recurso na organização executando o SQL correspondente em `org_features` **ou** chamando a rota de administração:
   - `PUT /api/admin/orgs/8f181879-2f22-4831-967a-31c892f271bb/whatsapp_session/enable`

### Fluxo de configuração

1. **Iniciar sessão**: `POST /api/integrations/providers/whatsapp_session/connect`
   - Body: `{}`
   - Resultado: inicia o loop de QR Codes e o SSE começa a publicar eventos periódicos.
2. **Acompanhar QR / status**: `GET /api/integrations/providers/whatsapp_session/qr/stream`
   - Usa Server-Sent Events e retorna eventos `{"type":"qr", ...}` com o QR codificado e `{"type":"status","status":"pending_qr"}`.
   - Também aceita o parâmetro `?access_token=<token-assinado>` gerado pelo servidor como alternativa ao cabeçalho `X-Org-Id`.
3. **Parear no celular**: escaneie o QR code no aplicativo WhatsApp Business.
4. **Confirmar conexão (opcional)**: `POST /api/integrations/providers/whatsapp_session/mark-connected`
   - Body: `{}`
   - Atualiza o status da sessão para conectada após o pareamento.
5. **Desconectar (quando necessário)**: `POST /api/integrations/providers/whatsapp_session/disconnect`

### Script de referência (PowerShell)

```powershell
$BASE = "http://localhost:3000/api"
$ORG  = "8f181879-2f22-4831-967a-31c892f271bb"
$TOKEN= "<JWT válido>"

Invoke-RestMethod -Method POST -Uri "$BASE/integrations/providers/whatsapp_session/connect" -Headers @{
  Authorization = "Bearer $TOKEN"
  "X-Org-Id"    = $ORG
} -Body "{}" -ContentType "application/json"
```

Abra o SSE em outro terminal utilizando os mesmos cabeçalhos: `GET $BASE/integrations/providers/whatsapp_session/qr/stream`.

## 2. WhatsApp Business (Cloud API)

Rotas definidas em `backend/routes/integrations/whatsapp.cloud.js`.

1. **Conectar**: `POST /api/integrations/whatsapp/cloud/connect`
   - Body mínimo:
     ```json
     {
       "phone_number_id": "<id>",
       "access_token": "<token>",
       "waba_id": "<opcional>",
       "verify_token": "<opcional, recomendado>"
     }
     ```
2. **Registrar webhook**: `POST /api/webhooks/whatsapp/subscribe`
   - Utiliza `verify_token`, caso tenha sido informado, para validar o endpoint junto ao provedor.
3. **Verificar status**: `GET /api/integrations/whatsapp/cloud/status`
   - Deve retornar `status: "connected"` e os campos sensíveis mascarados.
4. **Desconectar**: `DELETE /api/integrations/whatsapp/cloud/disconnect`

## 3. Instagram Direct (Conta profissional)

Rotas principais: `routes/auth.instagram.js`, `routes/webhooks/meta.js` e `routes/webhooks/meta.pages.js`.

1. **Conectar**:
   - A partir do botão "Conectar" do painel, obtenha um **User Access Token** e informe o `instagram_business_account_id` (ou `page_id`).
   - O backend persiste o token e associa a conta profissional à organização.
2. **Assinar webhook**: utilize a rota de subscribe correspondente ao Instagram/Meta para validar o endpoint público.
3. **Testar**: acione o endpoint de teste (ex.: `GET /me?fields=id` ou envio de uma mensagem de eco) para confirmar que o token e o webhook estão operacionais.

> **Observação:** um `403` ao abrir o card normalmente indica ausência do cabeçalho `X-Org-Id` ou falha na chamada de status. Confirme que o frontend está enviando o header; os logs indicam que o contexto de organização está chegando corretamente.

## 4. Facebook Pages

Rotas principais: `routes/auth.facebook.js` e `routes/webhooks/meta.pages.js`.

1. **Conectar**: informe o **User Access Token** e o **Page ID** da página que deseja administrar.
2. **Assinar webhook**: execute a rota de subscribe específica para Pages, utilizando o `verify_token` configurado na Meta.
3. **Testar**: utilize o endpoint de teste fornecido (ex.: publicação de mensagem de teste ou `GET /me`).

## 5. Google Calendar (Conta de serviço)

Rotas em `backend/routes/integrations/google.calendar.js`, expostas via `routes/integrations/index.js`.

1. **Conectar**: `POST /api/integrations/providers/google_calendar/connect`
   - Body:
     ```json
     {
       "calendar_id": "primary",
       "client_email": "svc@project.iam.gserviceaccount.com",
       "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
       "timezone": "America/Sao_Paulo"
     }
     ```
   - Requer privilégio mínimo `OrgAdmin`. Perfis `OrgOwner` e `SuperAdmin` também atendem ao requisito.
2. **Testar credenciais**: `POST /api/integrations/providers/google_calendar/test`
   - Executa `freeBusy`/`events.list` para validar o acesso da conta de serviço.
3. **Desconectar**: `DELETE /api/integrations/providers/google_calendar/disconnect`

---

Seguindo os fluxos acima, cada card de integração deve sair do estado de erro inicial e permanecer operacional. Se algum endpoint específico continuar retornando `403`, anote a rota exata e reporte para análise de permissões ou feature flag.
