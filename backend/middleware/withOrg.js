import { pool } from '#db';
import { isUuid } from '../utils/isUuid.js';

const isProd = String(process.env.NODE_ENV) === 'production';

function normalize(value) {
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed === '' ? null : trimmed;
}

function setOrgOnRequest(req, orgId) {
  if (!req.org || typeof req.org !== 'object') {
    req.org = { id: orgId ?? null };
  } else {
    req.org.id = orgId ?? null;
  }
  req.orgId = orgId ?? null;
}

export function withOrg(req, res, next) {
  const fromPath = normalize(req.params?.orgId ?? req.params?.id);
  const fromHeader = normalize(req.get?.('x-org-id') ?? req.headers?.['x-org-id']);
  const fromQuery = normalize(req.query?.orgId ?? req.query?.org_id ?? req.query?.org);
  const fromToken = normalize(req.user?.org_id ?? req.user?.orgId);

  const resolved =
    fromPath?.toLowerCase() ||
    fromHeader?.toLowerCase() ||
    fromQuery?.toLowerCase() ||
    fromToken?.toLowerCase() ||
    null;

  setOrgOnRequest(req, resolved);

  if (!isProd && process.env.DEBUG_ORG === '1') {
    // eslint-disable-next-line no-console
    console.log('[withOrg]', {
      path: fromPath || null,
      header: fromHeader || null,
      query: fromQuery || null,
      token: fromToken || null,
      resolved,
    });
  }

  const candidates = [fromPath, fromHeader, fromQuery, fromToken]
    .filter(Boolean)
    .map((value) => value.toLowerCase());

  const mismatch = candidates.length > 1 && new Set(candidates).size > 1;

  if (mismatch && isProd) {
    return res.status(403).json({ error: 'ORG_MISMATCH' });
  }

  if (!resolved) {
    if (!isProd) return next();
    return res.status(400).json({ error: 'ORG_REQUIRED' });
  }

  return next();
}

async function attachOrgScope(req, res, next) {
  const user = req.user || {};
  let orgId = req.org?.id ?? req.orgId;

  if (user.is_superadmin && req.headers?.['x-impersonate-org']) {
    orgId = String(req.headers['x-impersonate-org']).trim();
    setOrgOnRequest(req, orgId);
  }

  if (!isUuid(orgId)) {
    return res.status(400).json({ error: 'org_required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SET LOCAL app.org_id = $1', [orgId]);
    setOrgOnRequest(req, orgId);
    req.orgScopeValidated = true;
    req.db = client;

    const { rows } = await client.query(
      'SELECT role FROM org_users WHERE org_id = $1 AND user_id = $2',
      [orgId, user.id]
    );
    let role = rows[0]?.role || null;
    if (!role && user.is_superadmin) role = 'OrgOwner';
    req.orgRole = role;

    const cleanup = async (action) => {
      try {
        await client.query(action === 'commit' ? 'COMMIT' : 'ROLLBACK');
      } finally {
        client.release();
      }
    };
    res.once('finish', () => cleanup('commit'));
    res.once('close', () => cleanup('rollback'));
    next();
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {}
    client.release();
    next(err);
  }
}

export async function withOrgScope(req, res, next) {
  try {
    withOrg(req, res, (err) => {
      if (err) throw err;
    });
    if (res.headersSent) return;

    if (!req.org?.id && !isProd) {
      setOrgOnRequest(req, null);
      return next();
    }

    return attachOrgScope(req, res, next);
  } catch (err) {
    return next(err);
  }
}

export default withOrg;
