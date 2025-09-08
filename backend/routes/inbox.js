// routes/inbox.js  (RLS-aware)
// Mantém:
//   GET  /api/inbox/conversations
//   GET  /api/inbox/conversations/:id/messages
//   POST /api/inbox/messages
//
// Correções:
// - usa req.db (transação do pgRlsContext) em vez de pool.query
// - org atual vem de current_setting('app.org_id', true)
// - evita usar org_id do token; RLS decide o escopo
// - filtros por org_id são opcionais e só com o org da sessão

import { Router } from 'express';
import multer from 'multer';
import { saveUpload } from '../services/storage.js';

const r = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

// Helpers que usam o client da transação (req.db)
async function currentOrgId(db) {
  const { rows } = await db.query(
    `SELECT current_setting('app.org_id', true) AS org_id`
  );
  return rows?.[0]?.org_id || null;
}

async function getResolvedSchema(db, table) {
  const q = await db.query(
    `SELECT n.nspname AS schema
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relname = $1 AND c.relkind IN ('r','p')
   ORDER BY (n.nspname = current_schema()) DESC
      LIMIT 1`,
    [table]
  );
  return q.rowCount ? q.rows[0].schema : 'public';
}

async function listColumns(db, table) {
  const schema = await getResolvedSchema(db, table);
  const cols = await db.query(
    `SELECT column_name
       FROM information_schema.columns
      WHERE table_name = $1 AND table_schema = $2`,
    [table, schema]
  );
  return new Set(cols.rows.map((r) => r.column_name));
}

async function touchConversation(db, conversationId) {
  const CC = await listColumns(db, 'conversations');
  const ups = [];
  if (CC.has('last_message_at')) ups.push('last_message_at = now()');
  if (CC.has('updated_at')) ups.push('updated_at = now()');
  if (!ups.length) return;
  await db.query(`UPDATE conversations SET ${ups.join(', ')} WHERE id = $1`, [
    conversationId,
  ]);
}

// ---------- GET /api/inbox/conversations
r.get('/conversations', async (req, res) => {
  const db = req.db;
  try {
    const qStatus = String(req.query.status || 'open').toLowerCase();
    const limitReq = parseInt(req.query.limit, 10);
    const limit = Number.isFinite(limitReq)
      ? Math.max(1, Math.min(200, limitReq))
      : 50;

    const orgId = await currentOrgId(db); // org da sessão RLS
    const CC = await listColumns(db, 'conversations');

    const conds = [];
    const params = [];
    let i = 1;

    // filtro por org_id só se a coluna existir (otimiza índice), usando o org do RLS
    if (CC.has('org_id') && orgId) {
      conds.push(`org_id = $${i++}`);
      params.push(orgId);
    }

    if (CC.has('status')) {
      if (['open', 'opened', 'aberta', 'abertas'].includes(qStatus))
        conds.push(`status = 'open'`);
      else if (['closed', 'fechada', 'fechadas'].includes(qStatus))
        conds.push(`status = 'closed'`);
    }

    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const orderCol = CC.has('updated_at')
      ? 'updated_at'
      : CC.has('created_at')
      ? 'created_at'
      : 'id';
    const sql = `SELECT * FROM conversations ${where} ORDER BY ${orderCol} DESC LIMIT ${limit}`;

    const { rows } = await db.query(sql, params);
    return res.status(200).json(rows || []);
  } catch (err) {
    console.error('GET /api/inbox/conversations failed:', err);
    return res
      .status(500)
      .json({ error: 'internal_error', detail: err?.message, code: err?.code });
  }
});

// ---------- GET /api/inbox/conversations/:id/messages
r.get('/conversations/:id/messages', async (req, res) => {
  const db = req.db;
  try {
    const conversationId = req.params.id;
    const limitReq = parseInt(req.query.limit, 10);
    const limit = Number.isFinite(limitReq)
      ? Math.max(1, Math.min(500, limitReq))
      : 50;

    // valida/obtém conversa sob RLS (se for de outra org, RLS oculta e rowCount=0)
    const conv = await db.query(
      `SELECT id, org_id FROM conversations
       WHERE id = $1
       LIMIT 1`,
      [conversationId]
    );
    if (!conv.rowCount)
      return res.status(404).json({ error: 'conversation_not_found' });

    const convOrgId = conv.rows[0].org_id;

    const MC = await listColumns(db, 'messages');
    const conds = ['conversation_id = $1'];
    const params = [conversationId];
    let i = 2;

    // filtro extra por org_id se existir a coluna (usa org da conversa)
    if (MC.has('org_id') && convOrgId) {
      conds.push(`org_id = $${i++}`);
      params.push(convOrgId);
    }

    const orderCol = MC.has('created_at')
      ? 'created_at'
      : MC.has('updated_at')
      ? 'updated_at'
      : 'id';

    const sql = `SELECT * FROM messages WHERE ${conds.join(' AND ')}
                 ORDER BY ${orderCol} ASC
                 LIMIT ${limit}`;
    const { rows } = await db.query(sql, params);

    // normaliza alguns campos para o frontend
    const mapped = rows.map((m) => {
      const out = { ...m };
      if (out.from == null && out.sender != null) out.from = out.sender;
      if (out.sender == null && out.from != null) out.sender = out.from;
      if (out.direction == null) {
        out.direction =
          out.from === 'agent' || out.sender === 'agent' ? 'outbound' : 'inbound';
      }
      return out;
    });

    return res.status(200).json({ items: mapped, total: mapped.length });
  } catch (err) {
    console.error('GET /api/inbox/conversations/:id/messages failed:', err);
    return res
      .status(500)
      .json({ error: 'internal_error', detail: err?.message, code: err?.code });
  }
});

// ---------- POST /api/inbox/messages
r.post('/messages', upload.single('file'), async (req, res) => {
  const db = req.db;
  try {
    const body = req.body || {};
    const conversationId = body.conversationId || body.conversation_id;
    const text = String(body.message ?? body.text ?? '').trim();
    const msgType = String(body.type || 'text');

    if (!conversationId && !text && !req.file)
      return res.status(400).json({ error: 'empty_payload' });

    // pega a conversa sob RLS (garante que pertence à org ativa)
    const conv = await db.query(
      `SELECT id, org_id FROM conversations
       WHERE id = $1
       LIMIT 1`,
      [conversationId]
    );
    if (!conv.rowCount)
      return res.status(404).json({ error: 'conversation_not_found' });
    const convOrgId = conv.rows[0].org_id;

    const MC = await listColumns(db, 'messages');

    const fields = [];
    const params = [];
    const values = [];
    let i = 1;
    const push = (col, val) => {
      fields.push(col);
      params.push(`$${i++}`);
      values.push(val);
    };

    if (MC.has('org_id')) push('org_id', convOrgId);
    push('conversation_id', conversationId);

    if (MC.has('provider')) push('provider', 'wa');
    if (MC.has('from')) push('"from"', 'agent');
    if (MC.has('type')) push('type', msgType);

    if (MC.has('direction')) push('direction', 'outbound');
    if (MC.has('sender')) push('sender', 'agent');
    if (MC.has('author_id')) push('author_id', req.user?.id || 'me');

    if (MC.has('text')) push('text', text);
    else if (MC.has('body')) push('body', text);
    else
      return res
        .status(500)
        .json({ error: 'messages_schema_unsupported_no_text' });

    const attachments = [];
    if (req.file) {
      try {
        const meta = await saveUpload({
          buffer: req.file.buffer,
          mime: req.file.mimetype,
          filename: req.file.originalname,
        });
        attachments.push({
          id: meta.key,
          url: meta.url,
          filename: meta.filename,
          mime: meta.mime,
        });
      } catch (e) {
        console.error('[inbox] attachment save failed:', e);
      }
    }
    if (attachments.length && MC.has('attachments'))
      push('attachments', JSON.stringify(attachments));

    const sql = `INSERT INTO messages (${fields.join(', ')})
                 VALUES (${params.join(', ')})
                 RETURNING *`;

    try {
      const { rows } = await db.query(sql, values);
      const inserted = rows[0];
      if (attachments.length && !inserted.attachments)
        inserted.attachments = attachments;

      await touchConversation(db, conversationId);

      try {
        const io = req.app?.get?.('io');
        if (io) io.to(`conv:${conversationId}`).emit('inbox:message:new', inserted);
      } catch {}

      return res.status(201).json(inserted);
    } catch (e) {
      console.error('[inbox] INSERT messages failed:', {
        sql,
        valuesPreview: values.map((v) =>
          typeof v === 'string' && v.length > 120 ? v.slice(0, 117) + '...' : v
        ),
      });
      throw e;
    }
  } catch (err) {
    console.error('POST /api/inbox/messages failed:', err);
    return res.status(500).json({
      error: 'internal_error',
      detail: err?.detail || err?.message,
      code: err?.code,
    });
  }
});

// Templates e respostas rápidas (placeholders)
r.get('/templates', async (_req, res) => res.status(200).json([]));
r.get('/quick-replies', async (_req, res) => res.status(200).json([]));

export default r;
