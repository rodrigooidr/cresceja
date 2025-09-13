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
      value: { enabled: r.enabled, limit: r.limit }
    }));
    res.json(items);
  } catch (e) {
    next(e);
  }
});

router.put('/:id/features', async (req, res, next) => {
  try {
    const schema = z.object({
      features: z.record(
        z.object({
          enabled: z.boolean(),
          limit: z.number().int().min(0).nullable(),
        })
      )
    });
    const { features } = schema.parse(req.body || {});
    await upsertPlanFeatures(req.params.id, features, req.db);
    res.json({ ok: true });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return res.status(422).json({ error: 'validation', details: e.errors });
    }
    next(e);
  }
});

export default router;
