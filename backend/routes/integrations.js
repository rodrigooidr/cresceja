import { Router } from 'express';
import { z } from 'zod';
import { authRequired, requireRole } from '../middleware/auth.js';
import { seal, open } from '../services/credStore.js';

const router = Router();

const ORG_ADMIN_ROLES = ['OrgAdmin', 'OrgOwner'];

router.use(authRequired, requireRole(...ORG_ADMIN_ROLES));

const PROVIDERS = ['whatsapp_cloud', 'whatsapp_session', 'meta', 'google_calendar'];

const PHONE_REGEX = /^\+?\d{10,15}$/;

function isPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function ensureSealedCreds(creds) {
  if (!creds || typeof creds !== 'object') {
    return seal({});
  }
  if ('c' in creds && 'v' in creds) {
    return creds;
  }
  return seal(creds);
}

function withOpenedCreds(row) {
  if (!row) return null;
  return { ...row, creds: open(row.creds) };
}

async function getIntegration(db, provider) {
  const { rows } = await db.query(
    `SELECT *
       FROM org_integrations
      WHERE org_id = current_setting('app.org_id')::uuid
        AND provider = $1
      LIMIT 1`,
    [provider]
  );
  return rows[0] || null;
}

async function upsertIntegration(db, provider, { status, subscribed, creds, meta }) {
  const { rows } = await db.query(
    `INSERT INTO org_integrations (org_id, provider, status, subscribed, creds, meta)
       VALUES (current_setting('app.org_id')::uuid, $1, $2, $3, $4::jsonb, $5::jsonb)
       ON CONFLICT (org_id, provider)
       DO UPDATE SET status = EXCLUDED.status,
                     subscribed = EXCLUDED.subscribed,
                     creds = EXCLUDED.creds,
                     meta = EXCLUDED.meta,
                     updated_at = now()
       RETURNING *`,
    [provider, status, subscribed, JSON.stringify(creds ?? {}), JSON.stringify(meta ?? {})]
  );
  return rows[0] || null;
}

async function patchIntegration(db, provider, { status, subscribed, creds, meta }) {
  const sets = [];
  const values = [provider];
  let idx = 2;

  if (status) {
    sets.push(`status = $${idx++}`);
    values.push(status);
  }
  if (typeof subscribed === 'boolean') {
    sets.push(`subscribed = $${idx++}`);
    values.push(subscribed);
  }
  if (creds) {
    sets.push(`creds = $${idx++}::jsonb`);
    values.push(JSON.stringify(creds));
  }
  if (meta) {
    sets.push(`meta = $${idx++}::jsonb`);
    values.push(JSON.stringify(meta));
  }
  sets.push(`updated_at = now()`);

  const query = `
    UPDATE org_integrations
       SET ${sets.join(', ')}
     WHERE org_id = current_setting('app.org_id')::uuid
       AND provider = $1
   RETURNING *`;

  const { rows } = await db.query(query, values);
  return rows[0] || null;
}

async function recordIntegrationLog(req, provider, event, ok, detail = {}) {
  try {
    await req.db.query(
      `INSERT INTO org_integration_logs (org_id, provider, event, ok, detail)
         VALUES (current_setting('app.org_id')::uuid, $1, $2, $3, $4::jsonb)`,
      [provider, event, ok, JSON.stringify(detail ?? {})]
    );
  } catch (err) {
    req.log?.error?.({ provider, event: 'log_error', err });
  }
  const logPayload = { provider, event, ok, org_id: req.user?.org_id, detail };
  if (ok) {
    req.log?.info?.(logPayload);
  } else {
    req.log?.warn?.(logPayload);
  }
}

function sanitizeIntegration(provider, row) {
  if (!row) {
    return { provider, status: 'disconnected', subscribed: false, meta: {} };
  }
  const meta = isPlainObject(row.meta) ? row.meta : {};
  return {
    provider,
    status: row.status || 'disconnected',
    subscribed: !!row.subscribed,
    meta,
    updated_at: row.updated_at || null,
  };
}

function nowIso() {
  return new Date().toISOString();
}

const providerDefinitions = {
  whatsapp_cloud: {
    connectSchema: z.object({
      phone_number_id: z.string().nonempty('Obrigatório'),
      wa_token: z.string().min(20, 'Token inválido'),
      display_phone_number: z.string().optional(),
      business_name: z.string().optional(),
    }),
    secretKeys: ['wa_token'],
    async handleConnect({ payload, existing }) {
      const meta = {
        phone_number_id: payload.phone_number_id,
        display_phone_number: payload.display_phone_number || null,
        business_name: payload.business_name || null,
        connected_at: nowIso(),
      };
      return {
        status: 'connected',
        subscribed: existing?.subscribed ?? false,
        creds: { phone_number_id: payload.phone_number_id, wa_token: payload.wa_token },
        meta: { ...(existing?.meta || {}), ...meta },
        detail: { message: 'WhatsApp Cloud conectado' },
      };
    },
    async handleSubscribe({ existing }) {
      const meta = {
        ...(existing?.meta || {}),
        last_subscribe_at: nowIso(),
      };
      return {
        subscribed: true,
        meta,
        detail: { message: 'Webhook marcado como assinado' },
      };
    },
    testSchema: z
      .object({
        to: z
          .string()
          .regex(PHONE_REGEX, 'Telefone inválido')
          .optional(),
      })
      .optional(),
    async handleTest({ payload, existing }) {
      const meta = {
        ...(existing?.meta || {}),
        last_test_at: nowIso(),
        last_test_to: payload?.to || null,
      };
      return {
        ok: true,
        meta,
        detail: { message: 'Teste WhatsApp Cloud executado (mock)', to: payload?.to || null },
      };
    },
  },
  whatsapp_session: {
    connectSchema: z.object({
      session_host: z.string().url('URL inválida').nonempty('Obrigatório'),
      session_key: z.string().min(4, 'Obrigatório'),
    }),
    secretKeys: ['session_key'],
    async handleConnect({ payload, existing }) {
      const meta = {
        ...(existing?.meta || {}),
        session_host: payload.session_host,
        connected_at: nowIso(),
      };
      return {
        status: 'connected',
        subscribed: existing?.subscribed ?? false,
        creds: { session_host: payload.session_host, session_key: payload.session_key },
        meta,
        detail: { message: 'Sessão WhatsApp configurada' },
      };
    },
    async handleSubscribe({ existing }) {
      const meta = {
        ...(existing?.meta || {}),
        last_subscribe_at: nowIso(),
      };
      return {
        subscribed: true,
        meta,
        detail: { message: 'Webhook de sessão marcado como ativo' },
      };
    },
    testSchema: z
      .object({
        path: z.string().optional(),
      })
      .optional(),
    async handleTest({ existing, payload }) {
      if (!existing) {
        throw new Error('integration_not_connected');
      }
      const creds = existing.creds || {};
      const baseHost = creds.session_host || existing.meta?.session_host;
      if (!baseHost) {
        throw new Error('session_host_missing');
      }
      const url = new URL(payload?.path || '/health', baseHost).toString();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      let detail;
      try {
        const response = await fetch(url, { signal: controller.signal }).catch((err) => {
          throw new Error(`fetch_failed:${err.message}`);
        });
        const text = await response.text().catch(() => '');
        detail = { status: response.status, ok: response.ok, url };
        if (!response.ok) {
          throw new Error(`session_health_failed:${response.status}`);
        }
        return {
          ok: true,
          meta: { ...(existing.meta || {}), last_test_at: nowIso(), last_test_status: response.status },
          detail: { ...detail, preview: text.slice(0, 200) },
        };
      } finally {
        clearTimeout(timeout);
      }
    },
  },
  meta: {
    connectSchema: z
      .object({
        user_access_token: z.string().min(10).optional(),
        page_id: z.string().optional(),
        page_name: z.string().optional(),
        page_access_token: z.string().optional(),
        instagram_business_account: z.string().optional(),
      })
      .refine((data) => Object.keys(data).length > 0, {
        message: 'Informe ao menos um campo',
      }),
    secretKeys: ['user_access_token', 'page_access_token'],
    async handleConnect({ payload, existing }) {
      const meta = {
        ...(existing?.meta || {}),
        page_id: payload.page_id || existing?.meta?.page_id || null,
        page_name: payload.page_name || existing?.meta?.page_name || null,
        instagram_business_account:
          payload.instagram_business_account || existing?.meta?.instagram_business_account || null,
        connected_at: nowIso(),
      };
      const creds = {
        user_access_token: payload.user_access_token || existing?.creds?.user_access_token || null,
        page_access_token: payload.page_access_token || existing?.creds?.page_access_token || null,
      };
      return {
        status: 'connected',
        subscribed: existing?.subscribed ?? false,
        creds,
        meta,
        detail: { message: 'Meta (Facebook/Instagram) conectado' },
      };
    },
    async handleSubscribe({ existing }) {
      const meta = {
        ...(existing?.meta || {}),
        subscribed_at: nowIso(),
      };
      return {
        subscribed: true,
        meta,
        detail: { message: 'Webhooks Meta marcados como ativos' },
      };
    },
    testSchema: z
      .object({
        simulate: z.boolean().optional(),
      })
      .optional(),
    async handleTest({ existing }) {
      if (!existing) {
        throw new Error('integration_not_connected');
      }
      const meta = {
        ...(existing.meta || {}),
        last_test_at: nowIso(),
      };
      return {
        ok: true,
        meta,
        detail: { message: 'Teste Meta executado (mock)' },
      };
    },
  },
  google_calendar: {
    connectSchema: z
      .object({
        code: z.string().optional(),
        access_token: z.string().optional(),
        refresh_token: z.string().optional(),
        expiry_date: z.string().optional(),
        account_email: z.string().email().optional(),
      })
      .refine((data) => !!data.code || !!(data.access_token && data.refresh_token), {
        message: 'Informe o code do OAuth ou tokens válidos',
      }),
    secretKeys: ['access_token', 'refresh_token'],
    async handleConnect({ payload, existing }) {
      const creds = { ...(existing?.creds || {}) };
      if (payload.code) {
        const suffix = payload.code.slice(0, 6);
        creds.access_token = payload.access_token || `exchanged_access_${suffix}`;
        creds.refresh_token = payload.refresh_token || `exchanged_refresh_${suffix}`;
      } else {
        if (payload.access_token) creds.access_token = payload.access_token;
        if (payload.refresh_token) creds.refresh_token = payload.refresh_token;
      }
      if (payload.expiry_date) {
        creds.expiry_date = payload.expiry_date;
      }
      const meta = {
        ...(existing?.meta || {}),
        account_email: payload.account_email || existing?.meta?.account_email || null,
        last_token_refresh: nowIso(),
      };
      if (payload.expiry_date) {
        meta.expiry_date = payload.expiry_date;
      }
      return {
        status: 'connected',
        subscribed: existing?.subscribed ?? false,
        creds,
        meta,
        detail: { message: 'Google Calendar conectado' },
      };
    },
    async handleSubscribe({ existing }) {
      const meta = {
        ...(existing?.meta || {}),
        webhook_subscribed_at: nowIso(),
      };
      return {
        subscribed: true,
        meta,
        detail: { message: 'Notificações do Google Calendar marcadas como ativas' },
      };
    },
    testSchema: z
      .object({
        calendar_id: z.string().optional(),
      })
      .optional(),
    async handleTest({ existing }) {
      if (!existing) {
        throw new Error('integration_not_connected');
      }
      const meta = {
        ...(existing.meta || {}),
        last_test_at: nowIso(),
      };
      return {
        ok: true,
        meta,
        detail: { message: 'Evento teste Google Calendar criado/removido (mock)' },
      };
    },
  },
};

function ensureProvider(provider) {
  if (!PROVIDERS.includes(provider)) {
    const err = new Error('provider_not_supported');
    err.statusCode = 404;
    throw err;
  }
  return providerDefinitions[provider];
}

router.get('/status', async (req, res, next) => {
  try {
    const providers = [];
    for (const provider of PROVIDERS) {
      const row = await getIntegration(req.db, provider);
      providers.push(sanitizeIntegration(provider, row));
    }
    res.json({ providers });
  } catch (err) {
    next(err);
  }
});

router.get('/providers/:provider', async (req, res, next) => {
  try {
    const { provider } = req.params;
    ensureProvider(provider);
    const row = await getIntegration(req.db, provider);
    res.json(sanitizeIntegration(provider, row));
  } catch (err) {
    if (err.statusCode === 404) {
      return res.status(404).json({ error: 'provider_not_supported' });
    }
    next(err);
  }
});

router.post('/providers/:provider/connect', async (req, res) => {
  const { provider } = req.params;
  let definition;
  try {
    definition = ensureProvider(provider);
  } catch (err) {
    return res.status(404).json({ error: 'provider_not_supported' });
  }

  try {
    const payload = definition.connectSchema ? definition.connectSchema.parse(req.body || {}) : (req.body || {});
    const existingRow = await getIntegration(req.db, provider);
    const existing = withOpenedCreds(existingRow);
    const result = await definition.handleConnect({ req, provider, payload, existing });
    const nextCreds = result.creds !== undefined ? result.creds : existing?.creds || {};
    const sealedCreds = ensureSealedCreds(nextCreds);
    const meta = isPlainObject(result.meta) ? result.meta : existing?.meta || {};
    const row = await upsertIntegration(req.db, provider, {
      status: result.status || 'connected',
      subscribed:
        typeof result.subscribed === 'boolean'
          ? result.subscribed
          : existingRow?.subscribed ?? false,
      creds: sealedCreds,
      meta,
    });
    await recordIntegrationLog(req, provider, 'connect', true, result.detail || {});
    res.json({ ok: true, integration: sanitizeIntegration(provider, row) });
  } catch (err) {
    if (err instanceof z.ZodError) {
      await recordIntegrationLog(req, provider, 'connect', false, { message: 'validation_error', issues: err.flatten() });
      return res.status(400).json({ error: 'validation_error', issues: err.flatten() });
    }
    await recordIntegrationLog(req, provider, 'connect', false, { message: err.message });
    return res.status(500).json({ error: 'connect_failed', message: err.message });
  }
});

router.post('/providers/:provider/subscribe', async (req, res) => {
  const { provider } = req.params;
  let definition;
  try {
    definition = ensureProvider(provider);
  } catch (err) {
    return res.status(404).json({ error: 'provider_not_supported' });
  }

  try {
    const existingRow = await getIntegration(req.db, provider);
    if (!existingRow) {
      await recordIntegrationLog(req, provider, 'subscribe', false, { message: 'integration_not_connected' });
      return res.status(400).json({ error: 'integration_not_connected' });
    }
    const existing = withOpenedCreds(existingRow);
    const result = await definition.handleSubscribe({ req, provider, existing });
    const sealedCreds = ensureSealedCreds(existingRow?.creds);
    const meta = isPlainObject(result.meta) ? result.meta : existing?.meta;
    const row = await upsertIntegration(req.db, provider, {
      status: existingRow?.status || 'connected',
      subscribed: typeof result.subscribed === 'boolean' ? result.subscribed : true,
      creds: sealedCreds,
      meta: meta || existing?.meta || {},
    });
    await recordIntegrationLog(req, provider, 'subscribe', true, result.detail || {});
    res.json({ ok: true, integration: sanitizeIntegration(provider, row) });
  } catch (err) {
    await recordIntegrationLog(req, provider, 'subscribe', false, { message: err.message });
    return res.status(500).json({ error: 'subscribe_failed', message: err.message });
  }
});

router.post('/providers/:provider/test', async (req, res) => {
  const { provider } = req.params;
  let definition;
  try {
    definition = ensureProvider(provider);
  } catch (err) {
    return res.status(404).json({ error: 'provider_not_supported' });
  }

  try {
    const payload = definition.testSchema ? definition.testSchema.parse(req.body || {}) : (req.body || {});
    const existingRow = await getIntegration(req.db, provider);
    if (!existingRow) {
      await recordIntegrationLog(req, provider, 'test', false, { message: 'integration_not_connected' });
      return res.status(400).json({ error: 'integration_not_connected' });
    }
    const existing = withOpenedCreds(existingRow);
    const result = await definition.handleTest({ req, provider, payload, existing });
    const meta = isPlainObject(result.meta) ? result.meta : existing?.meta;
    const row = await upsertIntegration(req.db, provider, {
      status: existingRow?.status || 'connected',
      subscribed: existingRow?.subscribed ?? false,
      creds: ensureSealedCreds(existingRow?.creds || existing?.creds || {}),
      meta: meta || existing?.meta || {},
    });
    await recordIntegrationLog(req, provider, 'test', true, result.detail || {});
    res.json({ ok: true, detail: result.detail || {}, integration: sanitizeIntegration(provider, row) });
  } catch (err) {
    if (err instanceof z.ZodError) {
      await recordIntegrationLog(req, provider, 'test', false, { message: 'validation_error', issues: err.flatten() });
      return res.status(400).json({ error: 'validation_error', issues: err.flatten() });
    }
    await recordIntegrationLog(req, provider, 'test', false, { message: err.message });
    return res.status(500).json({ error: 'test_failed', message: err.message });
  }
});

router.delete('/providers/:provider', async (req, res) => {
  const { provider } = req.params;
  try {
    ensureProvider(provider);
  } catch (err) {
    return res.status(404).json({ error: 'provider_not_supported' });
  }

  try {
    const existing = await getIntegration(req.db, provider);
    if (!existing) {
      return res.json({ ok: true, integration: sanitizeIntegration(provider, null) });
    }
    const meta = {
      ...(existing.meta || {}),
      disconnected_at: nowIso(),
    };
    const row = await patchIntegration(req.db, provider, {
      status: 'disconnected',
      subscribed: false,
      creds: {},
      meta,
    });
    await recordIntegrationLog(req, provider, 'disconnect', true, { message: 'Integração removida' });
    res.json({ ok: true, integration: sanitizeIntegration(provider, row) });
  } catch (err) {
    await recordIntegrationLog(req, provider, 'disconnect', false, { message: err.message });
    return res.status(500).json({ error: 'disconnect_failed', message: err.message });
  }
});

export default router;
