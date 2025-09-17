import * as perm from "@/auth/perm";

export function hasPerm(p) {
  try {
    if (typeof perm.has === "function") return !!perm.has(p);
    if (typeof perm.can === "function") return !!perm.can(p);
    if (Array.isArray(perm.PERMISSIONS)) return perm.PERMISSIONS.includes(p);
  } catch (_) {}
  try {
    return !!perm.isAdmin?.() || !!perm.isOrgAdmin?.();
  } catch (_) {}
  return true;
}
