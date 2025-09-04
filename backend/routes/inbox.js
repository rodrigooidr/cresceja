import express, { Router } from 'express';
import multer from 'multer';

const r = Router();
const upload = multer();

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

r.put('/conversations/:id/read', (req, res) => res.json({ ok: true, id: req.params.id }));

r.get('/templates', (req, res) => res.json([]));

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
    const fd = req.body;
    payload = { conversationId: fd.conversationId, text: fd.text };
  } else {
    payload = req.body || {};
  }
  const msg = {
    id: 'm-out-1',
    conversationId: payload.conversationId || 'conv-1',
    text: payload.text || '',
    direction: 'out',
    authorId: 'me',
    created_at: new Date().toISOString(),
  };
  res.status(201).json(msg);
});

export default r;
