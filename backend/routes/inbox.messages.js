// backend/routes/inbox.messages.js
import { Router } from 'express';
import { query as rootQuery } from '#db';
import { withOrg } from '../middleware/withOrg.js';

const router = Router();
router.use(withOrg);

function q(db) { return (t, p) => (db?.query ? db.query(t, p) : rootQuery(t, p)); }

/** POST /api/inbox/send  { conversationId, text?, media?: { url, mime, filename } } */
router.post('/send', async (req, res, next) => {
  try {
    const orgId = req.org?.id || req.headers['x-org-id'] || null;
    const { conversationId, text, media } = req.body || {};
    if (!conversationId) return res.status(400).json({ error: 'missing_conversationId' });

    const { rows } = await q(req.db)(
      `INSERT INTO public.messages (conversation_id, org_id, direction, provider, "from", type, text, media_url, media_mime, media_filename, created_at)
       VALUES ($1,$2,'out','internal','agent', $3, $4, $5, $6, $7, now())
       RETURNING *`,
      [
        conversationId,
        orgId,
        media?.url ? 'image' : 'text',
        text || null,
        media?.url || null,
        media?.mime || null,
        media?.filename || null,
      ]
    );

    await q(req.db)(
      `UPDATE public.conversations SET last_message_at = now() WHERE id = $1 AND ($2::uuid IS NULL OR org_id = $2)`,
      [conversationId, orgId]
    );

    // broadcast opcional via socket
    try {
      const io = req.app.get('io');
      io?.to(`org:${orgId}`).emit('message:new', { conversationId, message: rows[0] });
    } catch {}

    res.json({ ok: true, message: rows[0] });
  } catch (err) { next(err); }
});

export default router;
