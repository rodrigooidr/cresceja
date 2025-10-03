import { pool } from '#db';
import { isUuid } from '../utils/isUuid.js';

const isProd = String(process.env.NODE_ENV) === 'production';

const pick = (value) => {
  if (value == null) return '';
  return String(value).trim().toLowerCase();
};

const SOURCE_PRIORITY = [
  'path',
  'header',
  'query',
  'token',
  'cookie',
];

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
  const raw = {
    path: req.params?.orgId ?? req.params?.org_id ?? req.params?.id ?? null,
    header: req.get?.('x-org-id') ?? req.headers?.['x-org-id'] ?? null,
    query: req.query?.orgId ?? req.query?.org_id ?? req.query?.org ?? null,
    token: req.orgFromToken ?? req.user?.org_id ?? req.user?.orgId ?? null,
    cookie: req.cookies?.orgId ?? req.cookies?.org_id ?? req.cookies?.org ?? null,
  };

  return SOURCE_PRIORITY.map((source) => {
    const value = raw[source];
    return { source, value, normalized: pick(value) };
  });
}

function debugCandidates(candidates, resolved) {
  if (isProd || process.env.DEBUG_ORG !== '1') return;
  try {
    const sources = candidates.reduce((acc, item) => {
      acc[item.source] = item.value ?? null;
      return acc;
    }, {});
    // eslint-disable-next-line no-console
    console.log('[withOrg]', {
      sources,
      resolved: resolved?.value ?? null,
      normalized: candidates.filter((c) => c.normalized).map((c) => c.normalized),
    });
  } catch {}
}

export function withOrg(req, res, next) {
  const candidates = collectOrgCandidates(req);
  const nonEmpty = candidates.filter((item) => item.normalized);

  if (!nonEmpty.length) {
    debugCandidates(candidates, null);
    if (!isProd) {
      setOrgOnRequest(req, null);
      return next();
    }
    return res.status(403).json({ error: 'ORG_REQUIRED' });
  }

  const resolved = nonEmpty[0];
  const distinct = new Set(nonEmpty.map((item) => item.normalized));

  debugCandidates(candidates, resolved);

  if (distinct.size > 1) {
    if (isProd) {
      return res.status(403).json({ error: 'ORG_MISMATCH' });
    }
    try {
      // eslint-disable-next-line no-console
      console.warn('[withOrg:mismatch]', {
        candidates: nonEmpty.map((item) => ({ source: item.source, value: item.value })),
        resolved: resolved.value ?? null,
      });
    } catch {}
  }

  setOrgOnRequest(req, resolved.value);
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
