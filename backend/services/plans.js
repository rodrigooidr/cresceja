import { query as rootQuery } from '#db';

const q = (db) => (db && db.query) ? (t,p) => db.query(t,p) : (t,p) => rootQuery(t,p);

export async function getPlanFeatures(planId, db) {
  const { rows } = await q(db)(
    `SELECT d.code, d.label, d.type, d.unit, d.category,
            COALESCE((pf.value->>'enabled')::boolean, false) AS enabled,
            CASE WHEN pf.value ? 'limit' THEN (pf.value->>'limit')::int ELSE NULL END AS limit
       FROM feature_defs d
       LEFT JOIN plan_features pf ON pf.feature_code=d.code AND pf.plan_id=$1
       ORDER BY d.sort_order, d.code`,
    [planId]
  );
  return rows;
}

export async function upsertPlanFeatures(planId, features, db) {
  const qExec = q(db);
  for (const [code, value] of Object.entries(features)) {
    await qExec(
      `INSERT INTO plan_features(plan_id, feature_code, value, updated_at)
       VALUES ($1, $2, $3::jsonb, now())
       ON CONFLICT (plan_id, feature_code)
       DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
      [planId, code, JSON.stringify(value)]
    );
  }
}

export default { getPlanFeatures, upsertPlanFeatures };
