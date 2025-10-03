import { pool } from '#db';
import { isUuid } from '../utils/isUuid.js';

const isProd = String(process.env.NODE_ENV) === 'production';

const normalize = (value) => {
  if (value == null) return null;
  const str = String(value).trim();
  return str || null;
};

function setOrgOnRequest(req, orgId) {
  const value = normalize(orgId);
  if (value) {
    const current = typeof req.org === 'object' && req.org !== null ? req.org : {};
    req.org = { ...current, id: value };
  } else {
    req.org = null;
  }
  req.orgId = value || undefined;
  return value;
}

function resolveOrgId(req) {
  const fromPath = normalize(req.params?.orgId ?? req.params?.org_id ?? null);
  const fromHeader = normalize(req.get?.('x-org-id') ?? req.headers?.['x-org-id']);
  const fromQuery = normalize(req.query?.orgId ?? req.query?.org_id);
  const fromToken = normalize(req.user?.org_id ?? req.user?.orgId ?? req.orgFromToken);
  const fromCookie = normalize(req.cookies?.org_id ?? req.cookies?.orgId);

  return fromPath || fromHeader || fromQuery || fromToken || fromCookie || null;
}

export function withOrg(req, res, next) {
  const fromPath = normalize(req.params?.orgId ?? req.params?.org_id ?? null);
  const resolved = setOrgOnRequest(req, resolveOrgId(req));

  if (isProd) {
    if (!resolved) {
      return res
        .status(403)
        .json({ error: 'org_required', message: 'organization required' });
    }
    if (fromPath && resolved && fromPath.toLowerCase() !== resolved.toLowerCase()) {
      return res
        .status(403)
        .json({ error: 'org_mismatch', message: 'organization mismatch' });
    }
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
