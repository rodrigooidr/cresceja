# CresceJá – Inbox v1 (Híbrido): Especificação, Contratos e Tarefas

> Objetivo: implementar **todas** as lacunas listadas pelo Rodrigo com **mínimo de erros**, usando o fluxo “Especificação + Guardrails + Codex + Gate de Qualidade”. Este documento é a **fonte da verdade** para o Codex e para revisão humana.

---

## 0) Visão Geral

A tela **Inbox** precisa suportar:

* Busca “digitação ao vivo” (search-as-you-type) e filtros por **canal** (WhatsApp, Instagram, Facebook, Web, SMS, …) e por **tags/status**.
* Ícones de **canal** ao lado do nome do contato e no cabeçalho da conversa.
* **Tags** de conversa (pré-criadas pelo admin) com seleção/remoção rápida.
* Atribuição de **status** (funil de vendas), opcional, sem bloquear o fluxo de atendimento.
* **Emojis** no composer.
* **Arquivos/fotos**: envio, recebimento, preview (thumb) e download/abrir.
* **Templates** de mensagem por canal.
* Toggle **IA atendente** on/off por conversa.
* **Composer expansível** (auto-grow + retrair/expandir manualmente).
* **Timestamps** (data/hora local) por mensagem e no cabeçalho.
* **Editar/Criar cliente** no painel lateral.
* **Áudio → transcrição** (exibir transcript junto ao áudio quando pronto).
* **Grupos**: IA **não** responde; **cadastro do cliente desabilitado**.

---

## 1) Contratos de API (Backend)

> **Regra de ouro**: todas as rotas retornam **200** com payload padronizado e **nunca** `/api/api/...`. Autenticação via `Bearer`.

### 1.1 Conversas

```
GET  /api/conversations?search=string&channels=csv&tags=csv&status=csv&limit=30&cursor=opaque
→ { items: Conversation[], nextCursor?: string }
```

* `search`: nome/telefone do contato e último texto da conversa.
* `channels`: ex. `whatsapp,instagram`.
* `tags`: slugs/ids, ex. `vip,recorrente`.
* `status`: ids do pipeline de CRM.

```
GET  /api/conversations/:id
→ { conversation: Conversation }
```

```
PUT  /api/conversations/:id/ai   { enabled: boolean }
→ { conversation: Conversation }
```

```
PUT  /api/conversations/:id/tags { tags: string[] }  // ids ou slugs
→ { conversation: Conversation }
```

```
PUT  /api/conversations/:id/crm-status { status_id: string|null }
→ { conversation: Conversation }
```

### 1.2 Mensagens

```
GET  /api/conversations/:id/messages?limit=50&cursor=opaque
→ { items: Message[], nextCursor?: string }
```

```
POST /api/conversations/:id/messages
Body (texto): { type: "text", text: string }
Body (template): { type: "template", template_id: string, variables?: Record<string,string> }
Body (arquivo): { type: "file", attachments: string[] } // ids de assets
→ { message: Message }
```

### 1.3 Anexos

```
POST /api/conversations/:id/attachments  (multipart/form-data)
  files[]: File
→ { assets: Asset[] }
```

### 1.4 Recursos auxiliares

```
GET /api/tags
→ { items: Tag[] }

GET /api/crm/statuses
→ { items: CrmStatus[] } // pipeline

GET /api/templates?channel=whatsapp
→ { items: Template[] }

GET /api/clients/:id
→ { client: Client }

POST /api/clients
→ { client: Client }

PUT /api/clients/:id
→ { client: Client }
```

> **Transcrição de áudio**: a criação da mensagem de áudio deve retornar `Message` com `type:"audio"` e `audio_url`. O worker publicará `message:updated` quando `transcript_text` ficar disponível.

---

## 2) Modelos (Front/Back)

```ts
// Conversation
{
  id: string;
  channel: "whatsapp"|"instagram"|"messenger"|"web"|"sms"|string; // extensível
  origin_channel?: string; // exibe ícone de origem
  status_id?: string|null; // CRM pipeline
  tags: string[];          // ids ou slugs
  ai_enabled: boolean;
  is_group: boolean;       // grupos: IA não responde, cadastro cliente desabilitado
  contact: {
    id?: string; name?: string; phone_e164?: string; photo_url?: string;
  };
  last_message_preview?: string;
  updated_at: string; // ISO
}

// Message
{
  id: string;
  type: "text"|"image"|"audio"|"file"|"template";
  text?: string;                    // para text/template (expandido já resolvido)
  from: "customer"|"agent";
  created_at: string;               // ISO
  attachments?: Asset[];            // thumbs, etc.
  audio_url?: string;               // quando type === "audio"
  transcript_text?: string|null;    // preenchido quando pronto
  group_meta?: { group_id: string; sender_name?: string }; // msgs de grupo
}

// Asset
{
  id: string;
  url: string;
  thumb_url?: string;
  mime: string; // image/*, audio/*, application/pdf, etc
  size_bytes?: number;
}

// Tag
{ id: string; name: string; slug: string; color?: string }

// CrmStatus
{ id: string; name: string; stage_index: number; color?: string }

// Template
{ id: string; channel: string; name: string; variables: string[]; example?: string }

// Client
{ id: string; name?: string; phone_e164?: string; email?: string; notes?: string }
```

---

## 3) Sockets (tempo real)

* `message:new` → `{ conversationId: string, message: Message }`
* `message:updated` → `{ conversationId: string, message: Message }` // usado p/ transcript
* `conversation:updated` → `{ conversation: Conversation }` // tags, status, ai
* (opcional) `typing` e `read` podem ser tratados no futuro.

---

## 4) UI/UX – Componentes e Fluxos

### 4.1 Barra de filtros (topo da lista)

* **Busca**: input com debounce (300ms). Enquanto digita → chama `GET /conversations?search=...` preservando `channels/tags/status` selecionados. Mostrar spinner no input durante a consulta.
* **Filtro por canal**: checkboxes/segmented (WhatsApp, Instagram, Facebook, Web, SMS, Outros). Persistir em URL/estado.
* **Filtro por tags**: multi-select (chips).
* **Filtro por status**: drop-down (pipeline CRM).

### 4.2 Lista de conversas (esquerda)

* Cada item: foto do contato, **ícone do canal** (mapeado por slug), nome/telefone, última mensagem (1 linha), timestamp relativo (ex. "há 3 min"), badge de **tags** (até 2, com "+N").
* **Virtualizada** se possível (performance).

### 4.3 Cabeçalho da conversa (coluna central topo)

* Foto + nome do contato; **ícone do canal/origem**.
* Toggle **IA on/off**.
* **Status CRM** (select opcional); **Tags** (picker de chips).
* Botões: **Editar cliente** / **Criar cliente** (desabilitar se `is_group`).

### 4.4 Timeline de mensagens

* Bubbles com alinhamento por `from`, cor clara vs. acento.
* **Timestamp** em tooltip e/ou texto pequeno sob a bubble.
* **Anexos**: grid de thumbs; click → lightbox / download.
* **Áudio**: player nativo + balão com `transcript_text` (cinza) quando existir. Antes de pronto: chip “Transcrevendo…”. Atualizar via `message:updated`.
* **Mensagens de grupo**: exibir `sender_name` quando disponível.

### 4.5 Composer (rodapé da coluna central)

* **Textarea auto-grow** com limite (ex. 6 linhas); botão **expandir/retrair** (maximiza até \~40% da altura da coluna).
* Botões: **Emoji**, **Anexar** (arquivos/fotos), **Templates** (abre drawer/menú para seleção + form de variáveis), **Enviar**.
* Upload: arrastar-soltar na área do composer.
* Bloqueios em **grupo**: ocultar botão “Template” e qualquer acionamento de IA; impedir “Editar/Criar cliente”.

### 4.6 Painel lateral direito (cliente)

* Mostra dados do cliente; **Editar** abre formulário inline; **Criar** quando contato não cadastrado.
* Em **grupo**: exibir aviso “Cadastro desabilitado para conversas em grupo”.

---

## 5) Normalização no Front (Obrigatório)

Arquivo: `src/inbox/normalizeMessage.js`

```js
export function normalizeMessage(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const type = raw.type || (raw.text ? 'text' : 'file');
  const direction = raw.direction ?? (raw.is_outbound ? 'outbound' : raw.is_inbound ? 'inbound' : undefined);
  const from = raw.from || (direction === 'outbound' ? 'agent' : direction === 'inbound' ? 'customer' : 'customer');

  return {
    id: raw.id || raw.message_id || `${Date.now()}-${Math.random()}`,
    type,
    text: raw.text ?? raw.body ?? '',
    from,
    created_at: raw.created_at || raw.timestamp || new Date().toISOString(),
    attachments: Array.isArray(raw.attachments) ? raw.attachments : [],
    audio_url: raw.audio_url,
    transcript_text: raw.transcript_text ?? null,
    group_meta: raw.group_meta,
  };
}
```

> **Uso**: Toda resposta de `GET/POST` e todo evento de socket deve passar pelo `normalizeMessage()` **antes** de ir para o state.

---

## 6) Ícones de Canal (mapa)

Arquivo: `src/inbox/channelIcons.ts`

```ts
export const channelIconBySlug: Record<string, string> = {
  whatsapp: 'lucide:whatsapp',
  instagram: 'lucide:instagram',
  messenger: 'lucide:facebook',
  web: 'lucide:globe',
  sms: 'lucide:message-square',
  default: 'lucide:message-circle',
};
```

> Implementação real pode usar `lucide-react` ou outro set já usado no projeto.

---

## 7) Validações (Zod) – Front

* `ConversationSchema`, `MessageSchema`, `AssetSchema`, `TemplateSchema`… em `src/inbox/schemas.ts`.
* Ao receber payload do backend, validar → fallback para normalização/erros visíveis de forma branda (toast).

---

## 8) Backend – Esboço de Tabelas/Alterações

> Ajustar nomes conforme seu padrão atual. Priorizar migrações idempotentes.

* `conversations`

  * `channel text not null`
  * `origin_channel text` (opcional)
  * `status_id uuid null` (FK `crm_statuses`)
  * `tags text[] default '{}'` **ou** tabela pivô `conversation_tags`
  * `ai_enabled boolean default true`
  * `is_group boolean default false`
  * índices: `(org_id, updated_at)`, `(org_id, channel)`, `(org_id, status_id)`

* `messages`

  * `type text not null check (type in ('text','image','audio','file','template'))`
  * `text text null`
  * `attachments jsonb default '[]'`
  * `audio_url text null`
  * `transcript_text text null`
  * `group_meta jsonb null`
  * índices: `(conversation_id, created_at desc)`

* `assets`

  * `id uuid pk`, `org_id uuid`, `url text`, `thumb_url text`, `mime text`, `size_bytes int`
  * **RLS** por `org_id`

* `crm_statuses`

  * `id uuid pk`, `name text`, `stage_index int`, `color text`

* `tags`

  * `id uuid pk`, `name text`, `slug text unique`, `color text`
  * pivô `conversation_tags(conversation_id, tag_id)` se não usar array

* `clients`

  * já existente; adicionar campos `notes` (opcional)

**Workers**

* Transcrição de áudio (Whisper ou serviço externo) sinaliza via `message:updated`.
* Publicador de thumbs (gera `thumb_url` para imagens).

**Regras**

* `is_group = true` → **não chamar** motor de IA para auto-reply; endpoint `PUT /clients/:id` retorna 403 quando origem é grupo.

---

## 9) Testes (obrigatórios no PR)

### 9.1 Unit (Jest)

* `normalizeMessage.test.js`: cobre payloads com/sem `direction`, com/sem `attachments`, áudio, grupo.
* `channelIcons.test.ts`: fallback para `default` quando slug desconhecido.

### 9.2 Integração (Jest + MSW)

* `inbox.api.test.ts`:

  * GET /conversations com filtros → retorna `items` coerentes.
  * POST /messages (text/template/file) → valida `message` normalizado.

### 9.3 E2E (Playwright/Cypress)

* Fluxo: abrir conversa → enviar texto → aparece no topo com timestamp.
* Upload de imagem → thumb visível e download funcional.
* Toggle IA → `conversation:updated` reflete estado.
* Selecionar template → abrir modal de variáveis → enviar resolvido.

### 9.4 Guardrail de código

```
grep -R --line-number -E "fetch\(|axios\.(get|post|put|delete)\(|/api/" src | grep -v "src/api/inboxApi"
```

Saída deve ser **vazia**.

---

## 10) Tarefas para o Codex (Checklist de Entrega)

> **Cole o bloco abaixo no prompt do Codex.**

**Instruções obrigatórias**

1. Usar **exclusivamente** `src/api/inboxApi.js` para HTTP (não criar outros clients, não usar `fetch`).
2. **Não** prefixar rotas com `/api` (o `baseURL` já tem `/api`).
3. Toda mensagem recebida/enviada deve passar por `normalizeMessage()`.
4. Implementar componentes em `src/pages/inbox` e `src/components/inbox`.
5. Atualizar socket `message:new` e `message:updated` conforme contrato.
6. Adicionar testes (Jest) e **não** quebrar build.

**Entregáveis**

* Filtros: busca com debounce (300ms), canais, tags, status (UI + querystring → API).
* Ícones de canal na lista e no cabeçalho da conversa.
* Tags: listar (`GET /tags`), atribuir (`PUT /conversations/:id/tags`).
* Status CRM: listar (`GET /crm/statuses`), setar (`PUT /conversations/:id/crm-status`).
* Emojis: botão no composer (biblioteca já usada no projeto ou `emoji-mart`), inserção no textarea.
* Anexos: upload (`POST /conversations/:id/attachments`), enviar (`POST /messages` com `attachments`), render thumbs e download.
* Templates: picker (`GET /templates?channel=...`), envio por template (resolver variáveis → `POST /messages`).
* IA: toggle (`PUT /conversations/:id/ai`) e UI sincronizada.
* Composer: auto-grow (até 6 linhas) + botão expandir/retrair (até \~40% da altura da coluna).
* Timestamp: exibir em cada bubble (tooltip + label pequeno), e no cabeçalho a última atividade.
* Cliente: painel direito com **Editar** (PUT) ou **Criar** (POST); em grupo, desabilitar e mostrar aviso.
* Áudio: bubble com player + transcript (quando `message:updated` trouxer `transcript_text`).
* Grupos: se `is_group` → ocultar botões de IA/Template/Cliente; bloquear IA backend.

**Aceitação**

* `npm run build` sem erros.
* `npm test` verde.
* Guardrail `grep` retorna vazio.
* Manual: upload imagem → thumb + abrir; template enviado com variáveis; busca live atualiza lista; toggle IA persiste.

---

## 11) Tarefas de Backend (se necessário)

* Criar/ajustar rotas listadas em **1)**, com **validação** (Zod/Joi) e respostas no formato definido.
* Garantir eventos socket em **3)**.
* Migrações seguras (idempotentes) conforme **8)**, com RLS por `org_id` onde aplicável.
* Middleware: bloquear IA em `is_group`.
* Geração de `thumb_url` para imagens no worker, e transcrição de áudio com publicação do `message:updated`.

---

## 12) Observações e padrões

* **Internacionalização**: timestamps localizados (pt-BR), exibir horário curto no bubble, data agrupada por dia.
* **Acessibilidade**: botões com `aria-label`, foco visível, atalhos (Enter envia, Shift+Enter quebra linha).
* **Perf**: paginação por cursor; virtualização opcional na lista de conversas e timeline quando > 200 itens.

---

## 13) Próximos passos

1. Criar branch `feature/chat-inbox-v1`.
2. Commitar este documento em `docs/chat-inbox-contract.md`.
3. Adicionar skeletons: `normalizeMessage.js`, `channelIcons.ts`, schemas Zod.
4. Rodar Codex com o **Checklist de Entrega** acima.
5. Abrir PR com esta spec e executar o **Gate** dos testes/guardrails.

---

## 14) Configurações ▸ Canais (WhatsApp, Instagram, Facebook) – Wizard Dinâmico + Providers (Meta Cloud, Baileys)

> Esta seção estende a especificação para **Configurações de Canais**, com suporte a **dois providers de WhatsApp**: **Oficial (Meta Cloud API)** e **QR Code (Baileys)**. Regras de plano, RBAC, endpoints e testes incluídos.

### 14.1 UI/UX – Tela "Configurações ▸ Canais"

* **Tabs por canal**: WhatsApp, Instagram, Facebook (Messenger). Espaço preparado para futuros: Web Chat, SMS, E-mail.
* **Wizard dinâmico (stepper)** por canal/provider:

  1. **Escolher provedor** (p. ex., "WhatsApp → Oficial (Meta Cloud)" ou "WhatsApp → Baileys (QR)").
  2. **Credenciais** (form gerado por `form_schema` do provider).
  3. **Webhook** (URL, Verify Token, botões "Copiar", instruções passo a passo por provider).
  4. **Permissões/assinaturas** (quando houver, ex.: Graph subscriptions).
  5. **Conectar & Validar** (teste de credenciais e webhook reachability).
  6. **Teste ponta a ponta** (enviar mensagem de teste e simular inbound; exibir resultado em tempo real).
* **Limites por plano visíveis**: badge tipo "WhatsApp números: 2/5 usados"; Instagram e Facebook: 1/1.
* **Saúde**: card com `status`, `last_tested_at`, `last_error`, botão **"Executar diagnóstico"** (verifica credenciais, webhook, permissões e publica resultado).
* **Segurança de segredos**: campos do tipo `secret` são mascarados; botão "Revelar" com confirmação; loga auditoria.
* **Rotação de tokens**: ação dedicada com confirmação + audit log.
* **Ambiente**: `mode: 'sandbox'|'production'` com banner visual.
* **Simulador de webhook** (DEV/Stage): envia payloads de exemplo e mostra o que o sistema processou.
* **Regras de grupo** lembradas: indicador se número recebe mensagens de grupo; IA não responde grupos (policy já definida no Inbox).

### 14.2 Providers de WhatsApp

* **Oficial (Meta Cloud API)**: disponível para **OrgAdmin** e **SuperAdmin** (respeitando limites por plano). Suporta múltiplos números (`wa_numbers`).
* **Baileys (QR Code)**: **NÃO** pode ser criado/ativado pelo OrgAdmin. **Apenas SuperAdmin** pode adicionar manualmente ao perfil do **Org** no painel **Admin ▸ Clientes (Orgs)**. Após criado pelo SuperAdmin, o OrgAdmin **visualiza** status, mas não cria/remove sesssões.
* **Quota**: Cada número/instância (Meta ou Baileys) **conta para o limite de WhatsApp do plano** da organização.

### 14.3 RBAC e acesso

* **OrgAdmin**: pode criar/editar **Meta Cloud**; não enxerga o fluxo de criação do **Baileys** (apenas card desabilitado com aviso "Solicite ao suporte"). Pode ver o estado do Baileys **se** já existir para sua org, mas não pode criar/remover.
* **SuperAdmin**: pode criar/remover **Baileys** para qualquer org; pode também criar Meta Cloud para debugging, quando necessário.
* **RLS/Isolamento**: todas as entradas de `channel_configs`, `wa_numbers` e `baileys_sessions` são isoladas por `org_id`.

### 14.4 Modelo de Dados (extensão)

* **channel_configs**

  * `id uuid pk`, `org_id uuid`, `type text` (`whatsapp|instagram|facebook|...`), `provider text` (`meta_cloud|baileys|...`)
  * `status text` (`disabled|pending|connected|error`)
  * `settings jsonb` (não sensível), `secret_ref uuid` (FK → `secrets`)
  * `limits jsonb` (e.g., `{"whatsapp_numbers_max":5}`), `mode text` (`sandbox|production`)
  * `last_tested_at timestamptz`, `last_error text`, timestamps
* **secrets** (cofre)

  * `id uuid pk`, `org_id uuid`, `ciphertext bytea`, `version int`, `created_by uuid`, timestamps
* **wa_numbers** (para **Meta Cloud**)

  * `id uuid pk`, `org_id uuid`, `config_id uuid fk`, `phone_e164 text`, `display_name text`, `waba_id text`, `phone_id text`, `quality_rating text`, `status text`, `webhook_set boolean`, `is_default boolean`, `last_sync_at timestamptz`
* **baileys_sessions** (para **Baileys**)

  * `id uuid pk`, `org_id uuid`, `config_id uuid fk (channel_configs, provider='baileys')`
  * `session_name text`, `device_name text`, `status text` (`pending|qr|connected|error|logged_out`)
  * `qr_expires_at timestamptz`, `last_seen_at timestamptz`, `last_error text`
  * `secret_ref uuid` (chaves de sessão criptografadas no cofre)

### 14.5 Endpoints

**Genéricos (Org scope)**

* `GET  /api/channel-configs?type=whatsapp|instagram|facebook` → `{ items: ChannelConfig[] }`
* `POST /api/channel-configs` `{ type, provider, settings, secret }` → `{ config }` *(OrgAdmin: permitido apenas provider `meta_cloud` para WhatsApp; 403 se `baileys`)*
* `PUT  /api/channel-configs/:id` `{ settings?, secret? }` → `{ config }`
* `DELETE /api/channel-configs/:id` → `{ ok: true }`
* `POST /api/channel-configs/:id/test` → `{ ok: boolean, details }`
* `GET  /api/channel-configs/:id/health` → `{ status, last_tested_at, last_error }`

**WhatsApp – Meta Cloud (Org scope)**

* `GET  /api/channel-configs/:id/wa/numbers` → `{ items: WaNumber[] }`
* `POST /api/channel-configs/:id/wa/numbers` `{ phone_e164, display_name, is_default? }` → `{ number }`
* `DELETE /api/channel-configs/:id/wa/numbers/:numberId` → `{ ok: true }`
* `POST /api/channel-configs/:id/wa/numbers/:numberId/test` → `{ ok, details }`

**WhatsApp – Baileys (Admin scope)**

* `GET  /api/admin/orgs/:orgId/channel-configs?type=whatsapp&provider=baileys` → `{ items: ChannelConfig[] }`
* `POST /api/admin/orgs/:orgId/channel-configs/whatsapp/baileys` `{ session_name, device_name? }` → `{ config, session }`
* `POST /api/admin/baileys/:configId/session` → `{ session, status }` *(inicia nova sessão)*
* `GET  /api/admin/baileys/:configId/qr` → `{ svg, expires_at }` *(ou SSE/WebSocket de QR updates)*
* `GET  /api/admin/baileys/:configId/status` → `{ status, device_name?, last_seen_at?, last_error? }`
* `DELETE /api/admin/baileys/:configId/session` → `{ ok: true }` *(logout / revoga sessão)*

**Planos/Limites**

* `GET /api/subscription/limits` → `{ whatsapp_numbers_max, instagram_max:1, facebook_max:1 }`
* Back **enforce**: criar acima do limite → `409 { code:"PLAN_LIMIT_EXCEEDED" }`.

**Webhooks (Meta)**

* `POST /api/webhooks/meta` (verificação via `hub.verify_token`; assinatura HMAC; atualiza `webhook_set=true` quando válido)

### 14.6 Providers – Schemas de Formulário (expostos pelo back)

* `GET /api/channel-providers?type=whatsapp|instagram|facebook` →

```json
{
  "items": [
    {
      "type": "whatsapp",
      "provider": "meta_cloud",
      "form_schema": {
        "fields": [
          {"name":"app_id","label":"App ID","type":"text","required":true},
          {"name":"app_secret","label":"App Secret","type":"secret","required":true},
          {"name":"access_token","label":"Access Token","type":"secret","required":true},
          {"name":"verify_token","label":"Verify Token","type":"generated","readOnly":true},
          {"name":"waba_id","label":"WABA ID","type":"text","required":true}
        ]
      },
      "help":"Crie o app no Meta Developers, obtenha App ID/Secret/Access Token, configure webhook e assine eventos."
    },
    {
      "type": "whatsapp",
      "provider": "baileys",
      "form_schema": {
        "fields": [
          {"name":"session_name","label":"Nome da Sessão","type":"text","required":true},
          {"name":"device_name","label":"Nome do Dispositivo","type":"text","required":false}
        ],
        "admin_only": true
      },
      "help":"Baileys (QR) só pode ser criado pelo SuperAdmin no perfil do cliente (Org). O OrgAdmin não tem permissão de criação."
    }
  ]
}
```

### 14.7 Fluxos específicos

**Meta Cloud (OrgAdmin):** wizard completo; adiciona `wa_numbers`; testa com envio/recebimento; exibe `webhook_set`.

**Baileys (SuperAdmin):** painel Admin ▸ Clientes ▸ [Org] ▸ Canais ▸ WhatsApp (Baileys)

1. Criar config Baileys → gerar sessão.
2. Mostrar **QR** (SSE/WebSocket `wa:qr_update` atualiza QR a cada expiração).
3. Ao conectar, `status='connected'` e publicar `provider:health`.
4. OrgAdmin visualiza status (somente leitura); ações de logout/renovar sessão ficam restritas ao SuperAdmin.

**Contagem de quota**: cada `wa_number` (Meta) e cada sessão efetiva de Baileys contam 1 unidade contra `whatsapp_numbers_max` do plano.

### 14.8 Sockets

* `provider:health` → `{ orgId, type, provider, configId, status, last_error? }`
* `wa:qr_update` → `{ configId, svg, expires_at }`

### 14.9 Regras especiais

* **Grupos**: mensagens inbound detectadas como grupo marcam `is_group=true` na conversa; o motor de IA **não** é acionado; UI desabilita edição/criação de cliente.
* **Transcrição de áudio**: permanece igual ao Inbox — `message:updated` adiciona `transcript_text` quando pronto.

### 14.10 Testes

**Unit (back)**

* RBAC: OrgAdmin 403 ao tentar `POST /api/channel-configs` com `provider=baileys`.
* Plan limits: criar acima do limite → 409.
* Secrets: nunca retornar segredo em claro após salvo.

**Integration (back)**

* Meta: `test` verifica token/permissions e reachability do webhook.
* Baileys: ciclo `create → qr → connected → status` via endpoints admin.

**E2E (front)**

* Wizard Meta: preencher credenciais falsas → erro; credenciais válidas → conectado; teste ponta a ponta renderiza OK.
* Admin Baileys: gerar QR via socket; simular conexão; OrgAdmin vê status somente leitura.
* Plan badge reflete contagem correta (Meta + Baileys).

### 14.11 Checklist para o Codex (Configurações ▸ Canais)

* Implementar **tabs** e **wizard dinâmico** (render por `form_schema`).
* Exibir **limites por plano** e bloquear criação no front ao atingir limite (sem confiar apenas no front).
* Implementar **test** de configuração (Meta e Baileys admin) e **painel de saúde**.
* Respeitar **RBAC**: OrgAdmin não cria Baileys; SuperAdmin cria pela rota Admin.
* Integrar **sockets** para `provider:health` e `wa:qr_update`.
* Persistir segredos no **cofre**; nunca exibir em claro após salvo; oferecer **rotação** com audit log.
* Incluir **tests** unit/integration/E2E conforme 14.10.
* Não usar `fetch` nem axios fora de `src/api/inboxApi.js`; não prefixar rotas com `/api` (o `baseURL` já inclui).

