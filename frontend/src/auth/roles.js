export const ROLES = ['Agent','OrgAdmin','OrgOwner','Support','SuperAdmin'];

export function hasRoleAtLeast(userRole, minRole) {
  const a = ROLES.indexOf(String(userRole || ''));
  const b = ROLES.indexOf(String(minRole || ''));
  return a >= 0 && b >= 0 && a >= b;
}

// Capacidades
export const CAN_MANAGE_CAMPAIGNS = (user) =>
  !!user && hasRoleAtLeast(user.role, 'OrgAdmin');

export const CAN_VIEW_ORGANIZATIONS_ADMIN = (user) =>
  !!user && hasRoleAtLeast(user.role, 'SuperAdmin');

export const CAN_EDIT_CLIENTS = (user) =>
  !!user && hasRoleAtLeast(user.role, 'Agent'); // ajuste se necessário
