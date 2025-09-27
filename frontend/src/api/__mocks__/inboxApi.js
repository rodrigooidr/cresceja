// frontend/src/api/__mocks__/inboxApi.js
// Mock manual (Jest) para o módulo inboxApi, com shape tipo axios.
// Cobre endpoints usados nos testes de Settings/AI, Telemetry e Inbox.

let __delayMs = 0;
export const apiUrl = "http://mock.local";
export const setOrgIdHeaderProvider = (typeof jest !== "undefined" ? jest.fn(() => {}) : () => {});
export const setTokenProvider = (typeof jest !== "undefined" ? jest.fn(() => {}) : () => {});

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
  adminOrgs: [
    {
      id: "org-1",
      name: "Org Demo 1",
      slug: "org-demo-1",
      status: "active",
      plan_id: "starter",
      plan_name: "Starter",
      trial_ends_at: "2024-12-31",
    },
    {
      id: "org-2",
      name: "Org Demo 2",
      slug: "org-demo-2",
      status: "inactive",
      plan_id: "pro",
      plan_name: "Pro",
      trial_ends_at: null,
    },
  ],
  planSummaryByOrg: {
    "org-1": {
      org: {
        id: "org-1",
        name: "Org Demo 1",
        slug: "org-demo-1",
        plan_id: "starter",
        status: "active",
        trial_ends_at: "2024-12-31",
      },
      credits: [
        { feature_code: "whatsapp", remaining_total: 1000, expires_next: "2025-01-31" },
      ],
    },
  },
  adminPlans: [
    { id: "starter", name: "Starter", period: "monthly", price_cents: 0 },
    { id: "pro", name: "Pro", period: "monthly", price_cents: 9900 },
  ],
  planFeaturesByPlan: {
    starter: [
      { code: "posts", label: "Posts", type: "number", value: { enabled: true, limit: 50 } },
      {
        code: "whatsapp_numbers",
        label: "Números WhatsApp",
        type: "number",
        value: { enabled: true, limit: 1 },
      },
      {
        code: "whatsapp_mode_baileys",
        label: "Baileys",
        type: "boolean",
        value: { enabled: false },
      },
    ],
    pro: [
      { code: "posts", label: "Posts", type: "number", value: { enabled: true, limit: 500 } },
      {
        code: "whatsapp_numbers",
        label: "Números WhatsApp",
        type: "number",
        value: { enabled: true, limit: 5 },
      },
      {
        code: "whatsapp_mode_baileys",
        label: "Baileys",
        type: "boolean",
        value: { enabled: true },
      },
    ],
  },
  publicPlans: {
    items: [
      { id: "free", name: "Grátis", price_cents: 0, trial_days: 7, features: ["1 usuário", "100 mensagens/mês"] },
      { id: "pro",  name: "Pro",    price_cents: 9900, trial_days: 14, features: ["5 usuários", "5.000 mensagens/mês", "IA avançada"] }
    ]
  },
  remindersCooldown: new Map(), // key: eventId -> timestamp último envio
  routes: []
};

// ---- Helpers ----
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const res = (data, status = 200, headers = { "x-mock": "inboxApi" }) => ({ data, status, headers });

function registerRouteEntry(entry) {
  state.routes.push(entry);
}

function normalizeRouteArgs(a, b, c) {
  let method = '*';
  let matcher;
  let handler;

  if (typeof a === 'string' && (b instanceof RegExp || typeof b === 'string') && c !== undefined) {
    method = a.toLowerCase();
    matcher = b;
    handler = c;
  } else {
    handler = b;
    matcher = a;
    if (typeof a === 'string' && /\s/.test(a)) {
      const [m, ...rest] = a.split(/\s+/);
      method = String(m || '*').toLowerCase();
      matcher = rest.join(' ');
    } else {
      method = '*';
    }
  }

  return { method, matcher, handler };
}

function findRoute(method, url) {
  const m = String(method || '*').toLowerCase();
  for (const route of state.routes) {
    if (!(route.method === m || route.method === '*')) continue;
    const { matcher } = route;
    if (matcher instanceof RegExp && matcher.test(url)) return route;
    if (typeof matcher === 'string' && matcher === url) return route;
  }
  return null;
}

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
  let searchParams;
  try {
    searchParams = new URL(path, apiUrl).searchParams;
  } catch {
    searchParams = new URLSearchParams();
  }

  {
    const route = findRoute('get', url);
    if (route) {
      const handler = route.handler;
      const out = typeof handler === 'function'
        ? await handler({ url, method: 'GET', config })
        : handler;
      return res(out?.data ?? out);
    }
  }

  if (url === "/admin/orgs") {
    const status =
      config?.params?.status || searchParams.get('status') || "active";
    const q = String(
      config?.params?.q || config?.params?.search || searchParams.get('q') || ''
    ).toLowerCase();
    const rows = state.adminOrgs.filter((org) => {
      const matchesStatus = status === "all" || org.status === status;
      if (!matchesStatus) return false;
      if (!q) return true;
      const target = `${org.name || ""} ${org.slug || ""} ${org.document_value || ""}`.toLowerCase();
      return target.includes(q);
    });
    return res({ data: rows, count: rows.length });
  }

  if (url === "/admin/plans") {
    const rows = state.adminPlans.map((plan) => ({ ...plan }));
    return res({ data: rows, count: rows.length });
  }

  {
    const m = match(/^\/admin\/plans\/([^/]+)\/features$/, url);
    if (m) {
      const planId = m[0];
      const features = state.planFeaturesByPlan[planId];
      if (features) {
        const cloned = features.map((f) => {
          const value = f?.value;
          if (Array.isArray(value)) {
            return { ...f, value: value.map((item) => (item && typeof item === 'object' ? { ...item } : item)) };
          }
          if (value && typeof value === 'object') {
            return { ...f, value: { ...value } };
          }
          return { ...f };
        });
        return res({ data: cloned });
      }
      return res({ data: [] });
    }
  }

  {
    const m = match(/^\/orgs\/([^/]+)\/plan\/summary$/, url);
    if (m) {
      const orgId = m[0];
      const summary = state.planSummaryByOrg[orgId];
      if (summary) return res(summary);
      const fallbackOrg = state.adminOrgs.find((org) => org.id === orgId);
      return res({
        org: fallbackOrg || {
          id: orgId,
          name: `Org ${orgId}`,
          slug: orgId,
          plan_id: null,
          status: "active",
          trial_ends_at: null,
        },
        credits: [],
      });
    }
  }

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

  if (url === "/admin/plans") {
    const now = Date.now();
    const name = body?.name || `Plano ${state.adminPlans.length + 1}`;
    const id = body?.id || body?.slug || `plan-${now}`;
    const plan = {
      id,
      name,
      period: body?.period || "monthly",
      price_cents: body?.price_cents ?? 0,
    };
    state.adminPlans.push(plan);
    if (!state.planFeaturesByPlan[id]) {
      state.planFeaturesByPlan[id] = [
        { code: "posts", label: "Posts", type: "number", value: { enabled: true, limit: 50 } },
        {
          code: "whatsapp_numbers",
          label: "Números WhatsApp",
          type: "number",
          value: { enabled: true, limit: 1 },
        },
        {
          code: "whatsapp_mode_baileys",
          label: "Baileys",
          type: "boolean",
          value: { enabled: false },
        },
      ];
    }
    return res(plan, 201);
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

async function _patch(path, body = {}, config = {}) {
  if (__delayMs) await sleep(__delayMs);
  const url = parse(path);

  {
    const route = findRoute('patch', url);
    if (route) {
      const handler = route.handler;
      const out = typeof handler === 'function'
        ? await handler({ url, method: 'PATCH', body, config })
        : handler;
      return res(out?.data ?? out);
    }
  }

  {
    const m = match(/^\/admin\/orgs\/([^/]+)$/, url);
    if (m) {
      const orgId = m[0];
      const idx = state.adminOrgs.findIndex((org) => org.id === orgId);
      const current = idx >= 0 ? state.adminOrgs[idx] : { id: orgId };
      const updated = { ...current, ...(body || {}) };
      if (idx >= 0) state.adminOrgs[idx] = updated; else state.adminOrgs.push(updated);
      const summary = state.planSummaryByOrg[orgId];
      if (summary) {
        summary.org = { ...(summary.org || {}), ...updated };
      } else {
        state.planSummaryByOrg[orgId] = { org: { ...updated }, credits: [] };
      }
      return res({ ok: true, org: updated });
    }
  }

  {
    const m = match(/^\/admin\/orgs\/([^/]+)\/credits$/, url);
    if (m) {
      const orgId = m[0];
      const summary = state.planSummaryByOrg[orgId] || (state.planSummaryByOrg[orgId] = { org: { id: orgId }, credits: [] });
      const nextCredit = {
        feature_code: body?.feature_code || "",
        remaining_total: body?.delta ?? 0,
        expires_next: body?.expires_at || null,
      };
      if (!Array.isArray(summary.credits)) summary.credits = [];
      summary.credits.push(nextCredit);
      return res({ ok: true });
    }
  }

  return res({ error: "NOT_FOUND", path: url }, 404);
}

async function _put(path, body = {}, config = {}) {
  if (__delayMs) await sleep(__delayMs);
  const url = parse(path);

  {
    const route = findRoute('put', url);
    if (route) {
      const handler = route.handler;
      const out = typeof handler === 'function'
        ? await handler({ url, method: 'PUT', body, config })
        : handler;
      return res(out?.data ?? out);
    }
  }

  {
    const m = match(/^\/admin\/plans\/([^/]+)$/, url);
    if (m) {
      const planId = m[0];
      const idx = state.adminPlans.findIndex((plan) => plan.id === planId);
      const current = idx >= 0 ? state.adminPlans[idx] : { id: planId };
      const updated = {
        ...current,
        ...(body || {}),
        id: planId,
      };
      if (idx >= 0) state.adminPlans[idx] = updated;
      else state.adminPlans.push(updated);
      return res(updated);
    }
  }

  {
    const m = match(/^\/admin\/plans\/([^/]+)\/features$/, url);
    if (m) {
      const planId = m[0];
      const raw = Array.isArray(body?.features)
        ? body.features
        : Array.isArray(body)
        ? body
        : [];
      const normalized = raw.map((feature) => {
        const value = feature?.value;
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          return { ...feature, value: { ...value } };
        }
        return { ...feature };
      });
      state.planFeaturesByPlan[planId] = normalized;
      return res({ ok: true, data: normalized });
    }
  }

  {
    const m = match(/^\/admin\/orgs\/([^/]+)\/plan$/, url);
    if (m) {
      const orgId = m[0];
      const idx = state.adminOrgs.findIndex((org) => org.id === orgId);
      const current = idx >= 0 ? state.adminOrgs[idx] : { id: orgId };
      const planId = body?.plan_id ?? current.plan_id ?? null;
      const trial = body?.trial_ends_at ?? current.trial_ends_at ?? null;
      const nextStatus = body?.status ?? current.status ?? "active";
      const updated = { ...current, plan_id: planId, status: nextStatus, trial_ends_at: trial };
      if (idx >= 0) state.adminOrgs[idx] = updated; else state.adminOrgs.push(updated);

      const summary = state.planSummaryByOrg[orgId] || (state.planSummaryByOrg[orgId] = { org: { id: orgId }, credits: [] });
      summary.org = { ...(summary.org || {}), ...updated };

      return res({ ok: true, org: summary.org });
    }
  }

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
  patch: _patch,
  delete: _delete,

  // utilitários para testes
  __setDelay(ms) { __delayMs = ms || 0; },
  __seed(partial) {
    if (!partial || typeof partial !== "object") return;
    if (partial.profilesByOrg) state.profilesByOrg = { ...state.profilesByOrg, ...partial.profilesByOrg };
    if (partial.kbByOrg) state.kbByOrg = { ...state.kbByOrg, ...partial.kbByOrg };
    if (partial.telemetryFunnel) state.telemetryFunnel = { ...state.telemetryFunnel, ...partial.telemetryFunnel };
    if (partial.publicPlans) state.publicPlans = { ...state.publicPlans, ...partial.publicPlans };
    if (partial.adminOrgs) state.adminOrgs = Array.isArray(partial.adminOrgs) ? partial.adminOrgs.map((org) => ({ ...org })) : state.adminOrgs;
    if (partial.planSummaryByOrg) state.planSummaryByOrg = { ...state.planSummaryByOrg, ...partial.planSummaryByOrg };
    if (partial.adminPlans) state.adminPlans = Array.isArray(partial.adminPlans) ? partial.adminPlans.map((plan) => ({ ...plan })) : state.adminPlans;
    if (partial.planFeaturesByPlan) state.planFeaturesByPlan = { ...state.planFeaturesByPlan, ...partial.planFeaturesByPlan };
  },
  __mockRoute(...args) {
    const entry = normalizeRouteArgs(...args);
    registerRouteEntry(entry);
    return true;
  },
  __resetRoutes() {
    state.routes.length = 0;
  }
};

function callListAdminOrgs(status = "active", options = {}) {
  const cfg = { ...(options || {}) };
  cfg.params = { ...(cfg.params || {}), status };
  return inboxApi.get(`/admin/orgs`, cfg);
}

async function callAdminListOrgs(params = {}, options = {}) {
  const cfg = { ...(options || {}) };
  const normalized = { status: 'active', ...(params || {}) };
  const query = new URLSearchParams(normalized).toString();
  const response = await inboxApi.get(`/admin/orgs${query ? `?${query}` : ''}`, cfg);
  const payload = response?.data;
  const list = Array.isArray(payload?.data)
    ? payload.data
    : Array.isArray(payload?.items)
    ? payload.items
    : Array.isArray(payload)
    ? payload
    : [];
  return list.map((org) => ({ ...org }));
}

function callPatchAdminOrg(orgId, payload, options = {}) {
  return inboxApi.patch(`/admin/orgs/${orgId}`, payload, options);
}

function callPutAdminOrgPlan(orgId, payload, options = {}) {
  return inboxApi.put(`/admin/orgs/${orgId}/plan`, payload, options);
}

function callPatchAdminOrgCredits(orgId, payload, options = {}) {
  return inboxApi.patch(`/admin/orgs/${orgId}/credits`, payload, options);
}

function callGetPlanSummary(orgId, options = {}) {
  return inboxApi.get(`/orgs/${orgId}/plan/summary`, options);
}

function callListAdminPlans(options = {}) {
  return inboxApi.get(`/admin/plans`, options);
}

function callCreatePlan(payload, options = {}) {
  return inboxApi.post(`/admin/plans`, payload, options);
}

function callUpdatePlan(planId, payload, options = {}) {
  return inboxApi.put(`/admin/plans/${planId}`, payload, options);
}

function callGetPlanFeatures(planId, options = {}) {
  return inboxApi.get(`/admin/plans/${planId}/features`, options);
}

function callSetPlanFeatures(planId, features, options = {}) {
  return inboxApi.put(`/admin/plans/${planId}/features`, features, options);
}

export const listAdminOrgs =
  typeof jest !== "undefined"
    ? jest.fn(callListAdminOrgs)
    : callListAdminOrgs;

export const adminListOrgs =
  typeof jest !== "undefined"
    ? jest.fn(callAdminListOrgs)
    : callAdminListOrgs;

export const patchAdminOrg =
  typeof jest !== "undefined"
    ? jest.fn(callPatchAdminOrg)
    : callPatchAdminOrg;

export const putAdminOrgPlan =
  typeof jest !== "undefined"
    ? jest.fn(callPutAdminOrgPlan)
    : callPutAdminOrgPlan;

export const patchAdminOrgCredits =
  typeof jest !== "undefined"
    ? jest.fn(callPatchAdminOrgCredits)
    : callPatchAdminOrgCredits;

export const getPlanSummary =
  typeof jest !== "undefined"
    ? jest.fn(callGetPlanSummary)
    : callGetPlanSummary;

export const listAdminPlans =
  typeof jest !== "undefined"
    ? jest.fn(callListAdminPlans)
    : callListAdminPlans;

export const adminListPlans =
  typeof jest !== "undefined"
    ? jest.fn(async () => state.adminPlans.map((plan) => ({ ...plan })))
    : async () => state.adminPlans.map((plan) => ({ ...plan }));

export const createPlan =
  typeof jest !== "undefined"
    ? jest.fn(callCreatePlan)
    : callCreatePlan;

export const updatePlan =
  typeof jest !== "undefined"
    ? jest.fn(callUpdatePlan)
    : callUpdatePlan;

export const getPlanFeatures =
  typeof jest !== "undefined"
    ? jest.fn(callGetPlanFeatures)
    : callGetPlanFeatures;

export const adminGetPlanFeatures =
  typeof jest !== "undefined"
    ? jest.fn(async (planId) => {
        const list = state.planFeaturesByPlan[planId] || [];
        return list.map((feature) => ({
          ...feature,
          value:
            feature?.value && typeof feature.value === "object"
              ? Array.isArray(feature.value)
                ? feature.value.map((item) =>
                    item && typeof item === "object" ? { ...item } : item
                  )
                : { ...feature.value }
              : feature.value,
        }));
      })
    : async (planId) => {
        const list = state.planFeaturesByPlan[planId] || [];
        return list.map((feature) => ({
          ...feature,
          value:
            feature?.value && typeof feature.value === "object"
              ? Array.isArray(feature.value)
                ? feature.value.map((item) =>
                    item && typeof item === "object" ? { ...item } : item
                  )
                : { ...feature.value }
              : feature.value,
        }));
      };

export const setPlanFeatures =
  typeof jest !== "undefined"
    ? jest.fn(callSetPlanFeatures)
    : callSetPlanFeatures;

inboxApi.listAdminOrgs = listAdminOrgs;
inboxApi.adminListOrgs = adminListOrgs;
inboxApi.patchAdminOrg = patchAdminOrg;
inboxApi.putAdminOrgPlan = putAdminOrgPlan;
inboxApi.patchAdminOrgCredits = patchAdminOrgCredits;
inboxApi.getPlanSummary = getPlanSummary;
inboxApi.listAdminPlans = listAdminPlans;
inboxApi.adminListPlans = adminListPlans;
inboxApi.createPlan = createPlan;
inboxApi.updatePlan = updatePlan;
inboxApi.getPlanFeatures = getPlanFeatures;
inboxApi.adminGetPlanFeatures = adminGetPlanFeatures;
inboxApi.setPlanFeatures = setPlanFeatures;

export const client = inboxApi;
export default inboxApi;
