// backend/routes/inbox.js
import { Router } from 'express';
import {
  listConversationsRepo,
  getMessagesRepo,
  markConversationReadRepo,
  getClientRepo,
  upsertClientRepo,
  createMessageRepo,
} from '../repos/inbox.repo.js';

const r = Router();

/**
 * GET /api/inbox/conversations
 * Query:
 *  - status: 'open' | 'closed' | ...
 *  - channel: 'whatsapp' | ...
 *  - tags: csv ex: vip,novo
 *  - q: busca por nome do cliente
 *  - limit: número (default 50)
 *  - cursor: (reservado p/ paginação futura)
 */
r.get('/conversations', async (req, res, next) => {
  try {
    const { status, channel, tags, q, limit, cursor } = req.query;
    const data = await listConversationsRepo({
      status,
      channel,
      tags,
      q,
      limit: Number(limit) || 50,
      cursor,
    });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/inbox/conversations/:id/read
 * Zera não lidas da conversa
 */
r.put('/conversations/:id/read', async (req, res, next) => {
  try {
    const { id } = req.params;
    const out = await markConversationReadRepo({ conversation_id: id });
    res.json(out);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/inbox/conversations/:id/messages?limit=50
 * Lista mensagens da conversa (ASC por created_at)
 */
r.get('/conversations/:id/messages', async (req, res, next) => {
  try {
    const { id } = req.params;
    const limit = Number(req.query.limit) || 50;
    const data = await getMessagesRepo({ conversation_id: id, limit });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/inbox/conversations/:id/client
 * Retorna o cliente vinculado à conversa
 */
r.get('/conversations/:id/client', async (req, res, next) => {
  try {
    const { id } = req.params;
    const client = await getClientRepo({ conversation_id: id });
    res.json(client || {});
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/inbox/conversations/:id/client
 * Atualiza campos do cliente da conversa
 * Body: { name?, birthdate?, notes?, tags?[] }
 */
r.put('/conversations/:id/client', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, birthdate, notes, tags } = req.body || {};

    const updates = {};
    if (typeof name === 'string' && name.trim()) updates.name = name.trim();
    if (typeof notes === 'string') updates.notes = notes;
    if (typeof birthdate === 'string') {
      const bd = birthdate.includes('/')
        ? birthdate.split('/').reverse().join('-')
        : birthdate;
      if (!Number.isNaN(Date.parse(bd))) updates.birthdate = bd;
    }
    if (tags != null) {
      const arr = Array.isArray(tags)
        ? tags
        : String(tags)
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
      if (arr.length) updates.tags = arr;
    }

    const updated = await upsertClientRepo({ conversation_id: id, updates });
    res.json({ ok: true, client: updated });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/inbox/messages
 * Envia mensagem de saída
 * Body: { conversationId, text, direction?='out' }
 * Obs: uploads multipart podem ser tratados em outra rota; aqui focamos JSON
 */
r.post('/messages', async (req, res, next) => {
  try {
    const { conversationId, text, direction } = req.body || {};
    if (!conversationId) {
      return res.status(400).json({ error: 'conversationId required' });
    }
    const dir = (direction || 'out').toLowerCase();
    const mapped = dir === 'out' ? 'outbound' : dir === 'in' ? 'inbound' : dir;
    const msg = await createMessageRepo({
      conversation_id: conversationId,
      text: text ?? '',
      direction: mapped,
      sender: 'agent',
      // author_id vem do token no repo? lá usamos default 'me'; se quiser, passe req.user.sub:
      // author_id: req.user?.id || 'me'
    });

    const io = req.app.get('io');
    if (io) io.to(`conv:${conversationId}`).emit('inbox:message:new', msg);

    res.status(201).json(msg);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/inbox/templates
 * (stub simples para evitar 404 no frontend; ajuste se tiver tabela real)
 */
r.get('/templates', (_req, res) => {
  res.json([
    { id: 't-1', label: 'Saudação', text: 'Olá! Como posso te ajudar?' },
    { id: 't-2', label: 'Agradecimento', text: 'Obrigado pelo contato! 😊' },
  ]);
});

export default r;
