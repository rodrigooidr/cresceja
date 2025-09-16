export function canApprove(user) {
  const role = user?.role || user?.minRole || 'User';
  return ['OrgAdmin', 'Manager', 'SuperAdmin'].includes(role);
}
