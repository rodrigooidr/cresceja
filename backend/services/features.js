import { query as rootQuery } from '#db';

const q = (db) => (db && db.query) ? (t, p) => db.query(t, p) : (t, p) => rootQuery(t, p);

const diagSql = (featureCode, sql, params) => {
  if (process.env.DIAG_SQL === '1') {
    console.log('[diag.sql]', featureCode, sql, params);
  }
};

export async function getOrgPlanId(orgId, db) {
  const { rows } = await q(db)(
    'SELECT plan_id FROM organizations WHERE id=$1',
    [orgId]
  );
  return rows[0]?.plan_id ?? null;
}

export async function getFeatureAllowance(orgId, featureCode, db) {
  const planId = await getOrgPlanId(orgId, db);
  if (!planId) return { enabled: false, limit: 0, source: 'no_plan' };

  const { rows } = await q(db)(
    `SELECT
       COALESCE((value->>'enabled')::boolean,false) AS enabled,
       CASE WHEN value ? 'limit' THEN (value->>'limit')::int ELSE NULL END AS limit
     FROM plan_features WHERE plan_id=$1 AND feature_code=$2`,
    [planId, featureCode]
  );
  return rows[0] ?? { enabled: false, limit: 0, source: 'missing' };
}

export async function getUsage(orgId, featureCode, db) {
  if (featureCode === 'whatsapp_numbers') {
    const sql = 'SELECT COUNT(*)::int AS used FROM whatsapp_channels WHERE org_id=$1';
    const params = [orgId];
    diagSql(featureCode, sql, params);
    const { rows } = await q(db)(sql, params);
    return rows[0]?.used ?? 0;
  }
  if (featureCode === 'google_calendar_accounts') {
    const sql = 'SELECT COUNT(*)::int AS used FROM google_calendar_accounts WHERE org_id=$1';
    const params = [orgId];
    diagSql(featureCode, sql, params);
    const { rows } = await q(db)(sql, params);
    return rows[0]?.used ?? 0;
  }
  if (featureCode === 'facebook_pages') {
    const sql = 'SELECT COUNT(*)::int AS used FROM facebook_pages WHERE org_id=$1';
    const params = [orgId];
    diagSql(featureCode, sql, params);
    const { rows } = await q(db)(sql, params);
    return rows[0]?.used ?? 0;
  }
  if (featureCode === 'instagram_accounts') {
    const sql = 'SELECT COUNT(*)::int AS used FROM instagram_accounts WHERE org_id=$1 AND is_active=true';
    const params = [orgId];
    diagSql(featureCode, sql, params);
    const { rows } = await q(db)(sql, params);
    return rows[0]?.used ?? 0;
  }
  if (featureCode === 'instagram_publish_daily_quota') {
    const sql = `SELECT COUNT(*)::int AS used
         FROM instagram_publish_jobs
        WHERE org_id=$1 AND status='done' AND created_at >= now() - interval '1 day'`;
    const params = [orgId];
    diagSql(featureCode, sql, params);
    const { rows } = await q(db)(sql, params);
    return rows[0]?.used ?? 0;
  }
  if (featureCode === 'facebook_publish_daily_quota') {
    const sql = `SELECT COUNT(*)::int AS used
         FROM facebook_publish_jobs
        WHERE org_id=$1 AND status='done' AND created_at >= now() - interval '1 day'`;
    const params = [orgId];
    diagSql(featureCode, sql, params);
    const { rows } = await q(db)(sql, params);
    return rows[0]?.used ?? 0;
  }
  // default: sem contagem
  return 0;
}

export default { getFeatureAllowance, getUsage, getOrgPlanId };
