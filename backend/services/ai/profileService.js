import { query } from '#db';

function normalizeRow(row, fallbackOrgId) {
  if (!row) {
    return { orgId: fallbackOrgId };
  }

  const profile = row.profile && typeof row.profile === 'object' ? row.profile : {};
  const normalized = { orgId: row.org_id || fallbackOrgId, ...profile };

  if (row.updated_at) {
    const date = row.updated_at instanceof Date ? row.updated_at : new Date(row.updated_at);
    normalized.updatedAt = date.toISOString();
  }
  if (row.updated_by) {
    normalized.updatedBy = row.updated_by;
  }

  return normalized;
}

export async function getProfile(orgId) {
  const { rows } = await query(
    `SELECT org_id, profile, updated_at, updated_by
       FROM org_ai_profiles
      WHERE org_id = $1`,
    [orgId]
  );

  if (!rows?.length) {
    return { orgId };
  }

  return normalizeRow(rows[0], orgId);
}

export async function updateProfile(orgId, profile, userId) {
  const now = new Date();
  const { rows } = await query(
    `INSERT INTO org_ai_profiles (org_id, profile, updated_at, updated_by)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (org_id)
     DO UPDATE SET profile = EXCLUDED.profile,
                   updated_at = EXCLUDED.updated_at,
                   updated_by = EXCLUDED.updated_by
     RETURNING org_id, profile, updated_at, updated_by`,
    [orgId, profile || {}, now, userId || null]
  );

  return normalizeRow(rows?.[0], orgId);
}
