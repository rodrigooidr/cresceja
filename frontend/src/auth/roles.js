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

export const CAN_VIEW_ORGANIZATIONS_ADMIN = (role) =>
  [ROLES.SuperAdmin, ROLES.Support].includes(role);

export const CAN_EDIT_CLIENTS = (role) =>
  [
    ROLES.SuperAdmin,
    ROLES.Support,
    ROLES.Owner,
    ROLES.Admin,
    ROLES.Manager,
    ROLES.Agent,
  ].includes(role);
