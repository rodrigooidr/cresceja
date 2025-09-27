import { Router } from 'express';
import { z } from 'zod';
import { query as rootQuery } from '#db';
import * as requireRoleModule from '../../middleware/requireRole.js';
import { upsertPlanFeatures } from '../../services/plans.js';

const baseRequireRole =
  requireRoleModule.requireRole ??
  requireRoleModule.default?.requireRole ??
  requireRoleModule.default ??
  requireRoleModule;

const requireGlobalRoleFn =
  requireRoleModule.requireGlobalRole ??
  requireRoleModule.default?.requireGlobalRole ??
  ((roles) => {
    const normalized = Array.isArray(roles) ? roles : [roles];
    return baseRequireRole(...normalized);
  });

const router = Router();

function getQuery(req) {
  const db = req.db;
  if (db && typeof db.query === 'function') {
    return (sql, params) => db.query(sql, params);
  }
  return (sql, params) => rootQuery(sql, params);
}

async function resolvePlanFeaturesMeta(q) {
  const tables = ['plan_features', 'plans_features'];
  for (const table of tables) {
    const { rows } = await q('SELECT to_regclass($1) AS oid', [`public.${table}`]);
    if (rows?.[0]?.oid) {
      const { rows: cols } = await q(
        `SELECT column_name
           FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = $1`,
        [table]
      );
      const columns = new Set(cols.map((c) => c.column_name));
      return { table, columns };
    }
  }
  return null;
}

function buildPlanFeaturesSelect(columns) {
  const parts = ['plan_id'];
  const hasFeatureCode = columns.has('feature_code');
  const hasCode = columns.has('code');
  if (hasFeatureCode && hasCode) {
    parts.push('COALESCE(feature_code, code) AS code');
  } else if (hasFeatureCode) {
    parts.push('feature_code AS code');
  } else if (hasCode) {
    parts.push('code');
  } else {
    parts.push('NULL::text AS code');
  }

  if (columns.has('type')) {
    parts.push('type');
  } else {
    parts.push('NULL::text AS type');
  }

  if (columns.has('value')) {
    parts.push('value');
  } else {
    parts.push('NULL::jsonb AS value');
  }

  return parts.join(',\n         ');
}

router.use(requireGlobalRoleFn(['SuperAdmin', 'Support']));

router.get('/', async (req, res, next) => {
  try {
    const q = getQuery(req);
    const { rows } = await q(
      `SELECT
         id,
         id_legacy_text AS slug,
         name,
         monthly_price,
         currency,
         modules,
         is_published,
         is_active,
         is_free,
         trial_days,
         billing_period_months,
         price_cents,
         sort_order,
         created_at,
         updated_at
       FROM public.plans
       ORDER BY sort_order NULLS LAST, name ASC`
    );
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});

router.get('/:id/features', async (req, res, next) => {
  try {
    const q = getQuery(req);
    const meta = await resolvePlanFeaturesMeta(q);
    if (!meta) {
      return res.json({ data: [] });
    }
    const selectClause = buildPlanFeaturesSelect(meta.columns);
    const { rows } = await q(
      `SELECT
         ${selectClause}
       FROM public.${meta.table}
       WHERE plan_id = $1
       ORDER BY code`,
      [req.params.id]
    );
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});

router.put('/:id/features', async (req, res, next) => {
  try {
    const schema = z.object({ features: z.record(z.any()) });
    const { features } = schema.parse(req.body || {});
    const codes = Object.keys(features);
    if (!codes.length) {
      return res.json({ ok: true });
    }

    const q = getQuery(req);
    const { rows: defs } = await q(
      'SELECT code, type FROM feature_defs WHERE code = ANY($1)',
      [codes]
    );
    const defsMap = Object.fromEntries(defs.map((d) => [d.code, d]));

    const parsed = {};
    for (const code of codes) {
      const def = defsMap[code];
      if (!def) {
        return res.status(404).json({ error: 'feature_not_found', code });
      }
      const val = features[code] || {};
      if (def.type === 'number') {
        const limit = val.limit ?? null;
        if (limit !== null && (!Number.isInteger(limit) || limit < 0)) {
          return res
            .status(422)
            .json({ error: 'validation', details: [{ code, message: 'limit_invalid' }] });
        }
        parsed[code] =
          limit === 0
            ? { enabled: false, limit: 0 }
            : limit === null
            ? { enabled: true }
            : { enabled: true, limit };
      } else if (def.type === 'boolean') {
        if (typeof val.enabled !== 'boolean') {
          return res
            .status(422)
            .json({ error: 'validation', details: [{ code, message: 'enabled_invalid' }] });
        }
        parsed[code] = { enabled: val.enabled };
      } else {
        return res.status(422).json({ error: 'unsupported_type', code });
      }
    }

    await upsertPlanFeatures(req.params.id, parsed, req.db);
    res.json({ ok: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(422).json({ error: 'validation', details: err.errors });
    }
    next(err);
  }
});

export default router;
