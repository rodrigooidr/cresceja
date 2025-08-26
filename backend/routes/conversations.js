// backend/routes/conversations.js
import { Router } from 'express';
import {
  listConversations,
  getConversation,
  listMessages,
  appendMessage,
} from '../services/conversationsService.js';

const router = Router();

// GET /api/conversations
router.get('/', async (req, res, next) => {
  try {
    const orgId = req.orgId ?? req.user?.org_id;
    if (!orgId) return res.status(401).json({ error: 'missing_org' });

    const { q, status, tags, limit } = req.query;
    const parsedTags =
      typeof tags === 'string' && tags.length ? tags.split(',') : undefined;
    const lim = Math.min(100, Math.max(1, parseInt(limit ?? '30', 10)));

    const items = await listConversations(
      req.db,             // <-- IMPORTANTE: usa o client com RLS
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
  try {
    const orgId = req.orgId ?? req.user?.org_id;
    if (!orgId) return res.status(401).json({ error: 'missing_org' });

    const convo = await getConversation(req.db, orgId, req.params.id);
    if (!convo) return res.status(404).json({ error: 'not_found' });
    res.json(convo);
  } catch (err) {
    next(err);
  }
});

// GET /api/conversations/:id/messages
router.get('/:id/messages', async (req, res, next) => {
  try {
    const orgId = req.orgId ?? req.user?.org_id;
    if (!orgId) return res.status(401).json({ error: 'missing_org' });

    const { limit, before } = req.query;
    const lim = Math.min(200, Math.max(1, parseInt(limit ?? '50', 10)));

    const items = await listMessages(
      req.db,            // <-- RLS
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
  try {
    const orgId = req.orgId ?? req.user?.org_id;
    if (!orgId) return res.status(401).json({ error: 'missing_org' });

    const { from = 'agent', ...payload } = req.body || {};
    const created = await appendMessage(
      req.db,            // <-- RLS
      orgId,
      req.params.id,
      from,
      payload
    );
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

export default router;
