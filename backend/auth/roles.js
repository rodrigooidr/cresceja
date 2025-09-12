export const ROLES = {
  SuperAdmin: "SuperAdmin",
  Support: "Support",
  Owner: "Owner",
  Admin: "Admin",
  Manager: "Manager",
  Agent: "Agent",
  Billing: "Billing",
  ReadOnly: "ReadOnly",
};

export const ROLE_RANK = {
  ReadOnly: 0,
  Agent: 1,
  Manager: 2,
  Admin: 3,
  Owner: 4,
  Support: 5,
  SuperAdmin: 6,
  Billing: 2,
};

export function hasRoleAtLeast(role, min = "Admin") {
  const r = ROLE_RANK[role] ?? -1;
  const need = ROLE_RANK[min] ?? 999;
  return r >= need;
}

export const CAN_VIEW_ORGANIZATIONS_ADMIN = (role) =>
  [ROLES.SuperAdmin, ROLES.Support].includes(role);

export const CAN_EDIT_CLIENTS = (role) =>
  [ROLES.SuperAdmin, ROLES.Support, ROLES.Owner, ROLES.Admin, ROLES.Manager, ROLES.Agent].includes(role);

export function requireMinRole(minRole) {
  return function (req, res, next) {
    const r = req.user?.role;
    if (!hasRoleAtLeast(r, minRole)) {
      return res.status(403).json({ error: 'forbidden', detail: `min_role:${minRole}` });
    }
    next();
  };
}

export function requireRole(check) {
  return function (req, res, next) {
    const r = req.user?.role;
    if (!check(r)) return res.status(403).json({ error: 'forbidden' });
    next();
  };
}
