// backend/services/orgService.js
import { query } from '#db';

export const ORG_ROLES = new Set(['OrgOwner', 'OrgAdmin', 'OrgAgent']);

function toArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  if (typeof value === 'string') return value.split(',').map((item) => item.trim()).filter(Boolean);
  return [];
}

export function hasGlobalAccess(user = {}) {
  const roles = toArray(user.roles);
  return user.is_superadmin === true || roles.includes('Support');
}

export async function listUserOrganizations(userId) {
  const sql = `
    SELECT o.*
      FROM public.organizations o
      JOIN public.org_users ou ON ou.org_id = o.id
     WHERE ou.user_id = $1
     ORDER BY COALESCE(o.nome_fantasia, o.name, o.slug) ASC
  `;
  const { rows } = await query(sql, [userId]);
  return rows;
}

export async function listAllOrganizations() {
  const sql = `
    SELECT o.*
      FROM public.organizations o
     ORDER BY COALESCE(o.nome_fantasia, o.name, o.slug) ASC
  `;
  const { rows } = await query(sql);
  return rows;
}

export async function getAccessibleOrganizations(user = {}) {
  if (!user || !user.id) return [];
  if (hasGlobalAccess(user)) {
    return listAllOrganizations();
  }
  return listUserOrganizations(user.id);
}

export async function setActiveOrgForUser(userId, orgId) {
  const sql = `
    SELECT 1
      FROM public.org_users
     WHERE user_id = $1 AND org_id = $2
    UNION
    SELECT 1
      FROM public.users u
     WHERE u.id = $1 AND (u.is_superadmin = TRUE OR 'Support' = ANY(u.roles))
     LIMIT 1
  `;
  const { rows } = await query(sql, [userId, orgId]);
  if (!rows.length) {
    const err = new Error('forbidden_org');
    err.status = 403;
    throw err;
  }
  return { ok: true };
}

export default {
  getAccessibleOrganizations,
  setActiveOrgForUser,
};
