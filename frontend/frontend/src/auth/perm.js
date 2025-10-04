export function canApprove(user) {
  const role = user?.role || user?.minRole || 'User';
  return ['OrgAdmin', 'OrgOwner', 'SuperAdmin'].includes(role);
}
