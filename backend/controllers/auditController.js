// controllers/auditController.js
import { query } from '../config/db.js';

export async function getLogs(req, res, next) {
  try {
    const { entity } = req.query || {};
    const params = [];
    let where = '';
    if (entity) {
      where = 'WHERE entity = $1';
      params.push(entity);
    }
    const { rows } = await query(
      `SELECT id, user_email, action, entity, entity_id, created_at, payload
         FROM audit_logs ${where}
        ORDER BY created_at DESC
        LIMIT 100`,
      params
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
}
