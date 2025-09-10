export const ROLE_RANK = { Viewer:0, Agent:1, Manager:2, OrgAdmin:3, SuperAdmin:4 };

export function hasRoleAtLeast(userRole, minRole) {
  return (ROLE_RANK[userRole] ?? -1) >= (ROLE_RANK[minRole] ?? 999);
}

export function requireMinRole(minRole) {
  return function (req, res, next) {
    const r = req.user?.role;
    if (!hasRoleAtLeast(r, minRole)) {
      return res.status(403).json({ error: 'forbidden', detail: `min_role:${minRole}` });
    }
    next();
  };
}
