import { pool } from '#db';
import { isUuid } from '../utils/isUuid.js';

const isProd = String(process.env.NODE_ENV) === 'production';

const pick = (value) => {
  if (value == null) return '';
  return String(value).trim().toLowerCase();
};

function setOrgOnRequest(req, orgId) {
  const value = orgId != null && orgId !== '' ? String(orgId) : null;
  if (!req.org || typeof req.org !== 'object') {
    req.org = {};
  }
  req.org.id = value;
  req.orgId = value;
  req.orgResolved = value;
}

function collectOrgCandidates(req) {
  return [
    { source: 'header', value: req.get?.('x-org-id') ?? req.headers?.['x-org-id'] },
    { source: 'query', value: req.query?.orgId ?? req.query?.org_id ?? req.query?.org },
    { source: 'path', value: req.params?.orgId ?? req.params?.org_id ?? req.params?.id },
    { source: 'cookie', value: req.cookies?.orgId ?? req.cookies?.org_id ?? null },
    {
      source: 'token',
      value: req.orgFromToken ?? req.user?.org_id ?? req.user?.orgId ?? null,
    },
  ];
}

export function withOrg(req, res, next) {
  const candidates = collectOrgCandidates(req);
  const normalized = candidates
    .map(({ source, value }) => ({ source, value, normalized: pick(value) }))
    .filter((item) => item.normalized);
  const uniq = [...new Set(normalized.map((item) => item.normalized))];

  const resolvedNormalized = uniq[0] || null;
  const resolvedRaw = resolvedNormalized
    ? normalized.find((item) => item.normalized === resolvedNormalized)?.value ?? resolvedNormalized
    : null;

  setOrgOnRequest(req, resolvedRaw);

  if (!isProd && process.env.DEBUG_ORG === '1') {
    try {
      // eslint-disable-next-line no-console
      console.log('[withOrg]', {
        sources: candidates.reduce((acc, { source, value }) => {
          acc[source] = value ?? null;
          return acc;
        }, {}),
        resolved: resolvedRaw || null,
        normalized: uniq,
      });
    } catch {}
  }

  if (!uniq.length) {
    if (!isProd) {
      setOrgOnRequest(req, null);
      return next();
    }
    return res.status(403).json({ error: 'ORG_REQUIRED' });
  }

  if (uniq.length > 1 && isProd) {
    return res.status(403).json({ error: 'ORG_MISMATCH' });
  }

  setOrgOnRequest(req, resolvedRaw);
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
