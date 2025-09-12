import { query as rootQuery } from '#db';

export const HEADERS = ['id', 'user', 'action', 'created_at'];

function quoted(v) {
  if (v == null) return '';
  const s = String(v).replace(/"/g, '""');
  return `"${s}"`;
}

export function toCsv(rows = []) {
  const head = HEADERS.join(',');
  const lines = rows.map((r) => HEADERS.map((k) => quoted(r[k])).join(','));
  return [head, ...lines].join('\n');
}

const q = (db) => (db && db.query) ? (t,p)=>db.query(t,p) : (t,p)=>rootQuery(t,p);

export async function auditLog(db, { user_email, action, entity, entity_id, payload }) {
  await q(db)(
    `INSERT INTO audit_logs (user_email, action, entity, entity_id, payload)
     VALUES ($1,$2,$3,$4,$5)` ,
    [user_email, action, entity, entity_id || null, payload ? JSON.stringify(payload) : null]
  );
}

export default { auditLog, toCsv };
