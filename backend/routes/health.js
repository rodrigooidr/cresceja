import { Router } from 'express';

function normalizeDbConfig(config) {
  if (typeof config === 'function') {
    return normalizeDbConfig(config());
  }
  if (!config || typeof config !== 'object') {
    return {
      skip: false,
      reason: 'enabled',
      requested: false,
    };
  }
  return {
    skip: Boolean(config.skip),
    reason: config.reason || (config.skip ? 'skipped' : 'enabled'),
    requested: Boolean(config.requested),
  };
}

export function createHealthRouter({
  healthcheckFn = async () => true,
  getDbConfig = () => ({ skip: false, reason: 'enabled', requested: false }),
  service = 'cresceja-backend',
  now = () => new Date(),
  uptimeFn = () => process.uptime(),
} = {}) {
  const router = Router();

  router.get('/', async (_req, res) => {
    const timestamp = now();
    const uptime = uptimeFn();
    const dbConfig = normalizeDbConfig(getDbConfig);
    const dbCheck = {
      mode: dbConfig.reason,
      requestedSkip: dbConfig.requested,
    };

    if (dbConfig.skip) {
      dbCheck.status = 'skipped';
      return res.status(200).json({
        status: 'UP',
        summary: 'UP (db: skipped)',
        service,
        time: timestamp.toISOString(),
        uptime,
        checks: { db: dbCheck },
      });
    }

    try {
      await healthcheckFn();
      dbCheck.status = 'ok';
      return res.status(200).json({
        status: 'UP',
        summary: 'UP (db: ok)',
        service,
        time: timestamp.toISOString(),
        uptime,
        checks: { db: dbCheck },
      });
    } catch (err) {
      dbCheck.status = 'error';
      if (err?.message) {
        dbCheck.error = err.message;
      }
      return res.status(503).json({
        status: 'DOWN',
        summary: 'DOWN (db: error)',
        service,
        time: timestamp.toISOString(),
        uptime,
        checks: { db: dbCheck },
      });
    }
  });

  return router;
}

const defaultRouter = createHealthRouter();

export default defaultRouter;
