// controllers/auditController.js
// Funções de auditoria com consultas simples ao banco

import { query } from '../config/db.js';

/**
 * Retorna os logs de auditoria mais recentes
 */
export async function getLogs(_req, res) {
  try {
    const { rows } = await query(
      'SELECT id, user_id, action, target_type, target_id, meta, created_at\n       FROM audit_logs\n       ORDER BY created_at DESC\n       LIMIT 50'
    );
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: 'internal_error', message: err.message });
  }
}

/**
 * Retorna uso agregado de IA por serviço
 */
export async function getIaUsage(req, res) {
  try {
    const userId = req.user?.id;
    const sql =
      'SELECT service, SUM(tokens) AS tokens\n       FROM ai_usage_logs' +
      (userId ? ' WHERE user_id = $1' : '') +
      ' GROUP BY service\n       ORDER BY service';
    const params = userId ? [userId] : [];
    const { rows } = await query(sql, params);
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: 'internal_error', message: err.message });
  }
}

/**
 * Retorna atividades do usuário autenticado
 */
export async function getActivityLog(req, res) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const { rows } = await query(
      'SELECT id, action, target_type, target_id, meta, created_at\n       FROM audit_logs\n       WHERE user_id = $1\n       ORDER BY created_at DESC\n       LIMIT 50',
      [userId]
    );
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: 'internal_error', message: err.message });
  }
}

