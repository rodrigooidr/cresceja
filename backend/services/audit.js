// services/audit.js
const DEFAULT_TABLE = 'integration_audit_logs';

/**
 * Factory que retorna uma função para registrar logs de auditoria de integrações.
 * Uso: const audit = createIntegrationAuditor({ db, logger }); await audit(orgId, provider, action, result, meta)
 */
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

    // Loga em console (ou logger injetado)
    try {
      // logger tipo pino: logger.info(obj)
      log?.info?.({ event: 'integration_audit', ...entry }) ?? log?.info?.('integration_audit', entry);
    } catch {
      try {
        console.info('[integration_audit]', entry); // eslint-disable-line no-console
      } catch {}
    }

    // Se não há db/query, apenas loga em console
    if (!query) return;

    try {
      await query(
        `INSERT INTO ${DEFAULT_TABLE}
           (org_id, provider, action, result, meta, created_at)
         VALUES ($1, $2, $3, $4, $5::jsonb, now())`,
        [orgId, provider, action, result, JSON.stringify(meta ?? {})]
      );
    } catch (err) {
      log?.warn?.({
        event: 'integration_audit_store_failed',
        error: err?.message,
        provider,
        action,
      });
    }
  };
}

/**
 * Classe default para compatibilidade com:
 *   import Audit, { auditLog as auditLogNamed } from './audit.js';
 *
 * Uso:
 *   const auditor = new Audit({ db, logger });
 *   await auditor.log(orgId, provider, action, result, meta);
 */
class Audit {
  constructor({ db, logger } = {}) {
    this._record = createIntegrationAuditor({ db, logger });
  }
  async log(orgId, provider, action, result, meta = {}) {
    return this._record(orgId, provider, action, result, meta);
  }
}
export default Audit;

/**
 * Named export exigido pelo import em telemetryService.js:
 *   import Audit, { auditLog as auditLogNamed } from './audit.js';
 *
 * Por padrão, usa apenas console (sem DB). Se quiser persistir no DB,
 * chame passando { db, logger } no último argumento:
 *   await auditLog(orgId, provider, action, result, meta, { db, logger });
 */
export async function auditLog(orgId, provider, action, result, meta = {}, opts = {}) {
  const record = createIntegrationAuditor(opts);
  return record(orgId, provider, action, result, meta);
}
