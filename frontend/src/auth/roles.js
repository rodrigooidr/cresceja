// Papéis usados no projeto (alinhado com seu OrgContext)
export const ROLES = {
  SuperAdmin: "SuperAdmin",
  Support: "Support",
  OrgOwner: "OrgOwner",
  OrgAdmin: "OrgAdmin",
  Manager: "Manager",
  Agent: "Agent",
  Billing: "Billing",
  ReadOnly: "ReadOnly",
};

// Ordem hierárquica simples p/ comparação
const ROLE_ORDER = [
  ROLES.ReadOnly,
  ROLES.Billing,
  ROLES.Agent,
  ROLES.Manager,
  ROLES.OrgAdmin,
  ROLES.OrgOwner,
  ROLES.Support,
  ROLES.SuperAdmin,
];

// ← helper que o hook está tentando importar
export const hasRoleAtLeast = (userRole, minRole) =>
  ROLE_ORDER.indexOf(userRole) >= ROLE_ORDER.indexOf(minRole);

// Helpers existentes/úteis
export const CAN_VIEW_ORGANIZATIONS_ADMIN = (role) =>
  [ROLES.SuperAdmin, ROLES.Support].includes(role);

export const CAN_EDIT_CLIENTS = (role) =>
  [ROLES.SuperAdmin, ROLES.Support, ROLES.OrgOwner, ROLES.OrgAdmin, ROLES.Manager, ROLES.Agent].includes(role);
