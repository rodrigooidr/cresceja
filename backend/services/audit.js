import { query as rootQuery } from '#db';

export const HEADERS = [
  'id',
  'org_id',
  'user_id',
  'user_email',
  'action',
  'entity',
  'entity_id',
  'created_at',
];

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

const getQuery = (db) => {
  if (db && typeof db.query === 'function') {
    return (text, params) => db.query(text, params);
  }
  return (text, params) => rootQuery(text, params);
};

function serializePayload(payload) {
  if (payload == null) return null;
  if (typeof payload === 'string') return payload;
  try {
    return JSON.stringify(payload);
  } catch (_err) {
    return String(payload);
  }
}

export async function auditLog(db, params = {}) {
  const query = getQuery(db);
  const {
    orgId,
    org_id,
    userId,
    user_id,
    user_email,
    userEmail,
    action,
    entity,
    entityId,
    entity_id,
    payload,
  } = params || {};

  if (!action) return;

  const orgValue = orgId ?? org_id ?? null;
  const userValue = userId ?? user_id ?? null;
  const entityValue = entity ?? null;
  const entityIdValue = entityId ?? entity_id ?? null;
  const payloadValue = serializePayload(payload);

  if (orgValue != null || userValue != null) {
    await query(
      `INSERT INTO audit_logs (org_id, user_id, action, entity, entity_id, payload)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [orgValue, userValue, action, entityValue, entityIdValue, payloadValue]
    );
    return;
  }

  await query(
    `INSERT INTO audit_logs (user_email, action, entity, entity_id, payload)
     VALUES ($1,$2,$3,$4,$5)`,
    [user_email ?? userEmail ?? null, action, entityValue, entityIdValue, payloadValue]
  );
}

export default { auditLog, toCsv };
