// backend/routes/conversations.js
import express from 'express';
import { orgScope } from '../middleware/orgScope.js';
import { requireAgent, requireManager } from '../middleware/rbac.js';
import { listConversations, getConversation, listMessages, appendMessage } from '../services/conversationsService.js';
import { getIO } from '../socket/io.js';

const router = express.Router();

router.use(orgScope);

router.get('/', requireAgent, async (req, res, next) => {
  try {
    const items = await listConversations(req.orgId, {
      q: req.query.q,
      status: req.query.status,
      tags: req.query.tags ? req.query.tags.split(',') : [],
      limit: Number(req.query.limit) || 30,
    });
    res.json({ items });
  } catch (e) { next(e); }
});

router.get('/:id', requireAgent, async (req, res, next) => {
  try {
    const data = await getConversation(req.orgId, req.params.id);
    res.json({ data });
  } catch (e) { next(e); }
});

router.get('/:id/messages', requireAgent, async (req, res, next) => {
  try {
    const items = await listMessages(req.orgId, req.params.id, { before: req.query.before, limit: Number(req.query.limit) || 50 });
    res.json({ items });
  } catch (e) { next(e); }
});

router.post('/:id/messages', requireAgent, async (req, res, next) => {
  try {
    const data = await appendMessage(req.orgId, req.params.id, 'agent', req.body);
    getIO().to(`conv:${req.params.id}`).emit('message:new', { conversationId: req.params.id, data });
    res.json({ data });
  } catch (e) { next(e); }
});

export default router;
