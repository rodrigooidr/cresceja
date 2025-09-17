import { Router } from 'express';
import { query } from '#db';
import * as authModule from '../middleware/auth.js';
import { ensureLoaded, cfg } from '../services/inbox/directionSender.meta.js';

(async () => {
  try {
    await ensureLoaded();
  } catch (_err) {
    // ignore boot failures; keep safe defaults
  }
})();

const router = Router();
const requireAuth =
  authModule?.requireAuth ||
  authModule?.authRequired ||
  authModule?.default ||
  ((_req, _res, next) => next());

router.use(requireAuth);

async function fallbackPersistOutgoingMessage({ conversationId, transport, media, text }) {
  if (!conversationId || !transport) return null;
  const kind = media ? media.type || 'image' : 'text';
  const normalizedText = text ?? null;
  const ins = await query(
    `INSERT INTO public.messages
       (id, org_id, conversation_id, sender, direction, type, text, status, created_at, updated_at)
     SELECT gen_random_uuid(), c.org_id, c.id, $4, $5, $2, $3, 'sent', now(), now()
       FROM public.conversations c
       JOIN public.channels ch ON ch.id = c.channel_id
      WHERE c.id = $1
        AND ch.type = 'whatsapp'
        AND (ch.mode = $6 OR ($6 IS NULL AND ch.mode IS NULL))
      LIMIT 1
      RETURNING id`,
    [conversationId, kind, normalizedText, cfg.SENDER_OUT, cfg.DIR_OUT, transport]
  );
  if (!ins.rows.length) return null;
  const messageId = ins.rows[0].id;
  await query(
    `UPDATE public.conversations
        SET last_message_at = now(), updated_at = now()
      WHERE id = $1`,
    [conversationId]
  );
  return messageId;
}

async function tryLoad(paths = []) {
  for (const p of paths) {
    try {
      const mod = await import(new URL(p, import.meta.url));
      if (mod) {
        return mod.default ?? mod;
      }
    } catch (err) {
      if (
        err?.code === 'ERR_MODULE_NOT_FOUND' ||
        err?.code === 'MODULE_NOT_FOUND' ||
        err?.code === 'ERR_UNSUPPORTED_DIR_IMPORT'
      ) {
        continue;
      }
    }
  }
  return null;
}

const waCloudSvc = await tryLoad([
  '../services/whatsappCloud.js',
  '../services/whatsappCloud',
  '../services/social/waCloud.js',
]);

const baileysSvc = await tryLoad([
  '../services/baileysService.js',
  '../services/baileysService',
]);

function serviceFor(transport) {
  return transport === 'baileys' ? baileysSvc : waCloudSvc;
}

function getMethod(service, method) {
  if (!service) return null;
  if (typeof service[method] === 'function') return service[method].bind(service);
  return null;
}

async function resolveToFromConversation(conversationId) {
  if (!conversationId) return { to: null, transport: null };
  const { rows } = await query(
    `SELECT c.chat_id, c.external_user_id, ch.mode AS transport
       FROM public.conversations c
       JOIN public.channels ch ON ch.id = c.channel_id
      WHERE c.id = $1`,
    [conversationId]
  );
  if (!rows.length) return { to: null, transport: null };
  const row = rows[0];
  return { to: row.chat_id || row.external_user_id || null, transport: row.transport || null };
}

async function callSendText(fn, { to, text, idempotencyKey }) {
  if (!fn) return null;
  if (fn.length >= 2) {
    return fn(to, text, idempotencyKey);
  }
  return fn({ to, text, idempotencyKey });
}

async function callSendMedia(fn, { to, media, text, idempotencyKey }) {
  if (!fn) return null;
  if (fn.length >= 3) {
    return fn(to, media, text, idempotencyKey);
  }
  return fn({ to, media, caption: text, idempotencyKey });
}

async function doSend(defaultTransport, params) {
  const {
    to,
    text,
    media,
    conversationId,
    idempotencyKey,
    preferredTransport,
    transport: explicitTransport,
  } = params || {};
  const transport = preferredTransport || explicitTransport || defaultTransport;
  if (!to) {
    return { ok: false, error: 'destination_required' };
  }

  const service = serviceFor(transport);
  const sendText = getMethod(service, 'sendText');
  const sendMedia = getMethod(service, 'sendMedia');

  if (service && ((media && sendMedia) || (!media && sendText))) {
    if (media) {
      await callSendMedia(sendMedia, { to, media, text, idempotencyKey });
      return { ok: true, transport, to, idempotencyKey: idempotencyKey || null };
    }
    await callSendText(sendText, { to, text, idempotencyKey });
    return { ok: true, transport, to, idempotencyKey: idempotencyKey || null };
  }

  const messageId = conversationId
    ? await fallbackPersistOutgoingMessage({ conversationId, transport, media, text })
    : null;

  return {
    ok: true,
    transport,
    to,
    conversationId: conversationId || null,
    text: text ?? null,
    media: media ?? null,
    idempotencyKey: idempotencyKey || null,
    note: 'service_not_configured',
    messageId,
  };
}

router.post('/whatsapp/cloud/send', async (req, res, next) => {
  try {
    const { to, text, conversationId } = req.body || {};
    const idempotencyKey = req.get('Idempotency-Key') || null;
    const target = to ? { to, transport: 'cloud' } : await resolveToFromConversation(conversationId);
    const response = await doSend('cloud', {
      ...target,
      preferredTransport: target.transport,
      text,
      conversationId,
      idempotencyKey,
    });
    if (response.ok === false) {
      return res.status(400).json(response);
    }
    res.json(response);
  } catch (err) {
    next(err);
  }
});

router.post('/whatsapp/cloud/sendMedia', async (req, res, next) => {
  try {
    const { to, media, caption, conversationId } = req.body || {};
    const idempotencyKey = req.get('Idempotency-Key') || null;
    const target = to ? { to, transport: 'cloud' } : await resolveToFromConversation(conversationId);
    const response = await doSend('cloud', {
      ...target,
      preferredTransport: target.transport,
      media,
      text: caption,
      conversationId,
      idempotencyKey,
    });
    if (response.ok === false) {
      return res.status(400).json(response);
    }
    res.json(response);
  } catch (err) {
    next(err);
  }
});

router.post('/whatsapp/baileys/send', async (req, res, next) => {
  try {
    const { to, text, conversationId } = req.body || {};
    const idempotencyKey = req.get('Idempotency-Key') || null;
    const target = to ? { to, transport: 'baileys' } : await resolveToFromConversation(conversationId);
    const response = await doSend('baileys', {
      ...target,
      preferredTransport: target.transport,
      text,
      conversationId,
      idempotencyKey,
    });
    if (response.ok === false) {
      return res.status(400).json(response);
    }
    res.json(response);
  } catch (err) {
    next(err);
  }
});

router.post('/whatsapp/baileys/sendMedia', async (req, res, next) => {
  try {
    const { to, media, caption, conversationId } = req.body || {};
    const idempotencyKey = req.get('Idempotency-Key') || null;
    const target = to ? { to, transport: 'baileys' } : await resolveToFromConversation(conversationId);
    const response = await doSend('baileys', {
      ...target,
      preferredTransport: target.transport,
      media,
      text: caption,
      conversationId,
      idempotencyKey,
    });
    if (response.ok === false) {
      return res.status(400).json(response);
    }
    res.json(response);
  } catch (err) {
    next(err);
  }
});

router.post('/whatsapp/markRead', async (_req, res) => {
  res.json({ ok: true });
});

router.post('/whatsapp/typing', async (_req, res) => {
  res.json({ ok: true });
});

export default router;
