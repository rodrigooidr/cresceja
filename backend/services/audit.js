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

export async function auditLog(db, params = {}) {
  const {
    user_email,
    userEmail,
    userId,
    orgId,
    action,
    entity,
    entity_id,
    entityId,
    target_type,
    targetType,
    target_id,
    payload,
    meta,
  } = params;

  const email = user_email ?? userEmail ?? null;
  const targetEntity = entity ?? target_type ?? targetType ?? null;
  const targetId = entity_id ?? entityId ?? target_id ?? null;
  const basePayload = payload ?? meta ?? null;
  const finalPayload = basePayload ? { ...basePayload } : {};

  if (orgId && finalPayload.orgId == null) finalPayload.orgId = orgId;
  if (userId && finalPayload.userId == null) finalPayload.userId = userId;

  await q(db)(
    `INSERT INTO audit_logs (user_email, action, entity, entity_id, payload)
     VALUES ($1,$2,$3,$4,$5)` ,
    [
      email,
      action,
      targetEntity,
      targetId || null,
      Object.keys(finalPayload).length ? JSON.stringify(finalPayload) : null,
    ]
  );
}

export default { auditLog, toCsv };
