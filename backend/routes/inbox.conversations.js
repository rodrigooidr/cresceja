import express from 'express';
import multer from 'multer';

const upload = multer({ storage: multer.memoryStorage() });
const router = express.Router();

// GET /api/inbox/conversations
router.get('/inbox/conversations', async (req, res, next) => {
  try {
    const { q, status, channel, tag } = req.query; // tag pode vir como array
    const rows = await req.db.listConversations({ q, status, channel, tags: tag });
    res.json(rows);
  } catch (e) { next(e); }
});

// GET /api/inbox/conversations/:id/messages
router.get('/inbox/conversations/:id/messages', async (req, res, next) => {
  try {
    const messages = await req.db.listMessages(req.params.id, { limit: req.query.limit || 200 });
    res.json(messages);
  } catch (e) { next(e); }
});

// POST /api/inbox/conversations/:id/messages
router.post('/inbox/conversations/:id/messages', async (req, res, next) => {
  try {
    const { text, attachments } = req.body;
    const msg = await req.db.createMessage({
      conversation_id: req.params.id,
      text: text || null,
      attachments: attachments || [],
      author: 'agent',
      direction: 'outbound'
    });
    req.io?.to(`conv:${req.params.id}`).emit('inbox:message:new', { conversation_id: req.params.id, message: msg });
    res.json(msg);
  } catch (e) { next(e); }
});

// POST /api/inbox/conversations/:id/read
router.post('/inbox/conversations/:id/read', async (req, res, next) => {
  try {
    await req.db.markConversationRead(req.params.id);
    req.io?.emit('inbox:conversation:update', { id: req.params.id, unread_count: 0 });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// PUT /api/inbox/conversations/:id/status
router.put('/inbox/conversations/:id/status', async (req, res, next) => {
  try {
    const { status } = req.body;
    await req.db.setConversationStatus(req.params.id, status);
    req.io?.emit('inbox:conversation:update', { id: req.params.id, status });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// PUT /api/inbox/conversations/:id/tags
router.put('/inbox/conversations/:id/tags', async (req, res, next) => {
  try {
    const { tags = [] } = req.body;
    await req.db.setConversationTags(req.params.id, tags);
    req.io?.emit('inbox:conversation:update', { id: req.params.id, tags });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// POST /api/inbox/conversations/:id/attachments
router.post('/inbox/conversations/:id/attachments', upload.array('files[]'), async (req, res, next) => {
  try {
    const assets = await req.db.saveAssets(req.params.id, req.files);
    res.json({ assets });
  } catch (e) { next(e); }
});

// Client details
router.get('/inbox/conversations/:id/client', async (req, res, next) => {
  try {
    const client = await req.db.getClientByConversation(req.params.id);
    res.json(client);
  } catch (e) { next(e); }
});

router.put('/inbox/conversations/:id/client', async (req, res, next) => {
  try {
    const { birthdate, extra_info, tags } = req.body;
    const client = await req.db.updateClientByConversation(req.params.id, { birthdate, extra_info, tags });
    res.json(client);
  } catch (e) { next(e); }
});

// Templates
router.get('/inbox/templates', async (req, res, next) => {
  try {
    const rows = await req.db.listTemplates(req.user.id);
    res.json(rows);
  } catch (e) { next(e); }
});

// IA toggle
router.put('/inbox/conversations/:id/ai', async (req, res, next) => {
  try {
    const { enabled } = req.body;
    const val = await req.db.setConversationAI(req.params.id, !!enabled);
    req.io?.emit('inbox:conversation:update', { id: req.params.id, ai_enabled: !!enabled });
    res.json({ ai_enabled: !!val });
  } catch (e) { next(e); }
});

export default router;

