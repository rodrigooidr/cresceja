// backend/controllers/inboxExtraController.js
import { pool } from '../config/db.js';
import { io } from '../services/realtime.js';

export async function markRead(req, res) {
  const { id } = req.params;
  await pool.query(`
    UPDATE conversations SET unread_count=0 WHERE id=$1 AND org_id=current_setting('app.org_id')::uuid
  `, [id]);
  io.to(`conv:${req.orgId}:${id}`).emit('conversation:read', { conversationId: Number(id) });
  res.json({ ok: true });
}
