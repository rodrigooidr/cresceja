export const ROLE_RANK = { Viewer:0, Agent:1, Manager:2, OrgAdmin:3, SuperAdmin:4 };

export function hasRoleAtLeast(role, min = 'OrgAdmin') {
  const r = ROLE_RANK[role] ?? -1;
  const need = ROLE_RANK[min] ?? 999;
  return r >= need;
}
