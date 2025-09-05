import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  listConversationsRepo, getMessagesRepo, markConversationReadRepo,
  getClientRepo, upsertClientRepo, createMessageRepo
} from '../repos/inbox.repo.js';

const r = Router();
r.use(requireAuth);

// GET /api/inbox/conversations
r.get('/conversations', async (req, res, next) => {
  try {
    const { status, channel, tags, q, limit, cursor } = req.query;
    const data = await listConversationsRepo({
      org_id: req.user.org_id, status, channel, tags, q, limit: Number(limit)||50, cursor
    });
    res.json(data);
  } catch (e) { next(e); }
});

// PUT /api/inbox/conversations/:id/read
r.put('/conversations/:id/read', async (req, res, next) => {
  try {
    const data = await markConversationReadRepo({
      org_id: req.user.org_id, conversation_id: req.params.id
    });
    res.json(data);
  } catch (e) { next(e); }
});

// GET /api/inbox/conversations/:id/messages
r.get('/conversations/:id/messages', async (req, res, next) => {
  try {
    const data = await getMessagesRepo({
      org_id: req.user.org_id, conversation_id: req.params.id, limit: Number(req.query.limit)||50
    });
    res.json(data);
  } catch (e) { next(e); }
});

// GET /api/inbox/conversations/:id/client
r.get('/conversations/:id/client', async (req, res, next) => {
  try {
    const client = await getClientRepo({
      org_id: req.user.org_id, conversation_id: req.params.id
    });
    res.json(client || {});
  } catch (e) { next(e); }
});

// PUT /api/inbox/conversations/:id/client
r.put('/conversations/:id/client', async (req, res, next) => {
  try {
    const { name, birthdate, notes, tags } = req.body || {};
    const c = await upsertClientRepo({
      org_id: req.user.org_id, conversation_id: req.params.id, name, birthdate, notes, tags
    });
    res.json({ id: req.params.id, client: c });
  } catch (e) { next(e); }
});

// POST /api/inbox/messages
r.post('/messages', async (req, res, next) => {
  try {
    const { conversationId, text, direction } = req.body || {};
    const msg = await createMessageRepo({
      org_id: req.user.org_id, conversation_id: conversationId, text, direction: direction || 'out', author_id: req.user.id || 'me'
    });
    res.status(201).json(msg);
  } catch (e) { next(e); }
});

export default r;
