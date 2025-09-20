const TRUTHY = new Set(['1', 'true', 'yes', 'on']);

function toBool(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    return TRUTHY.has(value.trim().toLowerCase());
  }
  return false;
}

export function resolveDbHealthcheckConfig(env = process.env) {
  const nodeEnv = env.NODE_ENV ?? 'development';
  const requested = toBool(env.SKIP_DB_HEALTHCHECK);
  const canSkip = nodeEnv !== 'production';
  const skip = requested && canSkip;
  const reason = skip
    ? 'skipped'
    : requested && !canSkip
    ? 'ignored_in_production'
    : 'enabled';

  const summaryMap = {
    skipped: 'DB healthcheck: skipped',
    ignored_in_production: 'DB healthcheck: flag ignored (production)',
    enabled: 'DB healthcheck: enabled',
  };

  return {
    nodeEnv,
    requested,
    skip,
    reason,
    summary: summaryMap[reason] ?? 'DB healthcheck: enabled',
  };
}

export default {
  resolveDbHealthcheckConfig,
};
