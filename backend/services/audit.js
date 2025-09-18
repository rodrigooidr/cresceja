// backend/services/audit.js
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
  } catch {
    // fallback super defensivo
    try {
      return JSON.stringify(String(payload));
    } catch {
      return String(payload);
    }
  }
}

/**
 * Registra um evento de auditoria.
 * Aceita aliases para maior tolerância:
 * - orgId | org_id
 * - userId | user_id
 * - userEmail | user_email
 * - entityId | entity_id | target_id
 * - entity | target_type | targetType
 * - payload | meta
 */
export async function auditLog(db, params = {}) {
  const query = getQuery(db);

  const {
    orgId, org_id,
    userId, user_id,
    userEmail, user_email,
    action,
    entity, target_type, targetType,
    entityId, entity_id, target_id,
    payload, meta,
  } = params || {};

  if (!action) return; // no-op se não houver ação

  const orgValue = orgId ?? org_id ?? null;
  const userValue = userId ?? user_id ?? null;
  const emailValue = user_email ?? userEmail ?? null;

  const entityValue = entity ?? target_type ?? targetType ?? null;
  const entityIdValue = entityId ?? entity_id ?? target_id ?? null;

  // payload pode vir de payload ou meta
  const payloadValue = serializePayload(payload ?? meta ?? null);

  // Preferimos (org_id, user_id). Se não houver, gravamos via user_email.
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
    [emailValue, action, entityValue, entityIdValue, payloadValue]
  );
}

export default { auditLog, toCsv };
