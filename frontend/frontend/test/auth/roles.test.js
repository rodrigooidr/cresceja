import { hasOrgRole, hasGlobalRole } from '../../src/auth/roles';

describe('roles helpers', () => {
  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  test('hasOrgRole checks primary role', () => {
    const payload = { role: 'OrgAdmin', roles: [] };
    expect(hasOrgRole(['OrgAdmin'], payload)).toBe(true);
    expect(hasOrgRole(['OrgOwner'], payload)).toBe(false);
  });

  test('hasGlobalRole checks roles array', () => {
    const payload = { role: 'OrgViewer', roles: ['Support'] };
    expect(hasGlobalRole(['Support'], payload)).toBe(true);
    expect(hasGlobalRole(['SuperAdmin'], payload)).toBe(false);
  });
});
