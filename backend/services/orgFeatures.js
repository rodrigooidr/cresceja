export async function getOrgFeatures(db, orgId) {
  if (!orgId) return {};
  const result = await db.query('SELECT features FROM org_features WHERE org_id = $1', [orgId]);
  return result.rows[0]?.features || {};
}

export async function setOrgFeatures(db, orgId, patch = {}) {
  if (!orgId) throw new Error('org_id_required');
  const features = typeof patch === 'object' && patch !== null ? patch : {};
  await db.query(
    `
    INSERT INTO org_features (org_id, features)
    VALUES ($1, $2::jsonb)
    ON CONFLICT (org_id) DO UPDATE
      SET features = org_features.features || EXCLUDED.features,
          updated_at = now()
  `,
    [orgId, JSON.stringify(features)]
  );
}
