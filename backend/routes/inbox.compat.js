import { Router } from 'express';
import { query } from '#db';
import * as authModule from '../middleware/auth.js';
import Audit from '../services/audit.js';
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

async function fallbackPersistOutgoingMessage(conversationId, transport, media, text) {
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

router.get('/inbox/threads', async (req, res, next) => {
  try {
    const { channel, tag, q } = req.query;
    const limit = Number(req.query.limit ?? 50) || 50;
    const offset = Number(req.query.offset ?? 0) || 0;

    const where = [];
    const args = [];

    if (channel) {
      args.push(channel);
      where.push(`vw.channel = $${args.length}`);
    }

    if (q) {
      args.push(`%${q}%`);
      where.push(`(vw.contact_name ILIKE $${args.length} OR vw.chat_id ILIKE $${args.length})`);
    }

    if (tag) {
      args.push(tag);
      where.push(`
        EXISTS (
          SELECT 1
          FROM unnest(vw.tags) AS tg(name)
          WHERE tg.name ILIKE $${args.length}
        )
      `);
    }

    const cond = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const sql = `
      SELECT *
      FROM public.vw_inbox_threads vw
      ${cond}
      ORDER BY vw.last_message_at DESC NULLS LAST
      LIMIT $${args.length + 1} OFFSET $${args.length + 2}
    `;

    args.push(limit, offset);

    const { rows } = await query(sql, args);
    res.json({ items: rows });
  } catch (err) {
    next(err);
  }
});

router.get('/inbox/threads/:id/messages', async (req, res, next) => {
  try {
    const id = req.params.id;
    const limit = Number(req.query.limit ?? 50) || 50;
    const offset = Number(req.query.offset ?? 0) || 0;

    const sql = `
      SELECT m.*,
             (
               SELECT jsonb_build_object(
                 'kind',  ma.kind,
                 'mime',  ma.mime,
                 'name',  ma.name,
                 'file',  ma.file_name,
                 'key',   ma.path_or_key,
                 'thumb', ma.thumbnail_key,
                 'poster',ma.poster_key
               )
               FROM public.message_attachments ma
               WHERE ma.message_id = m.id
               ORDER BY COALESCE(ma.idx, 0) ASC, ma.created_at ASC
               LIMIT 1
             ) AS media
      FROM public.messages m
      WHERE m.conversation_id = $1
      ORDER BY m.created_at ASC
      LIMIT $2 OFFSET $3
    `;

    const { rows } = await query(sql, [id, limit, offset]);

    const items = rows.map((r) => ({
      id: r.id,
      conversation_id: r.conversation_id,
      direction: r.direction,
      type: r.type,
      text: r.text,
      media: r.media,
      status: r.status,
      transcript: r.transcript,
      created_at: r.created_at,
    }));

    res.json({ items });
  } catch (err) {
    next(err);
  }
});

router.post('/inbox/messages', async (req, res, next) => {
  try {
    const body = req.body || {};
    const conversationId = body.conversationId || body.conversation_id || null;
    const text = body.message ?? body.text ?? null;
    const media = body.media || null;
    if (!conversationId) {
      return res.status(400).json({ error: 'conversation_required' });
    }

    const { rows } = await query(
      `SELECT c.id, ch.mode AS transport, ch.type
         FROM public.conversations c
         JOIN public.channels ch ON ch.id = c.channel_id
        WHERE c.id = $1
        LIMIT 1`,
      [conversationId]
    );

    if (!rows.length) {
      return res.status(404).json({ error: 'conversation_not_found' });
    }

    const conv = rows[0];
    if (conv.type !== 'whatsapp') {
      return res.status(400).json({ error: 'unsupported_channel' });
    }

    const messageId = await fallbackPersistOutgoingMessage(
      conversationId,
      conv.transport,
      media,
      text
    );

    if (!messageId) {
      return res.status(500).json({ error: 'fallback_failed' });
    }

    await Audit.auditLog(null, {
      action: 'inbox.send.fallback',
      entity: 'conversation',
      entity_id: conversationId,
      payload: { messageId },
    });

    res.json({ ok: true, messageId, conversationId });
  } catch (err) {
    next(err);
  }
});

router.post('/inbox/messages/:id/read', async (req, res, next) => {
  try {
    const id = req.params.id;
    await query(`UPDATE public.messages SET status = 'read', updated_at = now() WHERE id = $1`, [id]);
    await query(
      `UPDATE public.conversations
          SET unread_count = GREATEST(unread_count - 1, 0), updated_at = now()
        WHERE id = (SELECT conversation_id FROM public.messages WHERE id = $1)`,
      [id]
    );
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.post('/inbox/typing', async (_req, res) => {
  res.json({ ok: true });
});

export default router;
