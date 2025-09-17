// backend/services/telemetryService.js
import { query as rootQuery } from '#db';
import Audit, { auditLog as auditLogNamed } from './audit.js';

const STORAGE_MODE = (() => {
  const value = (process.env.TELEMETRY_STORAGE || 'audit').toLowerCase();
  return value === 'table' ? 'table' : 'audit';
})();

const auditLogFn =
  typeof auditLogNamed === 'function'
    ? auditLogNamed
    : typeof Audit?.auditLog === 'function'
    ? Audit.auditLog
    : null;

function getRunner(db) {
  if (db && typeof db.query === 'function') {
    return (text, params) => db.query(text, params);
  }
  return (text, params) => rootQuery(text, params);
}

function telemetryEnabled() {
  const flag = process.env.TELEMETRY_ENABLED;
  if (flag === undefined) return true;
  return flag === 'true' || flag === '1' || flag === 'yes';
}

/**
 * Registra um evento de telemetria.
 * Sempre audita no append-only audit_logs e, opcionalmente, replica na tabela
 * telemetry_events quando TELEMETRY_STORAGE=table.
 * A função é resiliente à ausência do flag TELEMETRY_ENABLED (default true)
 * e aceita ser chamada tanto com client transacional (req.db) quanto com pool.
 */
export async function logTelemetry(
  db,
  { orgId, userId, source, eventKey, valueNum = null, metadata = {} } = {}
) {
  if (!telemetryEnabled()) return;
  if (!orgId || !source || !eventKey) return;

  const normalizedMeta = {
    orgId,
    userId: userId ?? null,
    source,
    eventKey,
    valueNum,
    metadata: metadata ?? {},
  };

  if (auditLogFn) {
    await auditLogFn(db, {
      user_email: null,
      action: eventKey,
      entity: 'telemetry',
      entity_id: orgId,
      payload: normalizedMeta,
    });
  }

  if (STORAGE_MODE === 'table') {
    const run = getRunner(db);
    try {
      await run(
        `INSERT INTO public.telemetry_events (org_id, user_id, source, event_key, value_num, metadata)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [orgId, userId ?? null, source, eventKey, valueNum, normalizedMeta.metadata]
      );
    } catch (_err) {
      // ignore insert errors when table storage is optional
    }
  }
}

export default {
  logTelemetry,
};
