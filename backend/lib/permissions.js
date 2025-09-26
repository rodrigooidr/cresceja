// RBAC + toggles granulares (marketing etc.)

export const ORG_ROLES = Object.freeze(['OrgViewer', 'OrgAgent', 'OrgAdmin', 'OrgOwner']);
export const GLOBAL_ROLES = Object.freeze(['Support', 'SuperAdmin']);

export const ROLES = Object.freeze({
  OrgViewer: 'OrgViewer',
  OrgAgent: 'OrgAgent',
  OrgAdmin: 'OrgAdmin',
  OrgOwner: 'OrgOwner',
  Support: 'Support',
  SuperAdmin: 'SuperAdmin',
});

// Escopos que o SuperAdmin pode liberar para Support
export const SUPPORT_SCOPES = Object.freeze({
  impersonate: 'impersonate', // atuar "como" uma Org
  inboxWrite: 'inboxWrite',
  crmWrite: 'crmWrite',
  marketingDraft: 'marketingDraft',
  marketingPublish: 'marketingPublish',
  approveContent: 'approveContent',
  channelsManage: 'channelsManage',
  billingRead: 'billingRead', // nunca billing write
  governanceRead: 'governanceRead',
  attachmentsWrite: 'attachmentsWrite',
  orgsManage: 'orgsManage', // criar/editar orgs
});

export const DEFAULT_AGENT_TOGGLES = Object.freeze({
  marketing: { canDraft: false, canPublish: false, canApprove: false },
});

export function normalizeOrgRole(role) {
  if (ORG_ROLES.includes(role)) return role;
  return ROLES.OrgViewer;
}

export function normalizeGlobalRoles(roles = []) {
  if (!Array.isArray(roles)) return [];
  return roles.filter((role) => GLOBAL_ROLES.includes(role));
}

export function hasOrgRole(user, wanted = []) {
  if (!wanted?.length) return true;
  const role = user?.role;
  if (!role) return false;
  return wanted.includes(normalizeOrgRole(role));
}

export function hasGlobalRole(user, wanted = []) {
  if (!wanted?.length) return true;
  const list = normalizeGlobalRoles(user?.roles);
  if (!list.length) return false;
  return wanted.some((role) => list.includes(role));
}

export function isPlatformRole(role) {
  return GLOBAL_ROLES.includes(role);
}

export function hasSupportScope(user, scope) {
  if (!hasGlobalRole(user, [ROLES.Support])) return false;
  const scopes = user?.support_scopes || [];
  return scopes.includes(scope);
}

export function canPublishPosts(user) {
  if (!user) return false;
  if (hasOrgRole(user, [ROLES.OrgAdmin, ROLES.OrgOwner])) return true;
  return !!user?.perms?.marketing?.canPublish;
}

export function canApproveContent(user) {
  if (!user) return false;
  if (hasOrgRole(user, [ROLES.OrgAdmin, ROLES.OrgOwner])) return true;
  return !!user?.perms?.marketing?.canApprove;
}
