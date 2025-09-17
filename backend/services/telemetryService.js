// backend/services/telemetryService.js
import { query as rootQuery } from '#db';

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
 * Insere um evento de telemetria na tabela append-only telemetry_events.
 * A função é resiliente a ausência do flag TELEMETRY_ENABLED (default true)
 * e aceita ser chamada tanto com client transacional (req.db) quanto com pool.
 */
export async function logTelemetry(db, { orgId, userId, source, eventKey, valueNum = null, metadata = {} }) {
  if (!telemetryEnabled()) return;
  if (!orgId || !source || !eventKey) return;

  const run = getRunner(db);
  await run(
    `INSERT INTO public.telemetry_events (org_id, user_id, source, event_key, value_num, metadata)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [orgId, userId ?? null, source, eventKey, valueNum, metadata]
  );
}

export default {
  logTelemetry,
};
