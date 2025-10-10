import { Router } from 'express';
import { createRequire } from 'module';
import { query } from '#db';
import * as authModule from '../middleware/auth.js';
import { requireAnyRole } from '../middlewares/auth.js';
import Audit from '../services/audit.js';
import { ensureLoaded, cfg } from '../services/inbox/directionSender.meta.js';

(async () => {
  try {
    await ensureLoaded();
  } catch (_err) {
    // ignore boot failures; keep safe defaults
  }
})();

const require = createRequire(import.meta.url);

const FORCE_FALLBACK = String(process.env.WHATSAPP_FORCE_FALLBACK || 'false').toLowerCase() === 'true';

const router = Router();
const requireAuth =
  authModule?.requireAuth ||
  authModule?.authRequired ||
  authModule?.default ||
  ((_req, _res, next) => next());

const requireWhatsAppSessionRole = requireAnyRole(['SuperAdmin', 'OrgOwner']);

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
      const mod = require(p);
      if (mod) {
        return mod.default ?? mod;
      }
    } catch (err) {
      if (err?.code === 'ERR_REQUIRE_ESM') {
        try {
          const mod = await import(new URL(`${p}${p.endsWith('.js') ? '' : '.js'}`, import.meta.url));
          if (mod) {
            return mod.default ?? mod;
          }
        } catch (_err2) {
          // ignore and continue to next path
        }
      }
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

async function ensureConversationFor(to, transport) {
  const existing = await query(
    `SELECT c.id
       FROM public.conversations c
       JOIN public.channels ch ON ch.id = c.channel_id
      WHERE ch.type='whatsapp'
        AND ch.mode=$2
        AND (c.chat_id=$1 OR c.external_user_id=$1)
      ORDER BY c.created_at ASC
      LIMIT 1`,
    [to, transport]
  );
  if (existing.rows.length) {
    return existing.rows[0].id;
  }

  const r = await query(
    `INSERT INTO public.conversations (id, org_id, channel_id, contact_id, status, assigned_to,
                                      is_ai_active, ai_status, human_requested_at, alert_sent, unread_count,
                                      last_message_at, created_at, updated_at, ai_enabled, client_id,
                                      channel, account_id, external_user_id, external_thread_id, chat_id, transport)
     SELECT gen_random_uuid(), ch.org_id, ch.id, NULL, 'open', NULL,
            false, 'idle', NULL, false, 0,
            now(), now(), now(), true, NULL,
            ch.type, ch.id, NULL, NULL, $1, $2
     FROM public.channels ch
     WHERE ch.type='whatsapp' AND ch.mode=$2
     ORDER BY ch.created_at ASC
     LIMIT 1
     RETURNING id`,
    [to, transport]
  );
  return r.rows[0]?.id || null;
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
  if (!to && !conversationId) {
    return { ok: false, error: 'destination_required' };
  }

  const conv = conversationId
    ? { id: conversationId, to }
    : to
      ? { id: null, to }
      : await (async () => {
          const r = await query(
            `SELECT id FROM public.conversations WHERE chat_id=$1 LIMIT 1`,
            [to]
          );
          return { id: r.rows[0]?.id || null, to };
        })();

  if (conv.id && !conv.to) {
    const resolved = await resolveToFromConversation(conv.id);
    conv.to = resolved.to;
  }

  if (!conv.to) {
    return { ok: false, error: 'destination_required' };
  }

  const svc = transport === 'baileys' ? baileysSvc : waCloudSvc;
  const hasProvider =
    !FORCE_FALLBACK && !!(svc && (typeof svc.sendText === 'function' || typeof svc.sendMedia === 'function'));

  if (hasProvider) {
    let result;
    try {
      if (media && typeof svc.sendMedia === 'function') {
        result = await svc.sendMedia({ to: conv.to, media, caption: text, idempotencyKey });
      } else if (typeof svc.sendText === 'function') {
        result = await svc.sendText({ to: conv.to, text, idempotencyKey });
      } else {
        throw new Error('provider_missing_method');
      }

      const convId = conv.id || (await ensureConversationFor(conv.to, transport));
      if (!convId) {
        throw new Error('conversation_resolution_failed');
      }
      const ins = await query(
        `INSERT INTO public.messages
           (id, org_id, conversation_id, sender, direction, type, text, status, created_at, updated_at, provider_message_id)
         SELECT gen_random_uuid(), ch.org_id, $1, $5, $6, $2, $3, 'sent', now(), now(), $7
         FROM public.channels ch
         WHERE ch.type='whatsapp' AND ch.mode=$4
         ORDER BY ch.created_at ASC
         LIMIT 1
         RETURNING id`,
        [
          convId,
          media ? (media.type || 'image') : 'text',
          text || null,
          transport,
          cfg.SENDER_OUT,
          cfg.DIR_OUT,
          result?.id || result?.messageId || result?.message?.id || null,
        ]
      );

      if (!ins.rows.length) {
        throw new Error('message_persist_failed');
      }

      await query(
        `UPDATE public.conversations
            SET last_message_at = now(), updated_at = now()
          WHERE id = $1`,
        [convId]
      );

      await Audit.auditLog(null, {
        action: 'wa.send.provider',
        entity: transport,
        entity_id: conv.to || conv.id,
        payload: { messageId: ins.rows[0].id, provider: !!result, idempotencyKey },
      });

      return {
        ok: true,
        transport,
        to: conv.to,
        messageId: ins.rows[0].id,
        provider: 'used',
        idempotencyKey: idempotencyKey || null,
      };
    } catch (e) {
      // provider failure falls back to local persistence
    }
  }

  const cvId = conv.id || (await ensureConversationFor(conv.to || to, transport));
  if (!cvId) {
    return { ok: false, error: 'conversation_resolution_failed' };
  }
  const ins = await query(
    `INSERT INTO public.messages
       (id, org_id, conversation_id, sender, direction, type, text, status, created_at, updated_at)
     SELECT gen_random_uuid(), ch.org_id, $1, $4, $5, $2, $3, 'sent', now(), now()
     FROM public.channels ch
     WHERE ch.type='whatsapp' AND ch.mode=$6
     ORDER BY ch.created_at ASC
     LIMIT 1
     RETURNING id`,
    [cvId, media ? (media.type || 'image') : 'text', text || null, cfg.SENDER_OUT, cfg.DIR_OUT, transport]
  );

  if (!ins.rows.length) {
    return { ok: false, error: 'message_persist_failed' };
  }

  await query(
    `UPDATE public.conversations
        SET last_message_at = now(), updated_at = now()
      WHERE id = $1`,
    [cvId]
  );

  await Audit.auditLog(null, {
    action: 'wa.send.fallback',
    entity: transport,
    entity_id: to || conversationId || conv.to || cvId,
    payload: { messageId: ins.rows[0].id, idempotencyKey },
  });

  return {
    ok: true,
    messageId: ins.rows[0].id,
    transport,
    to: conv.to || to || null,
    idempotencyKey: idempotencyKey || null,
    note: 'fallback_saved_only',
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

router.post('/whatsapp/baileys/send', requireWhatsAppSessionRole, async (req, res, next) => {
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

router.post('/whatsapp/baileys/sendMedia', requireWhatsAppSessionRole, async (req, res, next) => {
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

router.post('/whatsapp/markRead', async (req, res, next) => {
  try {
    const { conversationId, to, transport: explicitTransport } = req.body || {};
    const target = to ? { to, transport: explicitTransport } : await resolveToFromConversation(conversationId);
    const transport = explicitTransport || target.transport || null;
    const service = serviceFor(transport);
    const markRead = getMethod(service, 'markRead');

    if (markRead && target.to) {
      if (markRead.length >= 2) {
        await markRead(target.to, conversationId);
      } else {
        await markRead({ to: target.to, conversationId });
      }
      return res.json({ ok: true, provider: 'used' });
    }

    res.json({ ok: true, provider: 'noop' });
  } catch (err) {
    next(err);
  }
});

router.post('/whatsapp/typing', async (req, res, next) => {
  try {
    const { conversationId, to, state, transport: explicitTransport } = req.body || {};
    const target = to ? { to, transport: explicitTransport } : await resolveToFromConversation(conversationId);
    const transport = explicitTransport || target.transport || null;
    const service = serviceFor(transport);
    const typing = getMethod(service, 'typing');

    if (typing && target.to) {
      if (typing.length >= 2) {
        await typing(target.to, state ?? 'on');
      } else {
        await typing({ to: target.to, state: state ?? 'on' });
      }
      return res.json({ ok: true, provider: 'used' });
    }

    res.json({ ok: true, provider: 'noop' });
  } catch (err) {
    next(err);
  }
});

export default router;
