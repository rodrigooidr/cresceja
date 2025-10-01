const DEFAULT_TABLE = 'integration_audit_logs';

export function createIntegrationAuditor({ db, logger } = {}) {
  const log = logger || console;
  const query = db?.query?.bind(db) || db?.query || null;

  return async function recordIntegrationLog(orgId, provider, action, result, meta = {}) {
    const entry = {
      org_id: orgId,
      provider,
      action,
      result,
      meta,
      timestamp: new Date().toISOString(),
    };

    try {
      log?.info?.({ event: 'integration_audit', ...entry });
    } catch (err) {
      try {
        console.info('[integration_audit]', entry); // eslint-disable-line no-console
      } catch {}
    }

    if (!query) return;

    try {
      await query(
        `INSERT INTO ${DEFAULT_TABLE}
          (org_id, provider, action, result, meta, created_at)
        VALUES ($1, $2, $3, $4, $5::jsonb, now())`,
        [orgId, provider, action, result, JSON.stringify(meta ?? {})]
      );
    } catch (err) {
      log?.warn?.({ event: 'integration_audit_store_failed', error: err?.message, provider, action });
    }
  };
}

export default createIntegrationAuditor;
