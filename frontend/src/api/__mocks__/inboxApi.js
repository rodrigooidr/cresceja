// frontend/src/api/__mocks__/inboxApi.js
// Mock manual (Jest) para o módulo inboxApi, com shape tipo axios.
// Cobre endpoints usados nos testes de Settings/AI, Telemetry e Inbox.

let __delayMs = 0;
export const apiUrl = "http://mock.local";

// ---- Estado em memória (pode ser sobrescrito via __seed) ----
const state = {
  profilesByOrg: {
    "org-1": {
      orgName: "Demo Org",
      vertical: "geral",
      languages: ["pt-BR"],
      brandVoice: { tone: "amigável", style: "objetivo e claro" },
      businessHours: { "mon-fri": "08:00-19:00", sat: "08:00-14:00", sun: null },
      tools: ["crm.lookup", "calendar.book", "orders.quote", "whatsapp.send"],
      rag: { index: "org:org-1:kb", topK: 5, filters: { lang: "pt-BR", active: true }, rerank: true },
      guardrails: {
        forbidPriceNegotiation: true,
        forbidChangePrices: true,
        forbidAIPromptsFromUser: true,
        forbidOffensiveLanguage: true,
        forbidPIIDisclosure: true,
        forbidMedicalLegalFinancialAdvice: true,
        forbidUnsupportedOrders: false,
        fallbackOnLowConfidence: "human_handoff",
        maxFreeformAnswerChars: 1200,
        blockedPhrases: ["ignore suas regras"]
      },
      policies: { refunds: "Não aceitamos trocas de itens personalizados.", slaReplyMin: 3 },
      fewShot: [
        { intent: "preço", input: "Quanto custa o sonho de creme?", output: "O sonho de creme sai por R$ 9,90. Posso separar para hoje?" }
      ]
    }
  },
  kbByOrg: {
    "org-1": [
      { id: "doc-1", title: "FAQ", snippet: "Perguntas frequentes", lang: "pt-BR", active: true, tags: ["faq"] }
    ]
  },
  telemetryFunnel: {
    steps: [
      { name: "Agendado", count: 20 },
      { name: "Compareceu", count: 15 },
      { name: "No-show", count: 5 }
    ]
  },
  publicPlans: {
    items: [
      { id: "free", name: "Grátis", price_cents: 0, trial_days: 7, features: ["1 usuário", "100 mensagens/mês"] },
      { id: "pro",  name: "Pro",    price_cents: 9900, trial_days: 14, features: ["5 usuários", "5.000 mensagens/mês", "IA avançada"] }
    ]
  },
  remindersCooldown: new Map() // key: eventId -> timestamp último envio
};

// ---- Helpers ----
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const res = (data, status = 200, headers = { "x-mock": "inboxApi" }) => ({ data, status, headers });

function parse(path) {
  // remove base se vier completo
  try {
    const u = new URL(path, apiUrl);
    return u.pathname;
  } catch {
    return path;
  }
}

function match(re, path) {
  const m = re.exec(path);
  if (!m) return null;
  return m.slice(1);
}

// ---- API Simulada ----
async function _get(path, config = {}) {
  if (__delayMs) await sleep(__delayMs);
  const url = parse(path);

  // GET /orgs/:id/ai-profile
  {
    const m = match(/^\/orgs\/([^/]+)\/ai-profile$/, url);
    if (m) {
      const orgId = m[0];
      const profile = state.profilesByOrg[orgId] || {
        orgName: "Org",
        vertical: "geral",
        languages: ["pt-BR"],
        brandVoice: { tone: "amigável", style: "objetivo e claro" },
        businessHours: {},
        tools: [],
        rag: { index: `org:${orgId}:kb`, topK: 5, filters: { lang: "pt-BR", active: true }, rerank: true },
        guardrails: { forbidPriceNegotiation: true, forbidChangePrices: true, forbidAIPromptsFromUser: true },
        policies: {},
        fewShot: []
      };
      return res(profile);
    }
  }

  // GET /telemetry/appointments/funnel
  if (url === "/telemetry/appointments/funnel") {
    return res(state.telemetryFunnel);
  }

  // GET /public/plans
  if (url === "/public/plans") {
    return res(state.publicPlans);
  }

  // Qualquer outro GET não mapeado
  return res({ error: "NOT_FOUND", path: url }, 404);
}

async function _post(path, body = {}, config = {}) {
  if (__delayMs) await sleep(__delayMs);
  const url = parse(path);

  // POST /orgs/:id/kb/ingest
  {
    const m = match(/^\/orgs\/([^/]+)\/kb\/ingest$/, url);
    if (m) {
      const orgId = m[0];
      const list = state.kbByOrg[orgId] || (state.kbByOrg[orgId] = []);
      const id = `doc-${Date.now()}`;
      list.push({
        id,
        title: body?.title || body?.uri || "Documento",
        snippet: body?.snippet || "",
        lang: body?.lang || "pt-BR",
        active: true,
        tags: body?.tags || []
      });
      return res({ ok: true, id, count: list.length });
    }
  }

  // POST /orgs/:id/kb/reindex
  {
    const m = match(/^\/orgs\/([^/]+)\/kb\/reindex$/, url);
    if (m) {
      return res({ ok: true, indexed: (state.kbByOrg[m[0]] || []).length });
    }
  }

  // POST /orgs/:id/ai/test
  {
    const m = match(/^\/orgs\/([^/]+)\/ai\/test$/, url);
    if (m) {
      const orgId = m[0];
      const message = (body && body.message) || "";
      // Regras simples de violação para o sandbox
      let violation = null;
      if (/desconto|melhorar o preço|muda(?:r)? o preço/i.test(message)) violation = "price_negotiation";
      if (/ignore suas regras|jailbreak|roleplay/i.test(message)) violation = "ai_prompt_injection";
      if (/cpf|telefone|endereço|email/i.test(message) && /pass|divulgar|informar|revelar/i.test(message)) violation = "pii_disclosure";

      if (violation) {
        return res({
          reply: "Para manter segurança e conformidade: não posso atender a essa solicitação. Posso te encaminhar para um atendente.",
          debug: { violation, orgId, usedDraft: !!body?.useDraft, tools: [], tokens: 42, context: [] }
        });
      }

      // Resposta padrão de eco com stub de contexto/tools
      return res({
        reply: `Entendido: "${message}". Posso ajudar em algo mais?`,
        debug: {
          violation: null,
          orgId,
          usedDraft: !!body?.useDraft,
          tools: ["crm.lookup"],
          tokens: 128,
          context: (state.kbByOrg[orgId] || []).slice(0, 2)
        }
      });
    }
  }

  // POST /calendar/events/:id/remind
  {
    const m = match(/^\/calendar\/events\/([^/]+)\/remind$/, url);
    if (m) {
      const eventId = m[0];
      const last = state.remindersCooldown.get(eventId) || 0;
      const now = Date.now();
      const withinCooldown = now - last < 10 * 60 * 1000; // 10 minutos
      if (withinCooldown) {
        return res({ idempotent: true, message: "Dentro da janela de dedup." }, 200);
      }
      state.remindersCooldown.set(eventId, now);
      return res({ idempotent: false, messageId: `whatsapp:${eventId}:${now}` }, 200);
    }
  }

  // Qualquer outro POST não mapeado
  return res({ error: "NOT_FOUND", path: url }, 404);
}

async function _put(path, body = {}, config = {}) {
  if (__delayMs) await sleep(__delayMs);
  const url = parse(path);

  // PUT /orgs/:id/ai-profile
  {
    const m = match(/^\/orgs\/([^/]+)\/ai-profile$/, url);
    if (m) {
      const orgId = m[0];
      const next = { ...(state.profilesByOrg[orgId] || {}), ...(body || {}) };
      state.profilesByOrg[orgId] = next;
      return res(next);
    }
  }

  return res({ error: "NOT_FOUND", path: url }, 404);
}

async function _delete(path, config = {}) {
  if (__delayMs) await sleep(__delayMs);
  const url = parse(path);
  // Sem endpoints DELETE por enquanto
  return res({ error: "NOT_FOUND", path: url }, 404);
}

// ---- API pública do mock ----
const inboxApi = {
  get: _get,
  post: _post,
  put: _put,
  delete: _delete,

  // utilitários para testes
  __setDelay(ms) { __delayMs = ms || 0; },
  __seed(partial) {
    if (!partial || typeof partial !== "object") return;
    if (partial.profilesByOrg) state.profilesByOrg = { ...state.profilesByOrg, ...partial.profilesByOrg };
    if (partial.kbByOrg) state.kbByOrg = { ...state.kbByOrg, ...partial.kbByOrg };
    if (partial.telemetryFunnel) state.telemetryFunnel = { ...state.telemetryFunnel, ...partial.telemetryFunnel };
    if (partial.publicPlans) state.publicPlans = { ...state.publicPlans, ...partial.publicPlans };
  }
};

export default inboxApi;
