import { Router } from 'express';
import { z } from 'zod';
import { requireRole } from '../../middleware/requireRole.js';
import { getPlanFeatures, upsertPlanFeatures } from '../../services/plans.js';
import { query as rootQuery } from '#db';

const router = Router();

router.use(requireRole('SuperAdmin','Support'));

function q(req) {
  const db = req.db;
  return db && db.query ? (sql, params) => db.query(sql, params) : (sql, params) => rootQuery(sql, params);
}

router.get('/', async (req, res, next) => {
  try {
    const { rows } = await q(req)(`SELECT id, name FROM plans ORDER BY sort_order, id`);
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

router.get('/:id/features', async (req, res, next) => {
  try {
    const planId = req.params.id;
    const rows = await getPlanFeatures(planId, req.db);
    const items = rows.map(r => ({
      code: r.code,
      label: r.label,
      type: r.type,
      unit: r.unit,
      category: r.category,
      value: r.type === 'boolean'
        ? { enabled: r.enabled }
        : { limit: r.limit }
    }));
    res.json(items);
  } catch (e) {
    next(e);
  }
});

router.put('/:id/features', async (req, res, next) => {
  try {
    const schema = z.object({ features: z.record(z.any()) });
    const { features } = schema.parse(req.body || {});
    const codes = Object.keys(features);
    if (codes.length === 0) return res.json({ ok: true });
    const { rows: defs } = await q(req)(
      'SELECT code, type FROM feature_defs WHERE code = ANY($1)',
      [codes]
    );
    const defsMap = Object.fromEntries(defs.map(d => [d.code, d]));
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
          return res.status(422).json({ error: 'validation', details: [{ code, message: 'limit_invalid' }] });
        }
        parsed[code] =
          limit === 0
            ? { enabled: false, limit: 0 }
            : limit === null
              ? { enabled: true }
              : { enabled: true, limit };
      } else if (def.type === 'boolean') {
        if (typeof val.enabled !== 'boolean') {
          return res.status(422).json({ error: 'validation', details: [{ code, message: 'enabled_invalid' }] });
        }
        parsed[code] = { enabled: val.enabled };
      } else {
        return res.status(422).json({ error: 'unsupported_type', code });
      }
    }
    await upsertPlanFeatures(req.params.id, parsed, req.db);
    res.json({ ok: true });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return res.status(422).json({ error: 'validation', details: e.errors });
    }
    next(e);
  }
});

export default router;
