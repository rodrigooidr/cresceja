export const ROLE_RANK = { Viewer:0, Agent:1, Manager:2, OrgAdmin:3, SuperAdmin:4 } as const;
export const hasRoleAtLeast = (role?: string, min='OrgAdmin') =>
  (ROLE_RANK[role as keyof typeof ROLE_RANK] ?? -1) >= ROLE_RANK[min as keyof typeof ROLE_RANK];
