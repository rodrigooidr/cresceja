// RBAC + toggles granulares (marketing etc.)

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

export function isPlatformRole(role) {
  return role === ROLES.SuperAdmin || role === ROLES.Support;
}

export function hasSupportScope(user, scope) {
  if (!user?.is_support) return false;
  const scopes = user?.support_scopes || [];
  return scopes.includes(scope);
}

export function canPublishPosts(user) {
  if (!user) return false;
  if (user.role === ROLES.OrgAdmin || user.role === ROLES.OrgOwner) return true;
  return !!user?.perms?.marketing?.canPublish;
}

export function canApproveContent(user) {
  if (!user) return false;
  if (user.role === ROLES.OrgAdmin || user.role === ROLES.OrgOwner) return true;
  return !!user?.perms?.marketing?.canApprove;
}
