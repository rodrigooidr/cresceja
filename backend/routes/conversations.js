import express from 'express';
import { pool } from '../config/db.js';
import jwt from 'jsonwebtoken';

const router = express.Router();

// Middleware simples de autenticação por JWT
function autenticar(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'Token ausente' });
  const token = auth.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'segredo');
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido' });
  }
}

// GET /api/conversations?status=pendente
// GET /api/conversations?assigned_to=me
router.get('/', autenticar, async (req, res) => {
  const { status, assigned_to } = req.query;

  let sql = 'SELECT * FROM conversations';
  const params = [];

  if (status) {
    sql += ' WHERE status = $1';
    params.push(status);
  } else if (assigned_to === 'me') {
    sql += ' WHERE assigned_to = $1';
    params.push(req.user.email);
  }

  sql += ' ORDER BY created_at DESC';

  try {
    const { rows } = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error('Erro ao buscar conversas:', err);
    res.status(500).json({ error: 'Erro ao buscar conversas' });
  }
});

// PUT /api/conversations/:id/assumir
router.put('/:id/assumir', autenticar, async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query(
      'UPDATE conversations SET assigned_to = $1, status = $2, updated_at = NOW() WHERE id = $3',
      [req.user.email, 'em_andamento', id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Erro ao assumir conversa:', err);
    res.status(500).json({ error: 'Erro ao assumir conversa' });
  }
});

// PUT /api/conversations/:id/encerrar
router.put('/:id/encerrar', autenticar, async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query(
      'UPDATE conversations SET status = $1, updated_at = NOW() WHERE id = $2',
      ['resolvido', id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Erro ao encerrar conversa:', err);
    res.status(500).json({ error: 'Erro ao encerrar conversa' });
  }
});

// GET /api/conversations/:id/messages
router.get('/:id/messages', autenticar, async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await pool.query(
      'SELECT * FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC',
      [id]
    );
    res.json(rows);
  } catch (err) {
    console.error('Erro ao buscar mensagens:', err);
    res.status(500).json({ error: 'Erro ao buscar mensagens' });
  }
});

// POST /api/conversations/:id/messages
router.post('/:id/messages', autenticar, async (req, res) => {
  const { id } = req.params;
  const { content, sender = 'agente' } = req.body;
  if (!content) return res.status(400).json({ error: 'Conteúdo obrigatório' });

  try {
    const { rows } = await pool.query(
      'INSERT INTO messages (conversation_id, sender, content) VALUES ($1, $2, $3) RETURNING *',
      [id, sender, content]
    );
    const msg = rows[0];
    const io = req.app.get('io');
    if (io) io.to(`conversation:${id}`).emit('message:new', msg);
    res.status(201).json(msg);
  } catch (err) {
    console.error('Erro ao criar mensagem:', err);
    res.status(500).json({ error: 'Erro ao criar mensagem' });
  }
});

export default router;

