export const ORG_ROLES = Object.freeze(['OrgViewer', 'OrgAgent', 'OrgAdmin', 'OrgOwner']);
export const GLOBAL_ROLES = Object.freeze(['Support', 'SuperAdmin']);

export function decodeJwt() {
  try {
    const raw = localStorage.getItem('token') || sessionStorage.getItem('token');
    if (!raw) return null;
    const [, payload] = raw.split('.');
    if (!payload) return null;
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(normalized);
    return JSON.parse(json);
  } catch (err) {
    return null;
  }
}

export const hasOrgRole = (wanted, source) => {
  const target = Array.isArray(wanted) ? wanted : [wanted].filter(Boolean);
  const context = source ?? decodeJwt();
  const role = context?.role;
  if (!role) return false;
  return target.some((item) => item === role);
};

export const hasGlobalRole = (wanted, source) => {
  const target = Array.isArray(wanted) ? wanted : [wanted].filter(Boolean);
  if (!target.length) return false;
  const context = source ?? decodeJwt();
  const roles = Array.isArray(context?.roles) ? context.roles : [];
  return target.some((role) => roles.includes(role));
};

export const canManageCampaigns = (source) =>
  hasGlobalRole(['SuperAdmin'], source) || hasOrgRole(['OrgAdmin', 'OrgOwner'], source);

export const canEditClients = (source) =>
  hasGlobalRole(['SuperAdmin', 'Support'], source) ||
  hasOrgRole(['OrgAgent', 'OrgAdmin', 'OrgOwner'], source);

export const canViewOrganizationsAdmin = (source) =>
  hasGlobalRole(['SuperAdmin', 'Support'], source);

export const canViewOrgPlan = (source) =>
  hasGlobalRole(['SuperAdmin'], source) ||
  hasOrgRole(['OrgAdmin', 'OrgOwner'], source);
