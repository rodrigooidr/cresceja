// frontend/src/api/__mocks__/inboxApi.js
// Mock manual (Jest) para o módulo inboxApi, com shape tipo axios.
// Cobre endpoints usados nos testes de Settings/AI, Telemetry e Inbox.

let __delayMs = 0;
export const API_BASE_URL = "/api";
export const apiUrl = "http://mock.local";
export const setOrgIdHeaderProvider = (typeof jest !== "undefined" ? jest.fn(() => {}) : () => {});
export const setTokenProvider = (typeof jest !== "undefined" ? jest.fn(() => {}) : () => {});

export function joinApi(path) {
  let p = String(path || "");
  if (/^https?:\/\//i.test(p)) return p;
  if (!p.startsWith("/")) p = `/${p}`;
  if (API_BASE_URL.endsWith("/api") && p.startsWith("/api/")) {
    p = p.slice(4);
  }
  return `${API_BASE_URL}${p}`;
}

export function parseBRLToCents(input) {
  if (typeof input === "number") {
    return Number.isFinite(input) ? Math.round(input * 100) : NaN;
  }
  if (typeof input !== "string") return NaN;
  const norm = input
    .replace(/\s/g, "")
    .replace(/^R\$/i, "")
    .replace(/\./g, "")
    .replace(",", ".");
  if (!norm) return 0;
  const num = Number(norm);
  return Number.isFinite(num) ? Math.round(num * 100) : NaN;
}

export function centsToBRL(cents = 0, currency = "BRL") {
  const value = Number.isFinite(cents) ? cents / 100 : 0;
  try {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(value);
  } catch {
    return `R$ ${value.toFixed(2).replace(".", ",")}`;
  }
}

export const __mockPlans = [
  {
    id: "p_free",
    id_legacy_text: "free",
    name: "Free",
    price_cents: 0,
    monthly_price: 0,
    currency: "BRL",
    modules: {},
    is_active: true,
    is_published: true,
    billing_period_months: 1,
    trial_days: 14,
    sort_order: 10,
  },
  {
    id: "starter",
    id_legacy_text: "starter",
    name: "Starter",
    price_cents: 7900,
    monthly_price: 79,
    currency: "BRL",
    modules: {},
    is_active: true,
    is_published: true,
    billing_period_months: 1,
    trial_days: 14,
    sort_order: 20,
  },
  {
    id: "pro",
    id_legacy_text: "pro",
    name: "Pro",
    price_cents: 19900,
    monthly_price: 199,
    currency: "BRL",
    modules: {},
    is_active: true,
    is_published: true,
    billing_period_months: 1,
    trial_days: 14,
    sort_order: 30,
  },
];

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
      org_id: "org-1",
      plan_id: "starter",
      trial_ends_at: "2024-12-31",
      credits: [
        { feature_code: "whatsapp", remaining_total: 1000, expires_next: "2025-01-31" },
      ],
    },
  },
  planCreditsByPlan: {
    starter: { ai_tokens: "150000" },
    pro: { ai_tokens: "300000" },
  },
  adminPlans: __mockPlans.map((plan) => ({ ...plan })),
  featureDefs: [
    { code: "posts", label: "Posts", type: "number", category: "content", sort_order: 10 },
    { code: "support", label: "Suporte", type: "string", category: "support", sort_order: 20 },
    { code: "whatsapp_numbers", label: "Números WhatsApp", type: "number", category: "channels", sort_order: 30 },
    { code: "whatsapp_mode_baileys", label: "Baileys", type: "boolean", category: "channels", sort_order: 31 },
    {
      code: "channel",
      label: "Canal",
      type: "enum",
      category: "general",
      sort_order: 40,
      enum_options: ["basic", "advanced"],
    },
    { code: "notes", label: "Notas", type: "string", category: "general", sort_order: 50 },
  ],
  planFeaturesByPlan: {
    p_free: [
      { code: "posts", label: "Posts", type: "number", value: 10 },
      { code: "support", label: "Suporte", type: "string", value: "Comunidade" },
    ],
    starter: [
      { code: "posts", label: "Posts", type: "number", value: 50 },
      { code: "whatsapp_numbers", label: "Números WhatsApp", type: "number", value: 1 },
      { code: "whatsapp_mode_baileys", label: "Baileys", type: "boolean", value: false },
      {
        code: "channel",
        label: "Canal",
        type: "enum",
        value: "basic",
        options: ["basic", "advanced"],
      },
      { code: "notes", label: "Notas", type: "string", value: "Padrão" },
    ],
    pro: [
      { code: "posts", label: "Posts", type: "number", value: 500 },
      { code: "whatsapp_numbers", label: "Números WhatsApp", type: "number", value: 5 },
      { code: "whatsapp_mode_baileys", label: "Baileys", type: "boolean", value: true },
      {
        code: "channel",
        label: "Canal",
        type: "enum",
        value: "advanced",
        options: ["basic", "advanced"],
      },
      { code: "notes", label: "Notas", type: "string", value: "Plano Pro" },
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

function normalizeFeatureForState(feature = {}) {
  const code = feature.feature_code ?? feature.code;
  if (!code) return null;
  let value;
  if (Object.prototype.hasOwnProperty.call(feature, "value")) value = feature.value;
  else if (Object.prototype.hasOwnProperty.call(feature, "value_bool")) value = feature.value_bool;
  else if (Object.prototype.hasOwnProperty.call(feature, "value_number")) value = feature.value_number;
  else if (Object.prototype.hasOwnProperty.call(feature, "value_text")) value = feature.value_text;
  else if (Object.prototype.hasOwnProperty.call(feature, "value_enum")) value = feature.value_enum;
  else value = null;

  return {
    code,
    label: feature.label ?? code,
    type: feature.type ?? feature.value_type ?? "string",
    value,
    options: Array.isArray(feature.options) ? [...feature.options] : undefined,
    ai_meter_code: feature.ai_meter_code ?? null,
    ai_monthly_quota: feature.ai_monthly_quota ?? null,
  };
}

function storePlanFeatures(planId, features = []) {
  const normalized = (Array.isArray(features) ? features : [])
    .map(normalizeFeatureForState)
    .filter(Boolean);
  state.planFeaturesByPlan[planId] = normalized;
  return normalized;
}

function buildPlanFeaturesResponse() {
  const list = [];
  for (const [planId, features] of Object.entries(state.planFeaturesByPlan)) {
    for (const feature of features) {
      list.push({
        plan_id: planId,
        feature_code: feature.code,
        value: { value: feature.value },
        ai_meter_code: feature.ai_meter_code ?? null,
        ai_monthly_quota: feature.ai_monthly_quota ?? null,
        value_type: feature.type ?? null,
      });
    }
  }
  return list;
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

  if (url === "/orgs") {
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
    return res({ items: rows, count: rows.length });
  }

  if (url === "/admin/plans") {
    const rows = state.adminPlans.map((plan) => ({ ...plan }));
    return res(rows);
  }

  {
    const m = match(/^\/admin\/plans\/([^/]+)\/credits$/, url);
    if (m) {
      const planId = m[0];
      const limit = state.planCreditsByPlan?.[planId]?.ai_tokens ?? "0";
      return res({ data: [{ meter: "ai_tokens", limit: String(limit) }] });
    }
  }

  {
    const m = match(/^\/admin\/plans\/([^/]+)\/features$/, url);
    if (m) {
      const planId = m[0];
      const features = state.planFeaturesByPlan[planId];
      if (features) {
        const cloned = features.map((f) => ({
          ...f,
          options: Array.isArray(f.options) ? [...f.options] : undefined,
        }));
        return res(cloned);
      }
      return res([]);
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
        org_id: fallbackOrg?.id || orgId,
        plan_id: fallbackOrg?.plan_id || null,
        trial_ends_at: fallbackOrg?.trial_ends_at || null,
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
        summary.org_id = updated.id ?? summary.org_id ?? orgId;
        if (Object.prototype.hasOwnProperty.call(updated, 'plan_id')) {
          summary.plan_id = updated.plan_id;
        }
        if (Object.prototype.hasOwnProperty.call(updated, 'trial_ends_at')) {
          summary.trial_ends_at = updated.trial_ends_at;
        }
      } else {
        state.planSummaryByOrg[orgId] = {
          org_id: updated.id ?? orgId,
          plan_id: updated.plan_id ?? null,
          trial_ends_at: updated.trial_ends_at ?? null,
          credits: [],
        };
      }
      return res({ ok: true, org: updated });
    }
  }

  {
    const m = match(/^\/admin\/orgs\/([^/]+)\/credits$/, url);
    if (m) {
      const orgId = m[0];
      const summary =
        state.planSummaryByOrg[orgId] ||
        (state.planSummaryByOrg[orgId] = {
          org_id: orgId,
          plan_id: null,
          trial_ends_at: null,
          credits: [],
        });
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
    const m = match(/^\/admin\/plans\/([^/]+)\/credits$/, url);
    if (m) {
      const planId = m[0];
      const payload = Array.isArray(body?.data) ? body.data[0] : null;
      const limit = payload && payload.meter === "ai_tokens" ? Number(payload.limit ?? 0) : null;
      if (limit === null || !Number.isFinite(limit) || limit < 0) {
        return res({ error: "validation_error" }, 400);
      }
      const normalized = String(Math.floor(limit));
      if (!state.planCreditsByPlan) state.planCreditsByPlan = {};
      state.planCreditsByPlan[planId] = { ai_tokens: normalized };
      return res({ data: [{ meter: "ai_tokens", limit: normalized }] });
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
      const normalized = raw.map((feature) => ({
        code: feature.code,
        label: feature.label ?? feature.code,
        type: feature.type,
        value: feature.value,
        options: Array.isArray(feature.options) ? [...feature.options] : undefined,
      }));
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

      const summary =
        state.planSummaryByOrg[orgId] ||
        (state.planSummaryByOrg[orgId] = {
          org_id: orgId,
          plan_id: null,
          trial_ends_at: null,
          credits: [],
        });
      summary.org_id = orgId;
      summary.plan_id = planId;
      summary.trial_ends_at = trial;
      if (!Array.isArray(summary.credits)) summary.credits = [];

      return res({
        ok: true,
        org: {
          id: orgId,
          plan_id: planId,
          trial_ends_at: trial,
          status: nextStatus,
        },
      });
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
    if (partial.planCreditsByPlan) state.planCreditsByPlan = { ...state.planCreditsByPlan, ...partial.planCreditsByPlan };
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
  return inboxApi.get(`/orgs`, cfg);
}

async function callAdminListOrgs(params = {}, options = {}) {
  const cfg = { ...(options || {}) };
  const normalized = { status: 'active', q: '', ...(params || {}) };
  cfg.params = { ...(cfg.params || {}), status: normalized.status };
  if (normalized.q) cfg.params.q = normalized.q;
  const response = await inboxApi.get(`/orgs`, cfg);
  const payload = response?.data;
  const list = Array.isArray(payload?.items)
    ? payload.items
    : Array.isArray(payload?.data)
    ? payload.data
    : Array.isArray(payload)
    ? payload
    : [];
  return list.map((org) => {
    const active = typeof org?.active === 'boolean' ? org.active : org?.status === 'active';
    const statusNormalized = (() => {
      if (org?.status != null) {
        const normalized = String(org.status).trim().toLowerCase();
        if (['active', 'trial', 'suspended', 'canceled'].includes(normalized)) {
          return normalized;
        }
        if (normalized === 'inactive' || normalized === 'inativa') {
          return 'suspended';
        }
      }
      if (typeof active === 'boolean') {
        return active ? 'active' : 'suspended';
      }
      return undefined;
    })();
    return { ...org, active, status: statusNormalized };
  });
}

function callPatchAdminOrg(orgId, payload, options = {}) {
  return inboxApi.patch(`/orgs/${orgId}`, payload, options);
}

function callPutAdminOrgPlan(orgId, payload, options = {}) {
  return inboxApi.put(`/admin/orgs/${orgId}/plan`, payload, options);
}

function callPatchAdminOrgCredits(orgId, payload, options = {}) {
  return inboxApi.patch(`/admin/orgs/${orgId}/credits`, payload, options);
}

function callGetOrgPlanSummary(orgId, options = {}) {
  return inboxApi.get(`/orgs/${orgId}/plan/summary`, options);
}

function callListAdminPlans(options = {}) {
  return inboxApi.get(`/admin/plans`, options);
}

function callAdminCreatePlan(payload, options = {}) {
  return inboxApi.post(`/admin/plans`, payload, options);
}

function callAdminUpdatePlan(planId, payload, options = {}) {
  return inboxApi.patch(`/admin/plans/${planId}`, payload, options);
}

function callAdminDuplicatePlan(planId, options = {}) {
  return inboxApi.post(`/admin/plans/${planId}/duplicate`, {}, options);
}

function callAdminDeletePlan(planId, options = {}) {
  return inboxApi.delete(`/admin/plans/${planId}`, options);
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

export const getOrgPlanSummary =
  typeof jest !== "undefined"
    ? jest.fn(callGetOrgPlanSummary)
    : callGetOrgPlanSummary;

export const listAdminPlans =
  typeof jest !== "undefined"
    ? jest.fn(callListAdminPlans)
    : callListAdminPlans;

export const adminListPlans =
  typeof jest !== "undefined"
    ? jest.fn(async () => ({
        plans: state.adminPlans.map((plan) => ({ ...plan })),
        feature_defs: Array.isArray(state.featureDefs)
          ? state.featureDefs.map((def) => ({ ...def }))
          : [],
        plan_features: buildPlanFeaturesResponse(),
      }))
    : async () => ({
        plans: state.adminPlans.map((plan) => ({ ...plan })),
        feature_defs: Array.isArray(state.featureDefs)
          ? state.featureDefs.map((def) => ({ ...def }))
          : [],
        plan_features: buildPlanFeaturesResponse(),
      });

export const adminCreatePlan =
  typeof jest !== "undefined"
    ? jest.fn(async (payload = {}) => {
        const now = new Date().toISOString();
        const plan = {
          id: payload.id ?? `plan_${Date.now()}`,
          id_legacy_text: null,
          name: payload.name ?? "Novo plano",
          price_cents: payload.price_cents ?? 0,
          currency: payload.currency ?? "BRL",
          is_active: payload.is_active ?? true,
          monthly_price: payload.monthly_price ?? null,
          modules: payload.modules ?? {},
          is_published: payload.is_published ?? false,
          billing_period_months: payload.billing_period_months ?? 1,
          trial_days: payload.trial_days ?? 0,
          sort_order: payload.sort_order ?? null,
          created_at: now,
          updated_at: now,
        };
        state.adminPlans.push(plan);
        if (Array.isArray(payload.features) && payload.features.length) {
          storePlanFeatures(plan.id, payload.features);
        } else {
          state.planFeaturesByPlan[plan.id] = [];
        }
        return { data: { plan } };
      })
    : callAdminCreatePlan;

export const adminUpdatePlan =
  typeof jest !== "undefined"
    ? jest.fn(async (planId, payload = {}) => {
        const plan = state.adminPlans.find((item) => item.id === planId);
        if (!plan) {
          const error = new Error("plan_not_found");
          error.response = { status: 404, data: { error: "plan_not_found" } };
          throw error;
        }
        if (payload.name !== undefined) plan.name = payload.name;
        if (payload.price_cents !== undefined) plan.price_cents = payload.price_cents;
        if (payload.currency !== undefined) plan.currency = payload.currency;
        if (payload.is_active !== undefined) plan.is_active = payload.is_active;
        plan.updated_at = new Date().toISOString();
        if (Array.isArray(payload.features)) {
          storePlanFeatures(planId, payload.features);
        }
        return { data: { plan } };
      })
    : callAdminUpdatePlan;

export const adminDuplicatePlan =
  typeof jest !== "undefined"
    ? jest.fn(async (planId) => {
        const source = state.adminPlans.find((item) => item.id === planId);
        if (!source) {
          const error = new Error("plan_not_found");
          error.response = { status: 404, data: { error: "plan_not_found" } };
          throw error;
        }
        const now = new Date().toISOString();
        const duplicated = {
          ...source,
          id: `plan_${Date.now()}`,
          name: `${source.name} (cópia)`,
          created_at: now,
          updated_at: now,
        };
        state.adminPlans.push(duplicated);
        const features = state.planFeaturesByPlan[planId] || [];
        storePlanFeatures(duplicated.id, features);
        return { data: { plan: duplicated } };
      })
    : callAdminDuplicatePlan;

export const adminDeletePlan =
  typeof jest !== "undefined"
    ? jest.fn(async (planId) => {
        const inUse = state.adminOrgs.some((org) => org.plan_id === planId);
        if (inUse) {
          const error = new Error("plan_in_use");
          error.response = { status: 409, data: { error: "plan_in_use" } };
          throw error;
        }
        const index = state.adminPlans.findIndex((item) => item.id === planId);
        if (index === -1) {
          const error = new Error("plan_not_found");
          error.response = { status: 404, data: { error: "plan_not_found" } };
          throw error;
        }
        state.adminPlans.splice(index, 1);
        delete state.planFeaturesByPlan[planId];
        return { data: { deleted: true } };
      })
    : callAdminDeletePlan;

export const createPlan = adminCreatePlan;
export const updatePlan = adminUpdatePlan;

export const adminGetPlanFeatures =
  typeof jest !== "undefined"
    ? jest.fn(async (planId) => {
        const list = state.planFeaturesByPlan[planId] || [];
        return list.map((feature) => ({
          ...feature,
          options: Array.isArray(feature.options) ? [...feature.options] : undefined,
        }));
      })
    : async (planId) => {
        const list = state.planFeaturesByPlan[planId] || [];
        return list.map((feature) => ({
          ...feature,
          options: Array.isArray(feature.options) ? [...feature.options] : undefined,
        }));
      };

export const adminGetPlanCredits =
  typeof jest !== "undefined"
    ? jest.fn(async (planId) => {
        if (!planId) return [];
        const features = state.planFeaturesByPlan[planId] || [];
        return features
          .filter((feature) => (feature.type || "").toLowerCase() === "number")
          .map((feature) => ({
            meter: feature.code,
            limit: Number.isFinite(Number(feature.value)) ? Number(feature.value) : 0,
          }));
      })
    : async (planId) => {
        if (!planId) return [];
        const features = state.planFeaturesByPlan[planId] || [];
        return features
          .filter((feature) => (feature.type || "").toLowerCase() === "number")
          .map((feature) => ({
            meter: feature.code,
            limit: Number.isFinite(Number(feature.value)) ? Number(feature.value) : 0,
          }));
      };

export async function adminGetPlanCreditsSummary(planId) {
  const credits = await adminGetPlanCredits(planId);
  return { plan_id: planId, credits };
}

export const adminPutPlanFeatures =
  typeof jest !== "undefined"
    ? jest.fn(async (planId, features = []) => {
        const normalized = (Array.isArray(features) ? features : []).map((feature) => ({
          code: feature.code,
          label: feature.label ?? feature.code,
          type: feature.type,
          value: feature.value,
          options: Array.isArray(feature.options) ? [...feature.options] : undefined,
        }));
        state.planFeaturesByPlan[planId] = normalized;
        return { ok: true, data: normalized };
      })
    : async (planId, features = []) => {
        const normalized = (Array.isArray(features) ? features : []).map((feature) => ({
          code: feature.code,
          label: feature.label ?? feature.code,
          type: feature.type,
          value: feature.value,
          options: Array.isArray(feature.options) ? [...feature.options] : undefined,
        }));
        state.planFeaturesByPlan[planId] = normalized;
        return { ok: true, data: normalized };
      };

inboxApi.listAdminOrgs = listAdminOrgs;
inboxApi.adminListOrgs = adminListOrgs;
inboxApi.patchAdminOrg = patchAdminOrg;
inboxApi.putAdminOrgPlan = putAdminOrgPlan;
inboxApi.patchAdminOrgCredits = patchAdminOrgCredits;
inboxApi.getOrgPlanSummary = getOrgPlanSummary;
inboxApi.listAdminPlans = listAdminPlans;
inboxApi.adminListPlans = adminListPlans;
inboxApi.adminCreatePlan = adminCreatePlan;
inboxApi.adminUpdatePlan = adminUpdatePlan;
inboxApi.adminDuplicatePlan = adminDuplicatePlan;
inboxApi.adminDeletePlan = adminDeletePlan;
inboxApi.createPlan = createPlan;
inboxApi.updatePlan = updatePlan;
inboxApi.adminGetPlanFeatures = adminGetPlanFeatures;
inboxApi.adminGetPlanCredits = adminGetPlanCredits;
inboxApi.adminGetPlanCreditsSummary = adminGetPlanCreditsSummary;
inboxApi.adminPutPlanFeatures = adminPutPlanFeatures;

export const client = inboxApi;
export default inboxApi;
