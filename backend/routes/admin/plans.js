import { Router } from 'express';
import { z } from 'zod';
import slugify from 'slugify';
import { randomBytes } from 'crypto';
import { query as rootQuery } from '#db';
import { auth as authRequired } from '../../middleware/auth.js';
import { requireGlobalRole } from '../../middleware/requireRole.js';
import { getPlanFeatures, upsertPlanFeatures } from '../../services/plans.js';

const router = Router();

function normalizePlan(row) {
  return {
    id: row.id,
    id_legacy_text: row.id_legacy_text ?? null,
    name: row.name,
    currency: row.currency ?? 'BRL',
    price_cents: Number(row.price_cents ?? 0),
    monthly_price: row.monthly_price ?? null,
    modules: row.modules ?? {},
    is_active: Boolean(row.is_active),
    is_published: Boolean(row.is_published),
    billing_period_months: Number(row.billing_period_months ?? 1),
    trial_days: Number(row.trial_days ?? 0),
    sort_order: row.sort_order ?? null,
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
  };
}

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

const SUPPORTED_CURRENCIES = new Set(['BRL', 'USD']);

function parseBRLToCents(input) {
  if (typeof input === 'number') return Math.round(input * 100);
  if (typeof input !== 'string') return null;
  const norm = input
    .replace(/\s/g, '')
    .replace(/^R\$/i, '')
    .replace(/\./g, '')
    .replace(',', '.');
  if (!norm) return 0;
  const num = Number(norm);
  if (!Number.isFinite(num)) return null;
  return Math.round(num * 100);
}

function makeLegacyId(name) {
  const slug = slugify(String(name || ''), { lower: true, strict: true, trim: true });
  if (slug && slug.length > 0) {
    return slug;
  }
  return `plan-${randomBytes(4).toString('hex')}`;
}

function parseCurrency(value, { required = false } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) throw new Error('currency_required');
    return undefined;
  }
  const normalized = String(value).trim().toUpperCase();
  if (!SUPPORTED_CURRENCIES.has(normalized)) {
    throw new Error('invalid_currency');
  }
  return normalized;
}

function parseCents(value, { required = false } = {}) {
  if (value === undefined) {
    if (required) throw new Error('price_required');
    return undefined;
  }
  if (value === null || value === '') {
    return null;
  }
  const normalized = typeof value === 'number' ? value : Number(String(value).replace(/[^0-9-]+/g, ''));
  if (!Number.isFinite(normalized)) throw new Error('invalid_price_cents');
  if (normalized < 0) throw new Error('invalid_price_cents');
  return Math.round(normalized);
}

function parseBoolean(value) {
  if (value === undefined) return undefined;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const trimmed = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'sim'].includes(trimmed)) return true;
    if (['false', '0', 'no', 'nao', 'não'].includes(trimmed)) return false;
  }
  throw new Error('invalid_boolean');
}

function parseQuota(value) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const numeric = typeof value === 'number' ? value : Number(String(value).replace(/[^0-9.,-]+/g, '').replace(',', '.'));
  if (!Number.isFinite(numeric) || numeric < 0) {
    throw new Error('invalid_ai_quota');
  }
  return numeric;
}

function normalizeFeatureValue(raw, def) {
  const type = def?.type;
  if (!type) return null;

  if (type === 'boolean') {
    if (raw.value_bool !== undefined) return Boolean(raw.value_bool);
    if (typeof raw.value === 'boolean') return raw.value;
    if (typeof raw.value === 'number') return raw.value !== 0;
    if (typeof raw.value === 'string') {
      return ['true', '1', 'yes', 'sim'].includes(raw.value.trim().toLowerCase());
    }
    return Boolean(raw.value);
  }

  if (type === 'number') {
    const source = raw.value_number ?? raw.value ?? null;
    if (source === null || source === undefined || source === '') return null;
    const numeric = typeof source === 'number' ? source : Number(String(source).replace(/[^0-9.,-]+/g, '').replace(',', '.'));
    if (!Number.isFinite(numeric)) {
      throw new Error('invalid_number');
    }
    return numeric;
  }

  if (type === 'enum') {
    const options = normalizeEnumOptions(def.enum_options);
    const source = raw.value ?? raw.value_text ?? raw.value_enum ?? '';
    const str = String(source ?? '').trim();
    if (!str && options.length) return options[0];
    if (options.length && !options.includes(str)) {
      throw new Error('invalid_enum');
    }
    return str;
  }

  if (type === 'string') {
    const source = raw.value_text ?? raw.value ?? '';
    return source === null || source === undefined ? '' : String(source);
  }

  // fallback: keep whatever came as value
  return raw.value ?? null;
}

router.use(authRequired);
router.use(requireGlobalRole(['SuperAdmin', 'Support']));

router.get('/', async (req, res, next) => {
  try {
    const q = getQuery(req);
    const [
      { rows: plans = [] },
      { rows: feature_defs = [] },
      { rows: plan_features = [] },
    ] = await Promise.all([
      q(
        `SELECT id,
                id_legacy_text,
                name,
                monthly_price,
                currency,
                modules,
                is_published,
                is_active,
                price_cents,
                billing_period_months,
                trial_days,
                sort_order,
                created_at,
                updated_at
           FROM public.plans
          ORDER BY COALESCE(sort_order, 999999), name ASC`
      ),
      q(
        `SELECT code,
                label,
                type,
                enum_options,
                description,
                unit,
                category,
                sort_order,
                is_public,
                show_as_tick,
                created_at,
                updated_at
           FROM feature_defs
          ORDER BY sort_order, code`
      ),
      q(
        `SELECT plan_id,
                feature_code,
                value,
                ai_meter_code,
                ai_monthly_quota,
                created_at,
                updated_at
           FROM plan_features`
      ),
    ]);

    const normalized = Array.isArray(plans) ? plans.map(normalizePlan) : [];

    return res.json({
      data: {
        plans: normalized,
        feature_defs: feature_defs ?? [],
        plan_features: plan_features ?? [],
      },
    });
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

async function buildFeatureUpdates(q, featuresInput = []) {
  const list = Array.isArray(featuresInput) ? featuresInput : [];
  if (!list.length) return [];

  const codes = Array.from(new Set(list.map((item) => item?.feature_code).filter(Boolean)));
  if (!codes.length) return [];

  const meterCodes = Array.from(
    new Set(
      list
        .map((item) => item?.ai_meter_code)
        .filter((item) => typeof item === 'string' && item.trim())
    )
  );

  const [{ rows: defs }, meterResult] = await Promise.all([
    q(
      `SELECT code, type, enum_options, category
         FROM feature_defs
        WHERE code = ANY($1)`,
      [codes]
    ),
    meterCodes.length
      ? q(
          `SELECT code
             FROM ai_meters
            WHERE code = ANY($1)`,
          [meterCodes]
        )
      : Promise.resolve({ rows: [] }),
  ]);

  const defMap = new Map(defs.map((item) => [item.code, item]));
  const meterSet = new Set(meterResult.rows.map((item) => item.code));

  const normalized = [];

  for (const item of list) {
    if (!item || !item.feature_code) continue;
    const def = defMap.get(item.feature_code);
    if (!def) {
      const err = new Error('feature_not_found');
      err.status = 404;
      err.extra = { feature_code: item.feature_code };
      throw err;
    }

    let value;
    try {
      value = normalizeFeatureValue(item, def);
    } catch (err) {
      const e = new Error(err.message || 'invalid_feature_value');
      e.status = 400;
      e.extra = { feature_code: item.feature_code };
      throw e;
    }

    const aiMeterCodeRaw = item.ai_meter_code ?? item.aiMeterCode ?? null;
    const aiMeterCode = aiMeterCodeRaw ? String(aiMeterCodeRaw).trim() : null;
    let aiQuota;
    try {
      aiQuota = parseQuota(item.ai_monthly_quota ?? item.aiMonthlyQuota);
    } catch (err) {
      const e = new Error('invalid_ai_quota');
      e.status = 400;
      e.extra = { feature_code: item.feature_code };
      throw e;
    }

    if (aiMeterCode && !meterSet.has(aiMeterCode)) {
      const err = new Error('invalid_ai_meter_code');
      err.status = 400;
      err.extra = { feature_code: item.feature_code, ai_meter_code: aiMeterCode };
      throw err;
    }

    normalized.push({
      code: item.feature_code,
      value,
      ai_meter_code: aiMeterCode,
      ai_monthly_quota: aiQuota,
    });
  }

  return normalized;
}

router.patch('/:id', async (req, res, next) => {
  const planId = req.params.id;
  try {
    const q = getQuery(req);
    const payload = req.body || {};

    const updates = {};
    if (payload.name !== undefined) {
      const name = String(payload.name || '').trim();
      if (!name) {
        return res.status(400).json({ error: 'name_required' });
      }
      updates.name = name;
    }

    try {
      const price = parseCents(payload.price_cents ?? payload.priceCents);
      if (price !== undefined) updates.price_cents = price;
    } catch (err) {
      return res.status(400).json({ error: err.message || 'invalid_price_cents' });
    }

    try {
      const currency = parseCurrency(payload.currency ?? payload.Currency ?? payload.currencyCode ?? undefined);
      if (currency !== undefined) updates.currency = currency;
    } catch (err) {
      return res.status(400).json({ error: err.message || 'invalid_currency' });
    }

    if (payload.is_active !== undefined) {
      try {
        const value = parseBoolean(payload.is_active ?? payload.isActive);
        updates.is_active = value;
      } catch (err) {
        return res.status(400).json({ error: err.message || 'invalid_boolean' });
      }
    }

    const featuresPayload = await buildFeatureUpdates(q, payload.features);

    let planRow = null;
    if (Object.keys(updates).length) {
      const fields = [];
      const values = [];
      let idx = 1;
      for (const [key, value] of Object.entries(updates)) {
        if (value === undefined) continue;
        fields.push(`${key} = $${idx}`);
        values.push(value);
        idx += 1;
      }
      if (fields.length) {
        fields.push('updated_at = now()');
        values.push(planId);
        const { rows } = await q(
          `UPDATE public.plans
              SET ${fields.join(', ')}
            WHERE id = $${idx}
        RETURNING id,
                  id_legacy_text,
                  name,
                  monthly_price,
                  currency,
                  modules,
                  is_published,
                  is_active,
                  price_cents,
                  billing_period_months,
                  trial_days,
                  sort_order,
                  created_at,
                  updated_at`,
          values
        );
        planRow = rows[0] ?? null;
      }
    }

    if (!planRow) {
      const { rows } = await q(
        `SELECT id,
                id_legacy_text,
                name,
                monthly_price,
                currency,
                modules,
                is_published,
                is_active,
                price_cents,
                billing_period_months,
                trial_days,
                sort_order,
                created_at,
                updated_at
           FROM public.plans
          WHERE id = $1`,
        [planId]
      );
      planRow = rows[0] ?? null;
    }

    if (!planRow) {
      return res.status(404).json({ error: 'plan_not_found' });
    }

    if (featuresPayload.length) {
      await upsertPlanFeatures(
        planId,
        featuresPayload.map((item) => ({
          code: item.code,
          value: item.value,
          ai_meter_code: item.ai_meter_code,
          ai_monthly_quota: item.ai_monthly_quota,
        })),
        req.db
      );
    }

    return res.json({
      data: {
        plan: normalizePlan(planRow),
        updated_features: featuresPayload.length,
      },
    });
  } catch (err) {
    if (err?.status) {
      req.log.error({ err, body: req.body, params: req.params }, 'admin/plans update error');
      return res.status(err.status).json({ error: err.message, ...(err.extra || {}) });
    }
    req.log.error({ err, body: req.body, params: req.params }, 'admin/plans update error');
    const pgCodes400 = new Set(['22P02', '23502', '23503', '42703']);
    if (pgCodes400.has(err.code)) {
      return res.status(400).json({ error: 'bad_request', message: err.detail || err.message });
    }
    return res.status(500).json({ error: 'internal_error' });
  }
});

router.post('/', async (req, res) => {
  try {
    const q = getQuery(req);
    const payload = req.body || {};
    const { name, price_cents, price_brl, monthly_price, currency, is_active } = payload;

    const trimmedName = typeof name === 'string' ? name.trim() : '';
    if (!trimmedName) {
      return res.status(400).json({ error: 'bad_request', message: 'name_required' });
    }

    const priceCandidates = [price_cents, monthly_price, price_brl];
    let cents = null;
    let sawCandidate = false;

    for (const candidate of priceCandidates) {
      if (candidate === undefined || candidate === null || candidate === '') continue;
      sawCandidate = true;
      if (typeof candidate === 'number') {
        if (Number.isFinite(candidate)) {
          cents = Math.round(candidate);
          break;
        }
        continue;
      }
      const parsed = parseBRLToCents(candidate);
      if (Number.isFinite(parsed)) {
        cents = parsed;
        break;
      }
    }

    if (cents === null) {
      if (sawCandidate) {
        return res.status(400).json({ error: 'bad_request', message: 'invalid_price' });
      }
      cents = 0;
    }

    if (!Number.isFinite(cents) || cents < 0) {
      return res.status(400).json({ error: 'bad_request', message: 'invalid_price' });
    }
    if (cents > 9_999_999_99) {
      return res.status(400).json({ error: 'bad_request', message: 'price_out_of_range' });
    }

    let normalizedCurrency;
    try {
      normalizedCurrency = parseCurrency(currency ?? 'BRL', { required: true });
    } catch (err) {
      return res.status(400).json({ error: err.message || 'invalid_currency' });
    }

    let active = true;
    if (is_active !== undefined) {
      try {
        active = parseBoolean(is_active);
      } catch (err) {
        return res.status(400).json({ error: err.message || 'invalid_boolean' });
      }
    }

    const idLegacy = makeLegacyId(trimmedName);

    const { rows } = await q(
      `INSERT INTO public.plans (id_legacy_text, name, price_cents, currency, is_active)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id,
                 id_legacy_text,
                 name,
                 monthly_price,
                 currency,
                 modules,
                 is_published,
                 is_active,
                 price_cents,
                 billing_period_months,
                 trial_days,
                 sort_order,
                 created_at,
                 updated_at`,
      [idLegacy, trimmedName, cents, normalizedCurrency, active]
    );

    const planRow = rows[0];
    if (!planRow) {
      return res.status(500).json({ error: 'plan_not_created' });
    }

    const featuresPayload = await buildFeatureUpdates(q, payload.features);
    if (featuresPayload.length) {
      await upsertPlanFeatures(
        planRow.id,
        featuresPayload.map((item) => ({
          code: item.code,
          value: item.value,
          ai_meter_code: item.ai_meter_code,
          ai_monthly_quota: item.ai_monthly_quota,
        })),
        req.db
      );
    }

    return res.status(201).json({ data: normalizePlan(planRow) });
  } catch (err) {
    req.log.error({ err, body: req.body }, 'admin/plans create error');
    const pgCodes400 = new Set(['22P02', '23502', '23503', '42703']);
    if (pgCodes400.has(err.code)) {
      return res.status(400).json({ error: 'bad_request', message: err.detail || err.message });
    }
    return res.status(500).json({ error: 'internal_error' });
  }
});

router.post('/:id/duplicate', async (req, res) => {
  try {
    const q = getQuery(req);
    const planId = req.params.id;

    const { rows: plans } = await q(
      `SELECT id,
              name,
              price_cents,
              currency,
              is_active,
              monthly_price,
              modules,
              is_published,
              billing_period_months,
              trial_days,
              sort_order
         FROM public.plans
        WHERE id = $1`,
      [planId]
    );

    const source = plans[0];
    if (!source) {
      return res.status(404).json({ error: 'plan_not_found' });
    }

    const duplicateName = `${source.name} (cópia)`;
    const duplicateLegacy = makeLegacyId(
      `${source.name || 'plan'}-copy-${randomBytes(2).toString('hex')}`
    );
    const { rows: inserted } = await q(
      `INSERT INTO public.plans (
         id,
         id_legacy_text,
         name,
         price_cents,
         currency,
         is_active,
         monthly_price,
         modules,
         is_published,
         billing_period_months,
         trial_days,
         sort_order,
         created_at,
         updated_at
       )
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, now(), now())
       RETURNING id,
                 id_legacy_text,
                 name,
                 monthly_price,
                 currency,
                 modules,
                 is_published,
                 is_active,
                 price_cents,
                 billing_period_months,
                 trial_days,
                 sort_order,
                 created_at,
                 updated_at`,
      [
        duplicateLegacy,
        duplicateName,
        source.price_cents ?? 0,
        source.currency ?? 'BRL',
        source.is_active ?? true,
        source.monthly_price ?? null,
        source.modules ?? {},
        source.is_published ?? false,
        source.billing_period_months ?? 1,
        source.trial_days ?? 0,
        source.sort_order ?? null,
      ]
    );

    const duplicated = inserted[0];
    if (!duplicated) {
      return res.status(500).json({ error: 'plan_not_duplicated' });
    }

    await q(
      `INSERT INTO plan_features (plan_id, feature_code, value, ai_meter_code, ai_monthly_quota, created_at, updated_at)
       SELECT $1, feature_code, value, ai_meter_code, ai_monthly_quota, now(), now()
         FROM plan_features
        WHERE plan_id = $2`,
      [duplicated.id, planId]
    );

    return res.status(201).json({ data: normalizePlan(duplicated) });
  } catch (err) {
    if (err?.status) {
      req.log.error({ err, body: req.body, params: req.params }, 'admin/plans duplicate error');
      return res.status(err.status).json({ error: err.message, ...(err.extra || {}) });
    }
    req.log.error({ err, body: req.body, params: req.params }, 'admin/plans duplicate error');
    const pgCodes400 = new Set(['22P02', '23502', '23503', '42703']);
    if (pgCodes400.has(err.code)) {
      return res.status(400).json({ error: 'bad_request', message: err.detail || err.message });
    }
    return res.status(500).json({ error: 'internal_error' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const q = getQuery(req);
    const planId = req.params.id;

    const { rows: usage } = await q(
      `SELECT 1
         FROM public.organizations
        WHERE plan_id = $1
        LIMIT 1`,
      [planId]
    );

    if (usage.length) {
      return res.status(409).json({ error: 'plan_in_use' });
    }

    const { rowCount } = await q(`DELETE FROM public.plans WHERE id = $1`, [planId]);
    if (!rowCount) {
      return res.status(404).json({ error: 'plan_not_found' });
    }

    return res.json({ data: { deleted: true } });
  } catch (err) {
    req.log.error({ err, body: req.body, params: req.params }, 'admin/plans delete error');
    const pgCodes400 = new Set(['22P02', '23502', '23503', '42703']);
    if (pgCodes400.has(err.code)) {
      return res.status(400).json({ error: 'bad_request', message: err.detail || err.message });
    }
    return res.status(500).json({ error: 'internal_error' });
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

router.get('/:id/credits', async (req, res) => {
  const pool = req.pool;
  const planId = req.params.id;

  if (!pool?.query) {
    req.log?.error('admin/plans credits missing pool');
    return res.status(500).json({ error: 'internal_error' });
  }

  try {
    const { rows } = await pool.query(
      `
      SELECT feature_code AS code,
             CASE
               WHEN feature_code = 'whatsapp_numbers' THEN 'WhatsApp – Números'
               WHEN feature_code = 'instagram_accounts' THEN 'Instagram – Contas'
               WHEN feature_code = 'instagram_publish_daily_quota' THEN 'Instagram – Publicações/dia'
               WHEN feature_code = 'facebook_pages' THEN 'Facebook – Páginas'
               WHEN feature_code = 'google_calendar_accounts' THEN 'Google Calendar – Contas conectadas'
               ELSE feature_code
             END AS label,
             'count'::text AS unit,
             COALESCE(
               NULLIF(regexp_replace(value::text, '[^0-9-]', '', 'g'), '')::int,
               0
             ) AS limit
        FROM public.plan_features
       WHERE plan_id = $1 AND (type = 'number' OR type IS NULL)
       ORDER BY 1 ASC
      `,
      [planId],
    );

    res.json({ plan_id: planId, summary: rows });
  } catch (err) {
    req.log?.error({ err }, 'admin/plans credits failed');
    res.status(500).json({ error: 'internal_error' });
  }
});

export default router;
