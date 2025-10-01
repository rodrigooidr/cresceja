import { Router } from 'express';
import { z } from 'zod';
import { authRequired, requireRole } from '../middleware/auth.js';
import { seal, open } from '../services/credStore.js';

const router = Router();

const PROVIDERS = [
  'whatsapp_cloud',
  'whatsapp_session',
  'meta_facebook',
  'meta_instagram',
  'google_calendar',
];

router.use(authRequired, requireRole('OrgAdmin', 'OrgOwner'));

function nowIso() {
  return new Date().toISOString();
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
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
  const sealedCreds = creds && 'c' in creds && 'v' in creds ? creds : seal(creds || {});
  const safeMeta = isPlainObject(meta) ? meta : {};
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
    [provider, status, subscribed, JSON.stringify(sealedCreds), JSON.stringify(safeMeta)]
  );
  return rows[0] || null;
}

async function patchIntegration(db, provider, partial) {
  const fields = [];
  const values = [provider];
  let index = 2;

  if (partial.status !== undefined) {
    fields.push(`status = $${index++}`);
    values.push(partial.status);
  }
  if (partial.subscribed !== undefined) {
    fields.push(`subscribed = $${index++}`);
    values.push(partial.subscribed);
  }
  if (partial.creds !== undefined) {
    const sealed = partial.creds && 'c' in partial.creds && 'v' in partial.creds ? partial.creds : seal(partial.creds || {});
    fields.push(`creds = $${index++}::jsonb`);
    values.push(JSON.stringify(sealed));
  }
  if (partial.meta !== undefined) {
    const safeMeta = isPlainObject(partial.meta) ? partial.meta : {};
    fields.push(`meta = $${index++}::jsonb`);
    values.push(JSON.stringify(safeMeta));
  }

  fields.push('updated_at = now()');

  const query = `
    UPDATE org_integrations
       SET ${fields.join(', ')}
     WHERE org_id = current_setting('app.org_id')::uuid
       AND provider = $1
   RETURNING *`;

  const { rows } = await db.query(query, values);
  return rows[0] || null;
}

function sanitizeIntegration(provider, row) {
  if (!row) {
    return { provider, status: 'disconnected', subscribed: false, meta: {}, updated_at: null };
  }
  const meta = isPlainObject(row.meta) ? row.meta : {};
  return {
    provider,
    status: row.status || 'disconnected',
    subscribed: Boolean(row.subscribed),
    meta,
    updated_at: row.updated_at || null,
  };
}

async function recordIntegrationLog(req, provider, action, ok, details = {}) {
  try {
    await req.db.query(
      `INSERT INTO org_integration_logs (org_id, provider, event, ok, detail)
         VALUES (current_setting('app.org_id')::uuid, $1, $2, $3, $4::jsonb)`,
      [provider, action, ok, JSON.stringify(details || {})]
    );
  } catch (err) {
    req.log?.error?.({ provider, action: 'log_failed', err });
  }

  const payload = { provider, action, ok, org_id: req.user?.org_id, details };
  if (ok) req.log?.info?.(payload);
  else req.log?.warn?.(payload);
}

function ensureProvider(provider) {
  if (!PROVIDERS.includes(provider)) {
    const err = new Error('provider_not_supported');
    err.statusCode = 404;
    throw err;
  }
  return providerHandlers[provider];
}

const providerHandlers = {
  whatsapp_cloud: {
    connectSchema: z
      .object({
        phone_number_id: z.string().min(3, 'Informe o phone_number_id').optional(),
        display_phone_number: z.string().optional(),
        business_name: z.string().optional(),
        access_token: z.string().min(10, 'Token inválido').optional(),
      })
      .default({}),
    testSchema: z.object({ to: z.string().min(5, 'Informe o destinatário') }).default({}),
    supportsSubscribe: true,
    async connect({ payload, existing }) {
      const nextPhone = payload.phone_number_id || existing?.meta?.phone_number_id || existing?.creds?.phone_number_id;
      const nextToken = payload.access_token || existing?.creds?.access_token;
      if (!nextPhone || !nextToken) {
        const error = new Error('missing_credentials');
        error.statusCode = 400;
        throw error;
      }

      const meta = {
        ...(isPlainObject(existing?.meta) ? existing.meta : {}),
        phone_number_id: nextPhone,
        display_phone_number: payload.display_phone_number ?? existing?.meta?.display_phone_number ?? null,
        business_name: payload.business_name ?? existing?.meta?.business_name ?? null,
        connected_at: nowIso(),
      };

      return {
        status: 'connected',
        subscribed: existing?.subscribed ?? false,
        creds: { phone_number_id: nextPhone, access_token: nextToken },
        meta,
        detail: { message: 'WhatsApp Cloud conectado' },
      };
    },
    async subscribe({ existing }) {
      if (!existing) {
        const error = new Error('integration_not_connected');
        error.statusCode = 400;
        throw error;
      }
      const meta = {
        ...(isPlainObject(existing.meta) ? existing.meta : {}),
        last_subscribe_at: nowIso(),
      };
      return {
        subscribed: true,
        meta,
        detail: { message: 'Webhook WhatsApp Cloud assinado' },
      };
    },
    async test({ payload, existing }) {
      if (!existing) {
        const error = new Error('integration_not_connected');
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
        detail: { message: 'Mensagem de teste enviada (mock)', to: payload.to },
      };
    },
  },
  whatsapp_session: {
    connectSchema: z
      .object({
        session_host: z.string().url('URL inválida').optional(),
      })
      .default({}),
    testSchema: z.object({ to: z.string().min(5, 'Informe o destinatário') }).default({}),
    supportsSubscribe: false,
    async connect({ payload, existing }) {
      const meta = {
        ...(isPlainObject(existing?.meta) ? existing.meta : {}),
        session_host: payload.session_host || existing?.meta?.session_host || null,
        session_state: 'pending_qr',
        requested_at: nowIso(),
      };
      return {
        status: 'connecting',
        subscribed: false,
        creds: existing?.creds || {},
        meta,
        detail: { message: 'Sessão WhatsApp iniciada (mock)' },
      };
    },
    async test({ payload, existing }) {
      if (!existing) {
        const error = new Error('integration_not_connected');
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
        detail: { message: 'Mensagem de teste enviada (mock)', to: payload.to },
      };
    },
  },
  meta_facebook: {
    connectSchema: z
      .object({
        user_access_token: z.string().min(8, 'Token inválido'),
        page_id: z.string().min(3, 'Informe o Page ID').optional(),
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
        status: 'connected',
        subscribed: true,
        creds: { user_access_token: payload.user_access_token },
        meta,
        detail: { message: 'Facebook conectado' },
      };
    },
    async subscribe({ existing }) {
      if (!existing) {
        const error = new Error('integration_not_connected');
        error.statusCode = 400;
        throw error;
      }
      const meta = {
        ...(isPlainObject(existing.meta) ? existing.meta : {}),
        last_subscribe_at: nowIso(),
      };
      return {
        subscribed: true,
        meta,
        detail: { message: 'Webhook Facebook marcado como ativo' },
      };
    },
    async test({ existing }) {
      if (!existing) {
        const error = new Error('integration_not_connected');
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
        detail: { message: 'Publicação de teste (mock)' },
      };
    },
  },
  meta_instagram: {
    connectSchema: z
      .object({
        user_access_token: z.string().min(8, 'Token inválido'),
        instagram_business_id: z.string().min(3, 'Informe o Instagram Business ID').optional(),
        page_id: z.string().optional(),
      })
      .default({}),
    testSchema: z.object({}).default({}),
    supportsSubscribe: true,
    async connect({ payload, existing }) {
      const meta = {
        ...(isPlainObject(existing?.meta) ? existing.meta : {}),
        instagram_business_id:
          payload.instagram_business_id ?? existing?.meta?.instagram_business_id ?? null,
        page_id: payload.page_id ?? existing?.meta?.page_id ?? null,
        connected_at: nowIso(),
      };
      return {
        status: 'connected',
        subscribed: true,
        creds: { user_access_token: payload.user_access_token },
        meta,
        detail: { message: 'Instagram conectado' },
      };
    },
    async subscribe({ existing }) {
      if (!existing) {
        const error = new Error('integration_not_connected');
        error.statusCode = 400;
        throw error;
      }
      const meta = {
        ...(isPlainObject(existing.meta) ? existing.meta : {}),
        last_subscribe_at: nowIso(),
      };
      return {
        subscribed: true,
        meta,
        detail: { message: 'Webhook Instagram marcado como ativo' },
      };
    },
    async test({ existing }) {
      if (!existing) {
        const error = new Error('integration_not_connected');
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
        detail: { message: 'Teste de publicação Instagram (mock)' },
      };
    },
  },
  google_calendar: {
    connectSchema: z.object({
      calendarId: z.string().min(3, 'Informe o Calendar ID'),
      clientEmail: z.string().email('Informe um e-mail válido'),
      privateKey: z.string().min(20, 'Informe a chave privada'),
      timezone: z.string().min(2, 'Informe o timezone'),
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
        status: 'connected',
        subscribed: false,
        creds: {
          calendarId: payload.calendarId,
          clientEmail: payload.clientEmail,
          privateKey: payload.privateKey,
          timezone: payload.timezone,
        },
        meta,
        detail: { message: 'Google Calendar conectado' },
      };
    },
    async test({ existing }) {
      if (!existing) {
        const error = new Error('integration_not_connected');
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
        detail: { message: 'Evento teste Google Calendar criado/removido (mock)' },
      };
    },
  },
};

router.get('/status', async (req, res, next) => {
  try {
    const result = {};
    for (const provider of PROVIDERS) {
      const row = await getIntegration(req.db, provider);
      result[provider] = sanitizeIntegration(provider, row);
    }
    res.json({ providers: result });
  } catch (err) {
    next(err);
  }
});

router.get('/providers/:provider', async (req, res) => {
  const { provider } = req.params;
  try {
    ensureProvider(provider);
  } catch (err) {
    return res.status(404).json({ error: 'provider_not_supported', message: provider });
  }

  const row = await getIntegration(req.db, provider);
  return res.json({ integration: sanitizeIntegration(provider, row) });
});

router.post('/providers/:provider/connect', async (req, res) => {
  const { provider } = req.params;
  let handler;
  try {
    handler = ensureProvider(provider);
  } catch (err) {
    return res.status(404).json({ error: 'provider_not_supported', message: provider });
  }

  try {
    const schema = handler.connectSchema || z.object({}).strip();
    const payload = schema.parse(req.body || {});
    const existingRow = await getIntegration(req.db, provider);
    const existing = existingRow
      ? { ...existingRow, creds: open(existingRow.creds) }
      : null;
    const result = await handler.connect({ req, provider, payload, existing });

    const row = await upsertIntegration(req.db, provider, {
      status: result.status || existingRow?.status || 'connected',
      subscribed:
        typeof result.subscribed === 'boolean'
          ? result.subscribed
          : existingRow?.subscribed || false,
      creds: result.creds || existing?.creds || {},
      meta: result.meta || existing?.meta || {},
    });

    await recordIntegrationLog(req, provider, 'connect', true, result.detail || {});

    return res.json({ ok: true, integration: sanitizeIntegration(provider, row) });
  } catch (err) {
    if (err instanceof z.ZodError) {
      await recordIntegrationLog(req, provider, 'connect', false, {
        message: 'validation_error',
        issues: err.flatten(),
      });
      return res.status(400).json({ error: 'validation_error', issues: err.flatten() });
    }
    const status = err.statusCode || 500;
    await recordIntegrationLog(req, provider, 'connect', false, { message: err.message });
    return res.status(status).json({ error: 'connect_failed', message: err.message });
  }
});

router.post('/providers/:provider/subscribe', async (req, res) => {
  const { provider } = req.params;
  let handler;
  try {
    handler = ensureProvider(provider);
  } catch (err) {
    return res.status(404).json({ error: 'provider_not_supported', message: provider });
  }

  if (!handler.supportsSubscribe) {
    return res.status(400).json({ error: 'subscribe_not_supported', message: provider });
  }

  try {
    const existingRow = await getIntegration(req.db, provider);
    if (!existingRow) {
      await recordIntegrationLog(req, provider, 'subscribe', false, {
        message: 'integration_not_connected',
      });
      return res.status(400).json({ error: 'integration_not_connected', message: provider });
    }
    const existing = { ...existingRow, creds: open(existingRow.creds) };
    const result = await handler.subscribe({ req, provider, existing });
    const row = await upsertIntegration(req.db, provider, {
      status: existingRow.status,
      subscribed: typeof result.subscribed === 'boolean' ? result.subscribed : true,
      creds: existingRow.creds,
      meta: result.meta || existing.meta || {},
    });
    await recordIntegrationLog(req, provider, 'subscribe', true, result.detail || {});
    return res.json({ ok: true, integration: sanitizeIntegration(provider, row) });
  } catch (err) {
    const status = err.statusCode || 500;
    await recordIntegrationLog(req, provider, 'subscribe', false, { message: err.message });
    return res.status(status).json({ error: 'subscribe_failed', message: err.message });
  }
});

router.post('/providers/:provider/test', async (req, res) => {
  const { provider } = req.params;
  let handler;
  try {
    handler = ensureProvider(provider);
  } catch (err) {
    return res.status(404).json({ error: 'provider_not_supported', message: provider });
  }

  try {
    const schema = handler.testSchema || z.object({}).strip();
    const payload = schema.parse(req.body || {});
    const existingRow = await getIntegration(req.db, provider);
    if (!existingRow) {
      await recordIntegrationLog(req, provider, 'test', false, {
        message: 'integration_not_connected',
      });
      return res.status(400).json({ error: 'integration_not_connected', message: provider });
    }
    const existing = { ...existingRow, creds: open(existingRow.creds) };
    const result = await handler.test({ req, provider, payload, existing });
    const row = await upsertIntegration(req.db, provider, {
      status: existingRow.status,
      subscribed: existingRow.subscribed,
      creds: existingRow.creds,
      meta: result.meta || existing.meta || {},
    });
    await recordIntegrationLog(req, provider, 'test', true, result.detail || {});
    return res.json({ ok: true, detail: result.detail || {}, integration: sanitizeIntegration(provider, row) });
  } catch (err) {
    if (err instanceof z.ZodError) {
      await recordIntegrationLog(req, provider, 'test', false, {
        message: 'validation_error',
        issues: err.flatten(),
      });
      return res.status(400).json({ error: 'validation_error', issues: err.flatten() });
    }
    const status = err.statusCode || 500;
    await recordIntegrationLog(req, provider, 'test', false, { message: err.message });
    return res.status(status).json({ error: 'test_failed', message: err.message });
  }
});

router.post('/providers/:provider/disconnect', async (req, res) => {
  const { provider } = req.params;
  try {
    ensureProvider(provider);
  } catch (err) {
    return res.status(404).json({ error: 'provider_not_supported', message: provider });
  }

  try {
    const existingRow = await getIntegration(req.db, provider);
    if (!existingRow) {
      return res.json({ ok: true, integration: sanitizeIntegration(provider, null) });
    }
    const meta = {
      ...(isPlainObject(existingRow.meta) ? existingRow.meta : {}),
      disconnected_at: nowIso(),
    };
    const row = await patchIntegration(req.db, provider, {
      status: 'disconnected',
      subscribed: false,
      creds: {},
      meta,
    });
    await recordIntegrationLog(req, provider, 'disconnect', true, { message: 'Integração desconectada' });
    return res.json({ ok: true, integration: sanitizeIntegration(provider, row) });
  } catch (err) {
    await recordIntegrationLog(req, provider, 'disconnect', false, { message: err.message });
    return res.status(500).json({ error: 'disconnect_failed', message: err.message });
  }
});

export default router;
