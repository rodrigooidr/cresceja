import { query } from '../config/db.js';

export async function auditLog({ user_email, action, entity, entity_id, payload }) {
  await query(
    `INSERT INTO audit_logs (user_email, action, entity, entity_id, payload)
     VALUES ($1,$2,$3,$4,$5)` ,
    [user_email, action, entity, entity_id || null, payload ? JSON.stringify(payload) : null]
  );
}
