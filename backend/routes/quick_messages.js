import express from 'express';
import { query } from '../config/db.js';
import { getRedis } from '../config/redis.js';
import jwt from 'jsonwebtoken';
import { Queue } from 'bullmq';

const router = express.Router();
const redis = getRedis();
const alertQueue = new Queue('alerts', { connection: redis });

function auth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
  if (!token) return res.status(401).json({ error: 'missing_token' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET || 'segredo');
    next();
  } catch (e) {
    return res.status(401).json({ error: 'invalid_token' });
  }
}

// Lista rápidas
router.get('/', auth, async (req, res) => {
  const companyId = req.user.company_id;
  const key = `quickmsg:${companyId}`;
  try {
    const cached = await redis.get(key);
    if (cached) return res.json(JSON.parse(cached));
    const { rows } = await query('SELECT id, text FROM quick_messages WHERE company_id=$1 ORDER BY updated_at DESC', [companyId]);
    await redis.set(key, JSON.stringify(rows), 'EX', 60);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'failed_fetch', details: e.message });
  }
});

// Cria rápida
router.post('/', auth, async (req, res) => {
  const companyId = req.user.company_id;
  const { text } = req.body || {};
  if (!text) return res.status(400).json({ error: 'missing_text' });
  try {
    await query('INSERT INTO quick_messages (company_id, text) VALUES ($1,$2)', [companyId, text]);
    await redis.del(`quickmsg:${companyId}`);
    await alertQueue.add('quickmsg', { companyId, action: 'create' });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'failed_create', details: e.message });
  }
});

// Atualiza rápida
router.put('/:id', auth, async (req, res) => {
  const companyId = req.user.company_id;
  const { id } = req.params;
  const { text } = req.body || {};
  try {
    await query('UPDATE quick_messages SET text=$1, updated_at=NOW() WHERE id=$2 AND company_id=$3', [text, id, companyId]);
    await redis.del(`quickmsg:${companyId}`);
    await alertQueue.add('quickmsg', { companyId, action: 'update' });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'failed_update', details: e.message });
  }
});

export default router;
