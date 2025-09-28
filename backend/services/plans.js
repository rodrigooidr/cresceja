import { query as rootQuery } from '#db';

const q = (db) => (db && db.query ? (text, params) => db.query(text, params) : (text, params) => rootQuery(text, params));

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
      // ignore parsing errors and fallback to comma separated list
    }
    return trimmed
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function extractStoredValue(raw) {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== 'object' || Array.isArray(raw)) return raw;
  if (Object.prototype.hasOwnProperty.call(raw, 'value')) {
    return raw.value;
  }
  return raw;
}

export async function getPlanFeatures(planId, db) {
  const runner = q(db);
  const [{ rows: defs }, { rows: values }] = await Promise.all([
    runner(
      `SELECT code, label, type, enum_options
         FROM feature_defs
        ORDER BY sort_order, code`
    ),
    runner(
      `SELECT feature_code AS code, value
         FROM plan_features
        WHERE plan_id = $1`,
      [planId]
    ),
  ]);

  const valueMap = new Map(values.map((item) => [item.code, extractStoredValue(item.value)]));

  return defs.map((def) => {
    const options = normalizeEnumOptions(def.enum_options);
    const value = valueMap.has(def.code) ? valueMap.get(def.code) : null;
    return {
      code: def.code,
      label: def.label,
      type: def.type,
      options: options.length ? options : undefined,
      value,
    };
  });
}

export async function upsertPlanFeatures(planId, features, db) {
  const runner = q(db);
  await runner('BEGIN');
  try {
    for (const feature of features) {
      await runner(
        `INSERT INTO plan_features (plan_id, feature_code, value, updated_at)
         VALUES ($1, $2, $3::jsonb, now())
         ON CONFLICT (plan_id, feature_code)
         DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
        [planId, feature.code, JSON.stringify({ value: feature.value })]
      );
    }
    await runner('COMMIT');
  } catch (err) {
    await runner('ROLLBACK');
    throw err;
  }
}

export default { getPlanFeatures, upsertPlanFeatures };
