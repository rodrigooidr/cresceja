import { pool } from '#db';

const SQL_LAST_IMPORT_RUN = `
  SELECT *
  FROM meta_import_runs
  WHERE org_id = $1 AND account_id = $2
  ORDER BY started_at DESC NULLS LAST, created_at DESC NULLS LAST
  LIMIT 1
`;

function parseMaybeJson(value) {
  if (value == null) return value;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function normalizeRow(row) {
  if (!row) return null;
  const normalized = { ...row };
  const stats =
    parseMaybeJson(row.stats_json ?? row.stats ?? row.metadata ?? row.details ?? null) ?? null;
  if (stats !== null) {
    normalized.stats = stats;
    if ('stats_json' in normalized) normalized.stats_json = stats;
    if ('metadata' in normalized) normalized.metadata = stats;
    if ('details' in normalized) normalized.details = stats;
  }
  return normalized;
}

export async function getLastImportRun(orgId, accountId) {
  if (!orgId || !accountId) return null;
  try {
    const { rows } = await pool.query(SQL_LAST_IMPORT_RUN, [orgId, accountId]);
    return normalizeRow(rows?.[0]) || null;
  } catch (err) {
    return null;
  }
}

export default { getLastImportRun };
