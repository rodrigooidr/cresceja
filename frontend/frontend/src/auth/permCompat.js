
import { useAuth } from '@/contexts/AuthContext';

const PERMISSION_FALLBACK = {
  'inbox:view': ['OrgAgent', 'OrgAdmin', 'OrgOwner', 'Support', 'SuperAdmin'],
  'audit:view': ['OrgAdmin', 'OrgOwner', 'Support', 'SuperAdmin'],
  'telemetry:view': ['OrgAdmin', 'OrgOwner', 'SuperAdmin'],
  'marketing:view': ['OrgAgent', 'OrgAdmin', 'OrgOwner', 'SuperAdmin'],
  'settings:agenda': ['OrgAdmin', 'OrgOwner', 'SuperAdmin'],
  'settings:ai': ['OrgAdmin', 'OrgOwner', 'SuperAdmin'],
};

function normalizeRole(role) {
  if (!role) return null;
  const key = String(role).trim().toLowerCase();
  const map = {
    agent: 'OrgAgent',
    orgagent: 'OrgAgent',
    manager: 'OrgAdmin',
    admin: 'OrgAdmin',
    orgadmin: 'OrgAdmin',
    orgowner: 'OrgOwner',
    owner: 'OrgOwner',
    support: 'Support',
    superadmin: 'SuperAdmin',
    orgviewer: 'OrgViewer',
    viewer: 'OrgViewer',
  };
  return map[key] || role;
}

export function hasPerm(perm, user) {
  if (!perm) return true;
  const subject = user ?? (typeof window !== 'undefined' ? window.__AUTH_USER__ : null);
  if (!subject) return false;
  const list = Array.isArray(subject.permissions)
    ? subject.permissions
    : Array.isArray(subject.perms)
    ? subject.perms
    : [];
  if (list.includes(perm)) {
    return true;
  }
  const allowedRoles = PERMISSION_FALLBACK[perm];
  if (!allowedRoles) {
    return false;
  }
  const role = normalizeRole(subject.role || subject.minRole);
  if (!role) {
    return false;
  }
  return allowedRoles.includes(role);
}

export function useHasPerm(perm) {
  const { user } = useAuth();
  return hasPerm(perm, user);

}
