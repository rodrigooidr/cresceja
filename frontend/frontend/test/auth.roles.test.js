import {
  GLOBAL_ROLES,
  ORG_ROLES,
  hasGlobalRole,
  hasOrgRole,
  normalizeGlobalRoles,
  normalizeOrgRole,
} from '@/auth/roles';

describe('auth roles helpers', () => {
  it('normalizes org roles', () => {
    expect(normalizeOrgRole('OrgAdmin')).toBe('OrgAdmin');
    expect(normalizeOrgRole('InvalidRole')).toBe(ORG_ROLES[0]);
  });

  it('filters global roles', () => {
    const normalized = normalizeGlobalRoles(['Support', 'Other', 'SuperAdmin']);
    expect(normalized).toEqual(['Support', 'SuperAdmin']);
  });

  it('checks org role membership', () => {
    const user = { role: 'OrgOwner' };
    expect(hasOrgRole(['OrgAdmin', 'OrgOwner'], user)).toBe(true);
    expect(hasOrgRole(['OrgAdmin'], user)).toBe(false);
  });

  it('checks global roles', () => {
    const user = { roles: ['Support'] };
    expect(hasGlobalRole(GLOBAL_ROLES[0], user)).toBe(true);
    expect(hasGlobalRole('SuperAdmin', user)).toBe(false);
  });
});

