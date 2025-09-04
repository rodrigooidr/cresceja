import express, { Router } from 'express';
import multer from 'multer';

const r = Router();
const upload = multer();

// --- MOCK de mensagens em memória (troque pelo DB depois)
const MESSAGES = {
  'conv-1': [
    {
      id: 'm-1',
      conversationId: 'conv-1',
      text: 'Olá! Como posso ajudar?',
      direction: 'in',
      authorId: 'c-1',
      created_at: new Date(Date.now() - 3600e3).toISOString(),
    },
    {
      id: 'm-2',
      conversationId: 'conv-1',
      text: 'Quero saber sobre preços.',
      direction: 'in',
      authorId: 'c-1',
      created_at: new Date(Date.now() - 3500e3).toISOString(),
    },
  ],
};

r.get('/conversations', async (req, res) => {
  const { status, channel, tags, q, limit = 50 } = req.query;
  const items = [{
    id: 'conv-1',
    unread_count: 0,
    ai_enabled: false,
    client: { id: 'c-1', name: 'Cliente Teste' },
    last_message: {
      id: 'm-1',
      text: 'Olá!',
      direction: 'in',
      authorId: 'c-1',
      created_at: new Date().toISOString(),
    },
  }];
  res.json({ items, total: items.length });
});

r.put('/conversations/:id/read', (req, res) =>
  res.json({ ok: true, id: req.params.id })
);

// GET /api/inbox/conversations/:id/messages?limit=50&cursor=...
r.get('/conversations/:id/messages', (req, res) => {
  const { id } = req.params;
  const limit = Number(req.query.limit || 50);
  const all = MESSAGES[id] || [];
  const slice = all.slice(-limit);
  res.json({ items: slice, total: all.length });
});

r.get('/templates', (req, res) =>
  res.json([
    { id: 't-1', label: 'Saudação', text: 'Olá! Como posso te ajudar?' },
  ])
);

r.get('/conversations/:id/client', (req, res) =>
  res.json({ id: 'c-1', name: 'Cliente Teste', birthdate: null, notes: '', tags: [] })
);

r.put('/conversations/:id/client', express.json(), (req, res) => {
  const body = req.body || {};
  res.json({ id: req.params.id, client: { ...body } });
});

r.post('/messages', upload.any(), async (req, res) => {
  const isMultipart = req.is('multipart/form-data');
  let payload = {};
  if (isMultipart) {
    payload = {
      conversationId: req.body.conversationId,
      text: req.body.text || '',
    };
  } else {
    payload = req.body || {};
  }
  const { conversationId = 'conv-1', text = '' } = payload;

  const msg = {
    id: `m-${Date.now()}`,
    conversationId,
    text,
    direction: 'out',
    authorId: 'me',
    created_at: new Date().toISOString(),
  };

  MESSAGES[conversationId] = [...(MESSAGES[conversationId] || []), msg];
  // opcional: emitir em tempo real
  req.app.get('io')?.to(`conv:${conversationId}`).emit('inbox:message:new', msg);

  res.status(201).json(msg);
});

export default r;
