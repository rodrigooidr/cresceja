const express = require('express');
const router = express.Router();
const pool = require('../db');
const jwt = require('jsonwebtoken');

// Middleware para extrair user ID do token
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

// GET /conversations?status=pendente
router.get('/', autenticar, async (req, res) => {
  const { status, assigned_to } = req.query;

  let query = 'SELECT * FROM public.conversations';
  let params = [];

  if (status) {
    query += ' WHERE status = $1';
    params.push(status);
  } else if (assigned_to === 'me') {
    query += ' WHERE assigned_agent_id = $1';
    params.push(req.user.id);
  }

  query += ' ORDER BY created_at DESC';

  try {
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Erro ao buscar conversas:', err);
    res.status(500).json({ error: 'Erro ao buscar conversas' });
  }
});

// PUT /conversations/:id/assumir
router.put('/:id/assumir', autenticar, async (req, res) => {
  const { id } = req.params;

  try {
    await pool.query(
      'UPDATE public.conversations SET status = $1, assigned_agent_id = $2 WHERE id = $3',
      ['in_progress', req.user.id, id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Erro ao assumir conversa:', err);
    res.status(500).json({ error: 'Erro ao assumir conversa' });
  }
});

module.exports = router;