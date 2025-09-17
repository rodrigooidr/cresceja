// backend/routes/conversations.js
import { Router } from 'express';
import {
  listConversations,
  getConversation,
  listMessages,
  appendMessage,
} from '../services/conversationsService.js';
import { logTelemetry } from '../services/telemetryService.js';

const router = Router();

// helper: lê a org atual a partir das GUCs setadas no pgRlsContext
async function currentOrgId(db) {
  const { rows } = await db.query(
    `SELECT current_setting('app.org_id', true) AS org_id`
  );
  return rows?.[0]?.org_id || null;
}

// GET /api/conversations
router.get('/', async (req, res, next) => {
  const db = req.db; // IMPORTANTe: sempre usar o client da transação
  try {
    const orgId = (await currentOrgId(db)) || req.orgId || req.user?.org_id || null;
    if (!orgId) return res.status(401).json({ error: 'missing_org' });

    const { q, status, tags, limit } = req.query;
    const parsedTags =
      typeof tags === 'string' && tags.length ? tags.split(',') : undefined;
    const lim = Math.min(100, Math.max(1, parseInt(limit ?? '30', 10)));

    const items = await listConversations(
      db,            // RLS
      orgId,
      { q, status, tags: parsedTags, limit: lim }
    );
    res.json({ items });
  } catch (err) {
    next(err);
  }
});

// GET /api/conversations/:id
router.get('/:id', async (req, res, next) => {
  const db = req.db;
  try {
    const orgId = (await currentOrgId(db)) || req.orgId || req.user?.org_id || null;
    if (!orgId) return res.status(401).json({ error: 'missing_org' });

    const convo = await getConversation(db, orgId, req.params.id);
    if (!convo) return res.status(404).json({ error: 'not_found' });
    res.json(convo);
  } catch (err) {
    next(err);
  }
});

// GET /api/conversations/:id/messages
router.get('/:id/messages', async (req, res, next) => {
  const db = req.db;
  try {
    const orgId = (await currentOrgId(db)) || req.orgId || req.user?.org_id || null;
    if (!orgId) return res.status(401).json({ error: 'missing_org' });

    const { limit, before } = req.query;
    const lim = Math.min(200, Math.max(1, parseInt(limit ?? '50', 10)));

    const items = await listMessages(
      db,            // RLS
      orgId,
      req.params.id,
      { limit: lim, before }
    );
    res.json({ items });
  } catch (err) {
    next(err);
  }
});

// POST /api/conversations/:id/messages
router.post('/:id/messages', async (req, res, next) => {
  const db = req.db;
  try {
    const orgId = (await currentOrgId(db)) || req.orgId || req.user?.org_id || null;
    if (!orgId) return res.status(401).json({ error: 'missing_org' });

    const { from = 'agent', ...payload } = req.body || {};
    const created = await appendMessage(
      db,            // RLS
      orgId,
      req.params.id,
      from,
      payload
    );
    if (from === 'agent' || from === 'customer' || from === 'contact') {
      const eventKey = from === 'agent' ? 'inbox.message.sent' : 'inbox.message.received';
      await logTelemetry(db, {
        orgId,
        userId: from === 'agent' ? req.user?.id || null : null,
        source: 'inbox',
        eventKey,
      });
    }
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

export default router;
