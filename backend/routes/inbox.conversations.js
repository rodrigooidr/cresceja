// backend/routes/inbox.conversations.js
import { Router } from 'express';
import { query as rootQuery } from '#db';
import { withOrg } from '../middleware/withOrg.js';

const router = Router();

const normalizeStatus = (s) => {
  const allowed = new Set(['open', 'closed', 'pending', 'archived', 'all']);
  if (!s || !allowed.has(s)) return 'open';
  return s;
};

function q(db) {
  return (text, params) => (db?.query ? db.query(text, params) : rootQuery(text, params));
}

/**
 * GET /api/inbox/conversations
 * Filtros: status, channel, accountId|account_id, tag (multi), q, limit, cursor (timestamp ms)
 */
router.get('/conversations', async (req, res) => {
  try {
    const orgId = req.org?.id || req.headers['x-org-id'] || null;
    const { channel, accountId, account_id, q: term, tag, cursor } = req.query;
    const rawStatus = req.query.status;
    const status = normalizeStatus(String(rawStatus || 'open'));
    const tags = Array.isArray(tag) ? tag : (tag ? [tag] : []);
    const limit = Math.min(parseInt(req.query.limit || '50', 10) || 50, 200);

    if (!orgId) {
      const meta = { status, limit, org_id: orgId };
      return res.status(200).json({
        items: [],
        conversations: [],
        meta,
        cursor: null,
        next_cursor: null,
        has_more: false,
      });
    }

    const params = [];
    const where = [];
    if (orgId) { params.push(orgId); where.push(`c.org_id = $${params.length}`); }
    if (status !== 'all') { params.push(status); where.push(`COALESCE(c.status,'open') = $${params.length}`); }
    if (channel) { params.push(channel); where.push(`COALESCE(c.channel,'') = $${params.length}`); }
    if (accountId || account_id) { params.push(accountId || account_id); where.push(`c.account_id = $${params.length}`); }
    if (tags.length) { params.push(tags); where.push(`c.tags && $${params.length}::text[]`); }
    if (term) { params.push(`%${term}%`); where.push(`(COALESCE(ct.name,'') ILIKE $${params.length})`); }
    if (cursor) { params.push(new Date(Number(cursor))); where.push(`c.last_message_at < $${params.length}`); }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    params.push(limit);

    const sql = `
      SELECT c.id, c.status, c.channel, c.account_id, c.tags, c.last_message_at,
             ct.id AS contact_id, ct.name AS client_name
      FROM public.conversations c
      LEFT JOIN public.contacts ct ON ct.id = c.external_user_id
      ${whereSql}
      ORDER BY c.last_message_at DESC NULLS LAST
      LIMIT $${params.length}
    `;
    const { rows } = await q(req.db)(sql, params);
    const nextCursor = rows.length ? String(new Date(rows[rows.length - 1].last_message_at).getTime()) : null;
    const meta = { status, limit, org_id: orgId };
    return res.status(200).json({
      items: rows,
      conversations: rows,
      meta,
      cursor: nextCursor,
      next_cursor: nextCursor,
      has_more: Boolean(nextCursor),
    });
  } catch (err) {
    return res.status(500).json({ error: 'inbox_list_failed', detail: String((err && err.message) || err) });
  }
});

router.use(withOrg);

/** GET /api/inbox/conversations/:id/messages  (?limit, ?before=epoch_ms) */
router.get('/conversations/:id/messages', async (req, res, next) => {
  try {
    const orgId = req.org?.id || req.headers['x-org-id'] || null;
    const { id } = req.params;
    const { limit = 100, before } = req.query;

    const params = [id];
    const conds = [`m.conversation_id = $1`];
    if (orgId) { params.push(orgId); conds.push(`m.org_id = $${params.length}`); }
    if (before) { params.push(new Date(Number(before))); conds.push(`m.created_at < $${params.length}`); }

    const sql = `
      SELECT m.*
      FROM public.messages m
      WHERE ${conds.join(' AND ')}
      ORDER BY m.created_at ASC
      LIMIT ${Number(limit) || 100}
    `;
    const { rows } = await q(req.db)(sql, params);
    res.json({ items: rows });
  } catch (err) { next(err); }
});

/** POST /api/inbox/conversations/:id/tags  { tags: string[] } */
router.post('/conversations/:id/tags', async (req, res, next) => {
  try {
    const orgId = req.org?.id || req.headers['x-org-id'] || null;
    const { id } = req.params;
    const { tags = [] } = req.body || {};
    await q(req.db)(
      `UPDATE public.conversations SET tags = $1 WHERE id = $2 AND ($3::uuid IS NULL OR org_id = $3)`,
      [tags, id, orgId]
    );
    res.json({ ok: true, tags });
  } catch (err) { next(err); }
});

/** POST /api/inbox/conversations/:id/status  { status: 'open'|'pending'|'closed' } */
router.post('/conversations/:id/status', async (req, res, next) => {
  try {
    const orgId = req.org?.id || req.headers['x-org-id'] || null;
    const { id } = req.params;
    const { status } = req.body || {};
    await q(req.db)(
      `UPDATE public.conversations SET status = $1 WHERE id = $2 AND ($3::uuid IS NULL OR org_id = $3)`,
      [status || 'open', id, orgId]
    );
    res.json({ ok: true, status: status || 'open' });
  } catch (err) { next(err); }
});

/** POST /api/inbox/conversations/:id/assign  { user_id?: uuid|null } */
router.post('/conversations/:id/assign', async (req, res, next) => {
  try {
    const orgId = req.org?.id || req.headers['x-org-id'] || null;
    const { id } = req.params;
    const { user_id } = req.body || {};
    await q(req.db)(
      `UPDATE public.conversations SET assigned_to = $1 WHERE id = $2 AND ($3::uuid IS NULL OR org_id = $3)`,
      [user_id || null, id, orgId]
    );
    res.json({ ok: true, assigned_to: user_id || null });
  } catch (err) { next(err); }
});

export default router;
