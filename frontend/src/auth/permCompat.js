import { useAuth } from '@/contexts/AuthContext';

const PERMISSION_FALLBACK = {
  'inbox:view': ['Agent', 'Manager', 'OrgOwner', 'Support', 'SuperAdmin'],
  'audit:view': ['Manager', 'OrgOwner', 'Support', 'SuperAdmin'],
  'telemetry:view': ['Manager', 'OrgOwner', 'SuperAdmin'],
  'marketing:view': ['Agent', 'Manager', 'OrgOwner', 'SuperAdmin'],
};

function normalizeRole(role) {
  if (!role) return null;
  const key = String(role).trim().toLowerCase();
  const map = {
    agent: 'Agent',
    manager: 'Manager',
    orgadmin: 'OrgOwner',
    orgowner: 'OrgOwner',
    owner: 'OrgOwner',
    support: 'Support',
    superadmin: 'SuperAdmin',
    viewer: 'Viewer',
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
