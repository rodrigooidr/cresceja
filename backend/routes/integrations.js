import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import {
  seal as defaultSeal,
  open as defaultOpen,
} from "../services/credStore.js";
import {
  HttpClientError,
  httpClient as defaultHttpClient,
} from "../utils/httpClient.js";
import createIntegrationAuditor from "../services/audit.js";
import { getOrgFeatures } from "../services/orgFeatures.js";
import { requireAnyRole, requireOrgFeature } from "../middlewares/auth.js";
import { attachOrgFromHeader } from "../middlewares/orgContext.js";
import { signQrToken, verifyQrToken } from "../services/qrToken.js";
import {
  startQrLoop,
  stopQrLoop,
  subscribe,
  getStatus as getSessionStatus,
  setConnected as markConnected,
} from "../services/baileys.session.js";

const PROVIDERS = [
  "whatsapp_cloud",
  "whatsapp_session",
  "meta_facebook",
  "meta_instagram",
  "google_calendar",
];

function nowIso() {
  return new Date().toISOString();
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

async function getIntegration(db, orgId, provider) {
  const { rows } = await db.query(
    `SELECT *
       FROM org_integrations
      WHERE org_id = $1
        AND provider = $2
      LIMIT 1`,
    [orgId, provider]
  );
  return rows[0] || null;
}

async function upsertIntegration(
  db,
  orgId,
  provider,
  { status, subscribed, creds, meta },
  sealFn
) {
  const sealedCreds =
    creds && typeof creds === "object" && "c" in creds && "v" in creds
      ? creds
      : sealFn(creds || {});
  const safeMeta = isPlainObject(meta) ? meta : {};
  const { rows } = await db.query(
    `INSERT INTO org_integrations (org_id, provider, status, subscribed, creds, meta)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb)
       ON CONFLICT (org_id, provider)
       DO UPDATE SET status = EXCLUDED.status,
                     subscribed = EXCLUDED.subscribed,
                     creds = EXCLUDED.creds,
                     meta = EXCLUDED.meta,
                     updated_at = now()
       RETURNING *`,
    [
      orgId,
      provider,
      status,
      subscribed,
      JSON.stringify(sealedCreds),
      JSON.stringify(safeMeta),
    ]
  );
  return rows[0] || null;
}

async function patchIntegration(db, orgId, provider, partial, sealFn) {
  const fields = [];
  const values = [orgId, provider];
  let index = 3;

  if (partial.status !== undefined) {
    fields.push(`status = $${index++}`);
    values.push(partial.status);
  }
  if (partial.subscribed !== undefined) {
    fields.push(`subscribed = $${index++}`);
    values.push(partial.subscribed);
  }
  if (partial.creds !== undefined) {
    const sealed =
      partial.creds &&
      typeof partial.creds === "object" &&
      "c" in partial.creds &&
      "v" in partial.creds
        ? partial.creds
        : sealFn(partial.creds || {});
    fields.push(`creds = $${index++}::jsonb`);
    values.push(JSON.stringify(sealed));
  }
  if (partial.meta !== undefined) {
    const safeMeta = isPlainObject(partial.meta) ? partial.meta : {};
    fields.push(`meta = $${index++}::jsonb`);
    values.push(JSON.stringify(safeMeta));
  }

  fields.push("updated_at = now()");

  const query = `
    UPDATE org_integrations
       SET ${fields.join(", ")}
     WHERE org_id = $1
       AND provider = $2
   RETURNING *`;

  const { rows } = await db.query(query, values);
  return rows[0] || null;
}

function sanitizeIntegration(provider, row) {
  if (!row) {
    return {
      provider,
      status: "disconnected",
      subscribed: false,
      meta: {},
      updated_at: null,
    };
  }
  const meta = isPlainObject(row.meta) ? row.meta : {};
  return {
    provider,
    status: row.status || "disconnected",
    subscribed: Boolean(row.subscribed),
    meta,
    updated_at: row.updated_at || null,
  };
}

function ensureProvider(provider) {
  if (!PROVIDERS.includes(provider)) {
    const err = new Error("unknown_provider");
    err.statusCode = 400;
    err.code = "unknown_provider";
    throw err;
  }
  return providerHandlers[provider];
}

async function ensureOrgContext(req, db) {
  const direct = req.orgId || req.user?.org_id;
  if (direct) return direct;
  if (!db) {
    const err = new Error("db_not_configured");
    err.statusCode = 500;
    err.code = "db_not_configured";
    throw err;
  }
  const { rows } = await db.query(
    `SELECT current_setting('app.org_id', true) AS org_id`
  );
  const orgId = rows[0]?.org_id || null;
  if (orgId) return orgId;
  const err = new Error("org_context_missing");
  err.statusCode = 400;
  err.code = "org_context_missing";
  throw err;
}

async function ensureWhatsAppSessionEnabled(req, res, orgId) {
  try {
    const cached = req.orgFeatures;
    const features =
      (cached && typeof cached === "object" ? cached : null) ||
      (await getOrgFeatures(req.db, orgId));
    req.orgFeatures = features;
    if (!features?.whatsapp_session_enabled) {
      res.status(403).json({
        error: "forbidden",
        reason: "feature_disabled",
        feature: "whatsapp_session_enabled",
      });
      return null;
    }
    return features;
  } catch (err) {
    res
      .status(500)
      .json({ error: "features_unavailable", message: err.message });
    return null;
  }
}

function getRateLimitKey(req, res) {
  const orgScopedKey =
    req.headers["x-org-id"] ||
    req.user?.org_id ||
    req.orgId ||
    req.headers["x-impersonate-org-id"];
  if (orgScopedKey) {
    return orgScopedKey;
  }
  if (typeof rateLimit.ipKeyGenerator === "function") {
    return rateLimit.ipKeyGenerator(req, res);
  }
  return req.ip || "anonymous";
}

function mapValidationError(err) {
  if (!(err instanceof z.ZodError)) return null;
  return { error: "validation_error", issues: err.flatten() };
}

function mapProviderFailure(err) {
  if (err instanceof HttpClientError) {
    const status = err.isTimeout ? 504 : 502;
    const message = err.message || "Falha ao comunicar com o provedor";
    return { status, body: { error: "provider_error", message } };
  }
  return null;
}

function stripSensitive(meta = {}) {
  if (!isPlainObject(meta)) return {};
  const clone = { ...meta };
  for (const key of Object.keys(clone)) {
    if (/token|secret|key/i.test(key)) delete clone[key];
  }
  return clone;
}

const providerHandlers = {
  whatsapp_cloud: {
    connectSchema: z
      .object({
        phone_number_id: z
          .string()
          .min(3, "Informe o phone_number_id")
          .optional(),
        display_phone_number: z.string().optional(),
        business_name: z.string().optional(),
        access_token: z.string().min(10, "Token inválido").optional(),
      })
      .default({}),
    testSchema: z
      .object({ to: z.string().min(5, "Informe o destinatário") })
      .default({}),
    supportsSubscribe: true,
    async connect({ payload, existing }) {
      const nextPhone =
        payload.phone_number_id ||
        existing?.meta?.phone_number_id ||
        existing?.creds?.phone_number_id;
      const nextToken = payload.access_token || existing?.creds?.access_token;
      if (!nextPhone || !nextToken) {
        const error = new Error("missing_credentials");
        error.statusCode = 400;
        throw error;
      }

      const meta = {
        ...(isPlainObject(existing?.meta) ? existing.meta : {}),
        phone_number_id: nextPhone,
        display_phone_number:
          payload.display_phone_number ??
          existing?.meta?.display_phone_number ??
          null,
        business_name:
          payload.business_name ?? existing?.meta?.business_name ?? null,
        connected_at: nowIso(),
      };

      return {
        status: "connected",
        subscribed: existing?.subscribed ?? false,
        creds: { phone_number_id: nextPhone, access_token: nextToken },
        meta,
        detail: { message: "WhatsApp Cloud conectado" },
      };
    },
    async subscribe({ existing, httpClient }) {
      if (!existing) {
        const error = new Error("integration_not_connected");
        error.statusCode = 400;
        throw error;
      }
      const token = existing.creds?.access_token;
      const phoneId =
        existing.meta?.phone_number_id || existing.creds?.phone_number_id;
      if (token && phoneId && httpClient) {
        const url = `https://graph.facebook.com/v18.0/${phoneId}/subscribed_apps`;
        await httpClient.post(
          url,
          { subscribed_fields: ["messages"] },
          { headers: { Authorization: `Bearer ${token}` } }
        );
      }
      const meta = {
        ...(isPlainObject(existing.meta) ? existing.meta : {}),
        last_subscribe_at: nowIso(),
      };
      return {
        subscribed: true,
        meta,
        detail: { message: "Webhook WhatsApp Cloud assinado" },
      };
    },
    async test({ payload, existing }) {
      if (!existing) {
        const error = new Error("integration_not_connected");
        error.statusCode = 400;
        throw error;
      }
      const meta = {
        ...(isPlainObject(existing.meta) ? existing.meta : {}),
        last_test_at: nowIso(),
        last_test_to: payload.to,
      };
      return {
        ok: true,
        meta,
        detail: { message: "Mensagem de teste enviada (mock)", to: payload.to },
      };
    },
  },
  whatsapp_session: {
    connectSchema: z
      .object({
        session_host: z.string().url("URL inválida").optional(),
      })
      .default({}),
    testSchema: z
      .object({ to: z.string().min(5, "Informe o destinatário") })
      .default({}),
    supportsSubscribe: false,
    async connect({ payload, existing }) {
      const meta = {
        ...(isPlainObject(existing?.meta) ? existing.meta : {}),
        session_host:
          payload.session_host || existing?.meta?.session_host || null,
        session_state: "pending_qr",
        requested_at: nowIso(),
      };
      return {
        status: "connecting",
        subscribed: false,
        creds: existing?.creds || {},
        meta,
        detail: { message: "Sessão WhatsApp iniciada (mock)" },
      };
    },
    async test({ payload, existing }) {
      if (!existing) {
        const error = new Error("integration_not_connected");
        error.statusCode = 400;
        throw error;
      }
      const meta = {
        ...(isPlainObject(existing.meta) ? existing.meta : {}),
        last_test_at: nowIso(),
        last_test_to: payload.to,
      };
      return {
        ok: true,
        meta,
        detail: { message: "Mensagem de teste enviada (mock)", to: payload.to },
      };
    },
  },
  meta_facebook: {
    connectSchema: z
      .object({
        user_access_token: z.string().min(8, "Token inválido"),
        page_id: z.string().min(3, "Informe o Page ID").optional(),
        page_name: z.string().optional(),
      })
      .default({}),
    testSchema: z.object({}).default({}),
    supportsSubscribe: true,
    async connect({ payload, existing }) {
      const meta = {
        ...(isPlainObject(existing?.meta) ? existing.meta : {}),
        page_id: payload.page_id ?? existing?.meta?.page_id ?? null,
        page_name: payload.page_name ?? existing?.meta?.page_name ?? null,
        connected_at: nowIso(),
      };
      return {
        status: "connected",
        subscribed: true,
        creds: { user_access_token: payload.user_access_token },
        meta,
        detail: { message: "Facebook conectado" },
      };
    },
    async subscribe({ existing, httpClient }) {
      if (!existing) {
        const error = new Error("integration_not_connected");
        error.statusCode = 400;
        throw error;
      }
      const token = existing.creds?.user_access_token;
      const pageId = existing.meta?.page_id;
      if (token && pageId && httpClient) {
        const url = `https://graph.facebook.com/v18.0/${pageId}/subscribed_apps`;
        await httpClient.post(
          url,
          { subscribed_fields: ["feed", "conversations"] },
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
      }
      const meta = {
        ...(isPlainObject(existing.meta) ? existing.meta : {}),
        last_subscribe_at: nowIso(),
      };
      return {
        subscribed: true,
        meta,
        detail: { message: "Webhook Facebook marcado como ativo" },
      };
    },
    async test({ existing }) {
      if (!existing) {
        const error = new Error("integration_not_connected");
        error.statusCode = 400;
        throw error;
      }
      const meta = {
        ...(isPlainObject(existing.meta) ? existing.meta : {}),
        last_test_at: nowIso(),
      };
      return {
        ok: true,
        meta,
        detail: { message: "Publicação de teste (mock)" },
      };
    },
  },
  meta_instagram: {
    connectSchema: z
      .object({
        user_access_token: z.string().min(8, "Token inválido"),
        instagram_business_id: z
          .string()
          .min(3, "Informe o Instagram Business ID")
          .optional(),
        page_id: z.string().optional(),
      })
      .default({}),
    testSchema: z.object({}).default({}),
    supportsSubscribe: true,
    async connect({ payload, existing }) {
      const meta = {
        ...(isPlainObject(existing?.meta) ? existing.meta : {}),
        instagram_business_id:
          payload.instagram_business_id ??
          existing?.meta?.instagram_business_id ??
          null,
        page_id: payload.page_id ?? existing?.meta?.page_id ?? null,
        connected_at: nowIso(),
      };
      return {
        status: "connected",
        subscribed: true,
        creds: { user_access_token: payload.user_access_token },
        meta,
        detail: { message: "Instagram conectado" },
      };
    },
    async subscribe({ existing, httpClient }) {
      if (!existing) {
        const error = new Error("integration_not_connected");
        error.statusCode = 400;
        throw error;
      }
      const token = existing.creds?.user_access_token;
      const igId = existing.meta?.instagram_business_id;
      if (token && igId && httpClient) {
        const url = `https://graph.facebook.com/v18.0/${igId}/subscribed_apps`;
        await httpClient.post(
          url,
          { subscribed_fields: ["comments", "mentions"] },
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
      }
      const meta = {
        ...(isPlainObject(existing.meta) ? existing.meta : {}),
        last_subscribe_at: nowIso(),
      };
      return {
        subscribed: true,
        meta,
        detail: { message: "Webhook Instagram marcado como ativo" },
      };
    },
    async test({ existing }) {
      if (!existing) {
        const error = new Error("integration_not_connected");
        error.statusCode = 400;
        throw error;
      }
      const meta = {
        ...(isPlainObject(existing.meta) ? existing.meta : {}),
        last_test_at: nowIso(),
      };
      return {
        ok: true,
        meta,
        detail: { message: "Teste de publicação Instagram (mock)" },
      };
    },
  },
  google_calendar: {
    connectSchema: z.object({
      calendarId: z.string().min(3, "Informe o Calendar ID"),
      clientEmail: z.string().email("Informe um e-mail válido"),
      privateKey: z.string().min(20, "Informe a chave privada"),
      timezone: z.string().min(2, "Informe o timezone"),
    }),
    testSchema: z.object({}).default({}),
    supportsSubscribe: false,
    async connect({ payload }) {
      const meta = {
        calendarId: payload.calendarId,
        clientEmail: payload.clientEmail,
        timezone: payload.timezone,
        connected_at: nowIso(),
      };
      return {
        status: "connected",
        subscribed: false,
        creds: {
          calendarId: payload.calendarId,
          clientEmail: payload.clientEmail,
          privateKey: payload.privateKey,
          timezone: payload.timezone,
        },
        meta,
        detail: { message: "Google Calendar conectado" },
      };
    },
    async test({ existing }) {
      if (!existing) {
        const error = new Error("integration_not_connected");
        error.statusCode = 400;
        throw error;
      }
      const meta = {
        ...(isPlainObject(existing.meta) ? existing.meta : {}),
        last_test_at: nowIso(),
      };
      return {
        ok: true,
        meta,
        detail: {
          message: "Evento teste Google Calendar criado/removido (mock)",
        },
      };
    },
  },
};

export function createIntegrationsRouter({
  db = null,
  seal = defaultSeal,
  open = defaultOpen,
  logger = console,
  httpClient = defaultHttpClient,
  rateLimitOptions = {},
} = {}) {
  const router = Router();
  const {
    handler: customRateHandler,
    keyGenerator: customKeyGenerator,
    ...restRateOptions
  } = rateLimitOptions || {};
  const limiter = rateLimit({
    windowMs: 60_000,
    limit: 30,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: customKeyGenerator ?? getRateLimitKey,
    handler:
      customRateHandler ??
      ((_req, res) =>
        res.status(429).json({
          error: "rate_limited",
          message:
            "Limite de requisições atingido. Tente novamente em instantes.",
        })),
    ...restRateOptions,
  });

  router.use((req, _res, next) => {
    if (!req.db && db) {
      req.db = db;
    }
    if (!req.log && logger) {
      req.log = logger;
    }
    next();
  });

  const requireWhatsAppSessionRole = requireAnyRole(["SuperAdmin", "OrgOwner"]);
  const requireWhatsAppSessionFeature = requireOrgFeature(
    "whatsapp_session_enabled"
  );

  const runMiddleware = (middleware, req, res, next) => {
    try {
      const maybe = middleware(req, res, next);
      if (maybe && typeof maybe.then === "function") {
        maybe.catch(next);
      }
      return maybe;
    } catch (err) {
      return next(err);
    }
  };

  const guardWhatsAppProvider = (middleware) => (req, res, next) => {
    if (req.params?.provider !== "whatsapp_session") return next();
    return attachOrgFromHeader(req, res, (err) => {
      if (err) return next(err);
      return runMiddleware(middleware, req, res, next);
    });
  };

  const ensureWhatsAppProviderRole = guardWhatsAppProvider(
    requireWhatsAppSessionRole
  );
  const ensureWhatsAppProviderFeature = guardWhatsAppProvider(
    requireWhatsAppSessionFeature
  );

  router.get("/status", async (req, res, next) => {
    try {
      if (!req.db?.query) throw new Error("db_not_configured");
      const orgId = await ensureOrgContext(req, req.db);
      const result = {};
      for (const provider of PROVIDERS) {
        const row = await getIntegration(req.db, orgId, provider);
        result[provider] = sanitizeIntegration(provider, row);
      }
      res.json({ providers: result });
    } catch (err) {
      next(err);
    }
  });

  router.get(
    "/providers/:provider",
    ensureWhatsAppProviderRole,
    async (req, res, next) => {
      const { provider } = req.params;
      try {
        ensureProvider(provider);
        if (!req.db?.query) throw new Error("db_not_configured");
        const orgId = await ensureOrgContext(req, req.db);
        if (provider === "whatsapp_session") {
          const allowed = await ensureWhatsAppSessionEnabled(req, res, orgId);
          if (!allowed) return;
        }
        const row = await getIntegration(req.db, orgId, provider);
        return res.json({ integration: sanitizeIntegration(provider, row) });
      } catch (err) {
        if (err.code === "unknown_provider") {
          return res
            .status(400)
            .json({ error: "unknown_provider", message: provider });
        }
        return next(err);
      }
    }
  );

  router.post(
    "/providers/:provider/connect",
    ensureWhatsAppProviderRole,
    ensureWhatsAppProviderFeature,
    limiter,
    async (req, res) => {
      const { provider } = req.params;
      let handler;
      try {
        handler = ensureProvider(provider);
      } catch (err) {
        return res
          .status(400)
          .json({ error: "unknown_provider", message: provider });
      }

      if (!req.db?.query) {
        return res
          .status(500)
          .json({ error: "db_not_configured", message: "db_not_configured" });
      }

      let orgId;
      try {
        orgId = await ensureOrgContext(req, req.db);
      } catch (err) {
        const status = err.statusCode || 500;
        return res
          .status(status)
          .json({
            error: err.code || "org_context_missing",
            message: err.message,
          });
      }

      const audit = createIntegrationAuditor({
        db: req.db,
        logger: req.log || logger,
      });

      try {
        if (provider === "whatsapp_session") {
          const allowed = await ensureWhatsAppSessionEnabled(req, res, orgId);
          if (!allowed) return;
        }
        const schema = handler.connectSchema || z.object({}).strip();
        const payload = schema.parse(req.body || {});
        const existingRow = await getIntegration(req.db, orgId, provider);
        const existing = existingRow
          ? { ...existingRow, creds: open(existingRow.creds) }
          : null;
        const result = await handler.connect({
          req,
          provider,
          payload,
          existing,
          httpClient,
        });

        const row = await upsertIntegration(
          req.db,
          orgId,
          provider,
          {
            status: result.status || existingRow?.status || "connected",
            subscribed:
              typeof result.subscribed === "boolean"
                ? result.subscribed
                : existingRow?.subscribed || false,
            creds: result.creds || existing?.creds || {},
            meta: result.meta || existing?.meta || {},
          },
          seal
        );

        await audit(
          orgId,
          provider,
          "connect",
          "success",
          stripSensitive(result.detail || {})
        );

        return res.json({
          ok: true,
          integration: sanitizeIntegration(provider, row),
        });
      } catch (err) {
        const validation = mapValidationError(err);
        if (validation) {
          await audit(orgId, provider, "connect", "error", {
            message: "validation_error",
            issues: validation.issues,
          });
          return res.status(400).json(validation);
        }
        const providerFailure = mapProviderFailure(err);
        if (providerFailure) {
          await audit(orgId, provider, "connect", "error", {
            message: providerFailure.body.message,
          });
          return res.status(providerFailure.status).json(providerFailure.body);
        }
        const status = err.statusCode || 500;
        await audit(orgId, provider, "connect", "error", {
          message: err.message,
        });
        return res
          .status(status)
          .json({ error: err.code || "connect_failed", message: err.message });
      }
    }
  );

  router.post(
    "/providers/:provider/subscribe",
    ensureWhatsAppProviderRole,
    limiter,
    async (req, res) => {
      const { provider } = req.params;
      let handler;
      try {
        handler = ensureProvider(provider);
      } catch (err) {
        return res
          .status(400)
          .json({ error: "unknown_provider", message: provider });
      }

      if (!handler.supportsSubscribe) {
        return res.status(400).json({
          error: "not_supported",
          message: "Subscribe indisponível para este provedor.",
        });
      }

      if (!req.db?.query) {
        return res
          .status(500)
          .json({ error: "db_not_configured", message: "db_not_configured" });
      }

      let orgId;
      try {
        orgId = await ensureOrgContext(req, req.db);
      } catch (err) {
        const status = err.statusCode || 500;
        return res
          .status(status)
          .json({
            error: err.code || "org_context_missing",
            message: err.message,
          });
      }

      const audit = createIntegrationAuditor({
        db: req.db,
        logger: req.log || logger,
      });

      try {
        if (provider === "whatsapp_session") {
          const allowed = await ensureWhatsAppSessionEnabled(req, res, orgId);
          if (!allowed) return;
        }
        const existingRow = await getIntegration(req.db, orgId, provider);
        if (!existingRow) {
          await audit(orgId, provider, "subscribe", "error", {
            message: "integration_not_connected",
          });
          return res
            .status(400)
            .json({ error: "integration_not_connected", message: provider });
        }
        const existing = { ...existingRow, creds: open(existingRow.creds) };
        const result = await handler.subscribe({
          req,
          provider,
          existing,
          httpClient,
        });
        const row = await upsertIntegration(
          req.db,
          orgId,
          provider,
          {
            status: existingRow.status,
            subscribed:
              typeof result.subscribed === "boolean" ? result.subscribed : true,
            creds: existingRow.creds,
            meta: result.meta || existing.meta || {},
          },
          seal
        );
        await audit(
          orgId,
          provider,
          "subscribe",
          "success",
          stripSensitive(result.detail || {})
        );
        return res.json({
          ok: true,
          integration: sanitizeIntegration(provider, row),
        });
      } catch (err) {
        const providerFailure = mapProviderFailure(err);
        if (providerFailure) {
          await audit(orgId, provider, "subscribe", "error", {
            message: providerFailure.body.message,
          });
          return res.status(providerFailure.status).json(providerFailure.body);
        }
        const status = err.statusCode || 500;
        await audit(orgId, provider, "subscribe", "error", {
          message: err.message,
        });
        return res
          .status(status)
          .json({ error: "subscribe_failed", message: err.message });
      }
    }
  );

  router.post(
    "/providers/:provider/test",
    ensureWhatsAppProviderRole,
    limiter,
    async (req, res) => {
      const { provider } = req.params;
      let handler;
      try {
        handler = ensureProvider(provider);
      } catch (err) {
        return res
          .status(400)
          .json({ error: "unknown_provider", message: provider });
      }

      if (!req.db?.query) {
        return res
          .status(500)
          .json({ error: "db_not_configured", message: "db_not_configured" });
      }

      let orgId;
      try {
        orgId = await ensureOrgContext(req, req.db);
      } catch (err) {
        const status = err.statusCode || 500;
        return res
          .status(status)
          .json({
            error: err.code || "org_context_missing",
            message: err.message,
          });
      }

      const audit = createIntegrationAuditor({
        db: req.db,
        logger: req.log || logger,
      });

      try {
        if (provider === "whatsapp_session") {
          const allowed = await ensureWhatsAppSessionEnabled(req, res, orgId);
          if (!allowed) return;
        }
        const schema = handler.testSchema || z.object({}).strip();
        const payload = schema.parse(req.body || {});
        const existingRow = await getIntegration(req.db, orgId, provider);
        if (!existingRow) {
          await audit(orgId, provider, "test", "error", {
            message: "integration_not_connected",
          });
          return res
            .status(400)
            .json({ error: "integration_not_connected", message: provider });
        }
        const existing = { ...existingRow, creds: open(existingRow.creds) };
        const result = await handler.test({
          req,
          provider,
          payload,
          existing,
          httpClient,
        });
        const row = await upsertIntegration(
          req.db,
          orgId,
          provider,
          {
            status: existingRow.status,
            subscribed: existingRow.subscribed,
            creds: existingRow.creds,
            meta: result.meta || existing.meta || {},
          },
          seal
        );
        await audit(
          orgId,
          provider,
          "test",
          "success",
          stripSensitive(result.detail || {})
        );
        return res.json({
          ok: true,
          detail: result.detail || {},
          integration: sanitizeIntegration(provider, row),
        });
      } catch (err) {
        const validation = mapValidationError(err);
        if (validation) {
          await audit(orgId, provider, "test", "error", {
            message: "validation_error",
            issues: validation.issues,
          });
          return res.status(400).json(validation);
        }
        const providerFailure = mapProviderFailure(err);
        if (providerFailure) {
          await audit(orgId, provider, "test", "error", {
            message: providerFailure.body.message,
          });
          return res.status(providerFailure.status).json(providerFailure.body);
        }
        const status = err.statusCode || 500;
        await audit(orgId, provider, "test", "error", { message: err.message });
        return res
          .status(status)
          .json({ error: "test_failed", message: err.message });
      }
    }
  );

  router.post(
    "/providers/:provider/disconnect",
    ensureWhatsAppProviderRole,
    limiter,
    async (req, res) => {
      const { provider } = req.params;
      try {
        ensureProvider(provider);
      } catch (err) {
        return res
          .status(400)
          .json({ error: "unknown_provider", message: provider });
      }

      if (!req.db?.query) {
        return res
          .status(500)
          .json({ error: "db_not_configured", message: "db_not_configured" });
      }

      let orgId;
      try {
        orgId = await ensureOrgContext(req, req.db);
      } catch (err) {
        const status = err.statusCode || 500;
        return res
          .status(status)
          .json({
            error: err.code || "org_context_missing",
            message: err.message,
          });
      }

      const audit = createIntegrationAuditor({
        db: req.db,
        logger: req.log || logger,
      });

      try {
        if (provider === "whatsapp_session") {
          const allowed = await ensureWhatsAppSessionEnabled(req, res, orgId);
          if (!allowed) return;
        }
        const existingRow = await getIntegration(req.db, orgId, provider);
        if (!existingRow) {
          return res.json({
            ok: true,
            integration: sanitizeIntegration(provider, null),
          });
        }
        const meta = {
          ...(isPlainObject(existingRow.meta) ? existingRow.meta : {}),
          disconnected_at: nowIso(),
        };
        const row = await patchIntegration(
          req.db,
          orgId,
          provider,
          {
            status: "disconnected",
            subscribed: false,
            creds: {},
            meta,
          },
          seal
        );
        await audit(orgId, provider, "disconnect", "success", {
          message: "Integração desconectada",
        });
        return res.json({
          ok: true,
          integration: sanitizeIntegration(provider, row),
        });
      } catch (err) {
        await audit(orgId, provider, "disconnect", "error", {
          message: err.message,
        });
        return res
          .status(500)
          .json({ error: "disconnect_failed", message: err.message });
      }
    }
  );

  const issueQrToken = async (req, res) => {
    const orgId = req.org?.id || req.orgId || req.headers["x-org-id"];
    const userId = req.user?.id || req.user?.sub || "unknown";
    if (!orgId) {
      return res
        .status(400)
        .json({ error: "invalid_org", message: "Org ausente" });
    }
    try {
      const secret = process.env.JWT_SECRET;
      const token = signQrToken({ userId, orgId, secret, ttl: 60 });
      return res.json({ token, expires_in: 60 });
    } catch (err) {
      req.log?.error?.({ err }, "whatsapp-session-qr-token-sign-failed");
      return res
        .status(500)
        .json({ error: "token_sign_failed", message: err.message });
    }
  };

  router.get(
    "/providers/whatsapp_session/qr/token",
    attachOrgFromHeader,
    requireWhatsAppSessionRole,
    issueQrToken
  );

  router.get(
    "/../../../test-whatsapp/qr/token",
    attachOrgFromHeader,
    requireWhatsAppSessionRole,
    issueQrToken
  );

  router.post(
    "/providers/whatsapp_session/qr/start",
    attachOrgFromHeader,
    requireWhatsAppSessionRole,
    requireWhatsAppSessionFeature,
    async (req, res) => {
      if (!req.db?.query) {
        return res
          .status(500)
          .json({ error: "db_not_configured", message: "db_not_configured" });
      }
      let orgId;
      try {
        orgId = await ensureOrgContext(req, req.db);
      } catch (err) {
        const status = err.statusCode || 500;
        return res
          .status(status)
          .json({
            error: err.code || "org_context_missing",
            message: err.message,
          });
      }
      const allowed = await ensureWhatsAppSessionEnabled(req, res, orgId);
      if (!allowed) return;
      startQrLoop(orgId);
      return res.json({ ok: true });
    }
  );

  router.post(
    "/providers/whatsapp_session/qr/stop",
    attachOrgFromHeader,
    requireWhatsAppSessionRole,
    async (req, res) => {
      if (!req.db?.query) {
        return res
          .status(500)
          .json({ error: "db_not_configured", message: "db_not_configured" });
      }
      let orgId;
      try {
        orgId = await ensureOrgContext(req, req.db);
      } catch (err) {
        const status = err.statusCode || 500;
        return res
          .status(status)
          .json({
            error: err.code || "org_context_missing",
            message: err.message,
          });
      }
      const allowed = await ensureWhatsAppSessionEnabled(req, res, orgId);
      if (!allowed) return;
      stopQrLoop(orgId);
      return res.json({ ok: true });
    }
  );

  router.get(
    "/providers/whatsapp_session/status",
    attachOrgFromHeader,
    requireWhatsAppSessionRole,
    async (req, res) => {
      if (!req.db?.query) {
        return res
          .status(500)
          .json({ error: "db_not_configured", message: "db_not_configured" });
      }
      let orgId;
      try {
        orgId = await ensureOrgContext(req, req.db);
      } catch (err) {
        const status = err.statusCode || 500;
        return res
          .status(status)
          .json({
            error: err.code || "org_context_missing",
            message: err.message,
          });
      }
      const allowed = await ensureWhatsAppSessionEnabled(req, res, orgId);
      if (!allowed) return;
      const statusPayload = getSessionStatus(orgId);
      return res.json({ ok: true, ...statusPayload });
    }
  );

  router.get(
  '/providers/whatsapp_session/qr/stream',
  attachOrgFromHeader,
  async (req, res, next) => {
    const execMiddleware = (middleware) =>
      new Promise((resolve, reject) => {
        let finished = false;
        const done = (err) => {
          if (finished) return;
          finished = true;
          if (err) reject(err);
          else resolve();
        };
        try {
          const maybe = middleware(req, res, done);
          if (res.headersSent || res.writableEnded) { finished = true; resolve(); return; }
          if (maybe && typeof maybe.then === 'function') {
            maybe.then(
              () => { if (!finished) { finished = true; resolve(); } },
              (err) => { if (!finished) { finished = true; reject(err); } },
            );
          }
        } catch (err) {
          if (!finished) { finished = true; reject(err); }
        }
      });

    try {
      // Aceita token via query, X-QR-Access-Token, ou Authorization: "QR <token>"
      const hdrToken =
        req.headers['x-qr-access-token'] ||
        (req.headers.authorization && req.headers.authorization.startsWith('QR ')
          ? req.headers.authorization.slice(3).trim()
          : null);

      const qToken = (req.query || {}).access_token || null;
      const access_token = qToken || hdrToken;

      if (access_token) {
        try {
          const payload = verifyQrToken(String(access_token), process.env.JWT_SECRET);
          req.user = { ...(req.user || {}), id: payload.sub, sub: payload.sub };
          req.user.roles = Array.isArray(req.user.roles) ? req.user.roles : [];
          req.org  = { ...(req.org  || {}), id: payload.org_id };
          if (!req.orgId) req.orgId = payload.org_id;
        } catch (err) {
          req.log?.warn?.({ err }, 'whatsapp-session-qr-token-invalid');
          return res
            .status(401)
            .json({ error: 'unauthorized', message: 'Token QR inválido/expirado' });
        }
      } else {
        // Sem token curto → RBAC normal
        await execMiddleware(requireAnyRole(['SuperAdmin', 'OrgOwner']));
        if (res.headersSent || res.writableEnded) return;
      }

      // Feature flag
      await execMiddleware(requireOrgFeature('whatsapp_session_enabled'));
      if (res.headersSent || res.writableEnded) return;

      if (!req.db?.query) {
        return res.status(500).json({ error: 'db_not_configured', message: 'db_not_configured' });
      }

      const orgId = req.org?.id || req.orgId || req.headers['x-org-id'];
      if (!orgId) {
        return res.status(400).json({ error: 'invalid_org', message: 'Org ausente' });
      }

      // SSE
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders?.();

      // Publica eventos (QR/pings) para este cliente
      const unsubscribe = subscribe(orgId, res);
      req.on('close', () => {
        unsubscribe();
        try { res.end(); } catch {}
      });
    } catch (err) {
      next(err);
    }
  },
);

  router.post(
    "/providers/whatsapp_session/mark-connected",
    attachOrgFromHeader,
    requireWhatsAppSessionRole,
    async (req, res) => {
      if (!req.db?.query) {
        return res
          .status(500)
          .json({ error: "db_not_configured", message: "db_not_configured" });
      }
      let orgId;
      try {
        orgId = await ensureOrgContext(req, req.db);
      } catch (err) {
        const status = err.statusCode || 500;
        return res
          .status(status)
          .json({
            error: err.code || "org_context_missing",
            message: err.message,
          });
      }
      const allowed = await ensureWhatsAppSessionEnabled(req, res, orgId);
      if (!allowed) return;
      markConnected(orgId);
      return res.json({ ok: true });
    }
  );

  return router;
}

const defaultRouter = createIntegrationsRouter();

export default defaultRouter;
