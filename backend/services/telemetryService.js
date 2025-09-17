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
  appointmentsOverview,
};

export async function appointmentsOverview({ from, to, orgId }) {
  if (!orgId) return [];
  const q = await rootQuery(
    `
      SELECT date_trunc('day', start_at) AS day,
             count(*) FILTER (WHERE rsvp_status = 'pending')   AS pending,
             count(*) FILTER (WHERE rsvp_status = 'confirmed') AS confirmed,
             count(*) FILTER (WHERE rsvp_status = 'canceled')  AS canceled,
             count(*) FILTER (WHERE rsvp_status = 'noshow')    AS noshow,
             SUM(CASE WHEN reminder_sent_at IS NOT NULL THEN 1 ELSE 0 END) AS reminded
        FROM public.calendar_events
       WHERE org_id = $1
         AND start_at BETWEEN $2 AND $3
       GROUP BY 1
       ORDER BY 1 ASC
    `,
    [orgId, from, to]
  );
  return q.rows || [];
}

export async function appointmentsFunnelByDay({ from, to, orgId }) {
  if (!orgId) return [];
  const result = await rootQuery(
    `
      SELECT date_trunc('day', start_at) AS day,
             count(*) AS requested,
             count(*) FILTER (WHERE rsvp_status = 'confirmed') AS confirmed,
             count(*) FILTER (WHERE rsvp_status = 'canceled')  AS canceled,
             count(*) FILTER (WHERE rsvp_status = 'noshow')    AS noshow
        FROM public.calendar_events
       WHERE org_id = $1 AND start_at BETWEEN $2 AND $3
       GROUP BY 1
       ORDER BY 1
    `,
    [orgId, from, to]
  );
  return result.rows || [];
}

export async function appointmentsByPersonService({ from, to, orgId }) {
  if (!orgId) return [];
  const result = await rootQuery(
    `
      SELECT calendar_id AS person,
             COALESCE(service_name, summary, 'Atendimento') AS service,
             count(*) FILTER (WHERE rsvp_status = 'confirmed') AS confirmed,
             count(*) FILTER (WHERE rsvp_status = 'canceled')  AS canceled,
             count(*) FILTER (WHERE rsvp_status = 'noshow')    AS noshow
        FROM public.calendar_events
       WHERE org_id = $1 AND start_at BETWEEN $2 AND $3
       GROUP BY 1, 2
       ORDER BY 1, 2
    `,
    [orgId, from, to]
  );
  return result.rows || [];
}
