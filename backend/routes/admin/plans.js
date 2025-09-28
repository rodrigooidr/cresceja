import { Router } from 'express';
import { z } from 'zod';
import { query as rootQuery } from '#db';
import { auth as authRequired } from '../../middleware/auth.js';
import { requireGlobalRole } from '../../middleware/requireRole.js';
import { getPlanFeatures, upsertPlanFeatures } from '../../services/plans.js';

const router = Router();

function getQuery(req) {
  const db = req.db;
  if (db && typeof db.query === 'function') {
    return (sql, params) => db.query(sql, params);
  }
  return (sql, params) => rootQuery(sql, params);
}

function normalizeEnumOptions(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed;
    } catch (err) {
      // ignore parsing errors, fallback to comma separated string
    }
    return trimmed
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

router.use(authRequired);
router.use(requireGlobalRole(['SuperAdmin', 'Support']));

router.get('/', async (req, res, next) => {
  try {
    const { rows } = await rootQuery(`
        SELECT
          id,
          id_legacy_text,
          name,
          monthly_price,
          currency,
          modules,
          is_published,
          is_active,
          price_cents,
          sort_order
        FROM public.plans
        ORDER BY
          COALESCE(sort_order, 9999) ASC,
          created_at ASC
      `);
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});

router.get('/:id/features', async (req, res, next) => {
  try {
    const features = await getPlanFeatures(req.params.id, req.db);
    res.json(features);
  } catch (err) {
    next(err);
  }
});

router.put('/:id/features', async (req, res, next) => {
  try {
    const schema = z.array(
      z.object({
        code: z.string().min(1),
        label: z.string().optional(),
        type: z.enum(['number', 'boolean', 'string', 'enum']),
        value: z.any(),
        options: z.any().optional(),
      })
    );

    const rawPayload = Array.isArray(req.body) ? req.body : req.body?.features;
    const parsedInput = schema.parse(rawPayload ?? []);
    if (!parsedInput.length) {
      return res.json({ ok: true });
    }

    const q = getQuery(req);
    const codes = parsedInput.map((item) => item.code);
    const { rows: defs } = await q(
      `SELECT code, type, enum_options
         FROM feature_defs
        WHERE code = ANY($1)`,
      [codes]
    );

    const defsMap = new Map(defs.map((item) => [item.code, item]));
    const validated = [];
    const details = [];

    for (const feature of parsedInput) {
      const def = defsMap.get(feature.code);
      if (!def) {
        return res.status(404).json({ error: 'feature_not_found', code: feature.code });
      }

      const type = def.type;
      if (!['number', 'boolean', 'string', 'enum'].includes(type)) {
        details.push({ code: feature.code, message: 'unsupported_type' });
        continue;
      }

      let value = feature.value;
      let options = normalizeEnumOptions(def.enum_options);

      if (type === 'number') {
        if (value === null || value === undefined || value === '') {
          details.push({ code: feature.code, message: 'required' });
          continue;
        }
        if (typeof value !== 'number' || Number.isNaN(value) || !Number.isFinite(value)) {
          details.push({ code: feature.code, message: 'invalid_number' });
          continue;
        }
      } else if (type === 'boolean') {
        if (typeof value !== 'boolean') {
          details.push({ code: feature.code, message: 'invalid_boolean' });
          continue;
        }
      } else if (type === 'string') {
        if (typeof value !== 'string') {
          details.push({ code: feature.code, message: 'invalid_string' });
          continue;
        }
      } else if (type === 'enum') {
        const incomingOptions = Array.isArray(feature.options)
          ? feature.options
          : options;
        options = normalizeEnumOptions(incomingOptions);
        if (!options.length) {
          details.push({ code: feature.code, message: 'enum_options_required' });
          continue;
        }
        if (typeof value !== 'string' || !options.includes(value)) {
          details.push({ code: feature.code, message: 'enum_invalid_value' });
          continue;
        }
      }

      validated.push({ code: feature.code, value });
    }

    if (details.length) {
      return res.status(422).json({ error: 'validation', details });
    }

    await upsertPlanFeatures(req.params.id, validated, req.db);
    res.json({ ok: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(422).json({ error: 'validation', details: err.errors });
    }
    next(err);
  }
});

export default router;
