// src/auth/roles.js

// ----- Conjuntos canônicos de papéis -----
export const ORG_ROLES = Object.freeze(['OrgViewer', 'OrgAgent', 'OrgAdmin', 'OrgOwner']);
export const GLOBAL_ROLES = Object.freeze(['Support', 'SuperAdmin']);

// ----- Normalizadores -----
export function normalizeOrgRole(role) {
  if (!role) return ORG_ROLES[0];
  const match = ORG_ROLES.find((item) => item === role);
  return match ?? ORG_ROLES[0];
}

/**
 * Normaliza a lista de papéis globais vinda do usuário/JWT:
 * - Tolerante a variação de caixa (case-insensitive)
 * - Filtra apenas os papéis reconhecidos em GLOBAL_ROLES
 * - Retorna na forma canônica declarada em GLOBAL_ROLES
 */
export function normalizeGlobalRoles(list) {
  if (!Array.isArray(list)) return [];
  const refLower = GLOBAL_ROLES.map((r) => r.toLowerCase());
  return list
    .map((r) => String(r || '').trim())
    .filter((r) => r) // não vazios
    .map((r) => {
      const i = refLower.indexOf(r.toLowerCase());
      return i >= 0 ? GLOBAL_ROLES[i] : null;
    })
    .filter(Boolean);
}

// ----- Utilidades internas -----
function readTokenFromStorage() {
  const stores = [typeof localStorage !== 'undefined' ? localStorage : null,
                  typeof sessionStorage !== 'undefined' ? sessionStorage : null]
                 .filter(Boolean);

  // chaves diretas mais comuns
  for (const s of stores) {
    const direct = s.getItem('authToken') || s.getItem('token') || s.getItem('jwt') || s.getItem('JWT');
    if (direct && String(direct).startsWith('eyJ')) return direct;
  }

  // objeto "auth" serializado
  for (const s of stores) {
    const raw = s.getItem('auth');
    if (!raw) continue;
    if (raw.startsWith('eyJ')) return raw; // às vezes salvam só o token
    try {
      const obj = JSON.parse(raw);
      if (obj?.token && String(obj.token).startsWith('eyJ')) return obj.token;
      if (obj?.authToken && String(obj.authToken).startsWith('eyJ')) return obj.authToken;
    } catch { /* ignore */ }
  }

  return null;
}

function decodeBase64UrlSegment(seg) {
  try {
    const base64 = String(seg || '').replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(base64);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

// ----- Decodificação do JWT da aplicação -----
export function decodeJwt() {
  try {
    const token = readTokenFromStorage();
    if (!token) return null;
    const payloadSeg = (token.split('.')[1] || '');
    const payload = decodeBase64UrlSegment(payloadSeg);
    if (!payload || typeof payload !== 'object') return null;

    // Garantias: role (string) e roles (array)
    const role = payload.role ? String(payload.role) : null;
    const roles = Array.isArray(payload.roles) ? payload.roles : [];

    return { ...payload, role, roles };
  } catch {
    return null;
  }
}

// ----- Predicados de papel -----
export const hasOrgRole = (wanted, source) => {
  const target = (Array.isArray(wanted) ? wanted : [wanted])
    .filter(Boolean)
    .map((role) => normalizeOrgRole(role));

  const context = source ?? decodeJwt();
  const role = context?.role ? normalizeOrgRole(context.role) : null;
  if (!role) return false;

  return target.some((item) => item === role);
};

/**
 * Agora considera:
 * - roles[] normalizados (case-insensitive)
 * - role (string) isolado como papel global válido (case-insensitive)
 */
export const hasGlobalRole = (wanted, source) => {
  const target = (Array.isArray(wanted) ? wanted : [wanted])
    .filter(Boolean)
    .map((role) => String(role));

  if (!target.length) return false;

  const context = source ?? decodeJwt();

  // 1) lista roles[]
  const rolesArr = normalizeGlobalRoles(context?.roles);

  // 2) role isolado (string)
  const single = String(context?.role || '').trim();
  const lowerRef = GLOBAL_ROLES.map((r) => r.toLowerCase());
  const singleIdx = single ? lowerRef.indexOf(single.toLowerCase()) : -1;
  const singleCanonical = singleIdx >= 0 ? GLOBAL_ROLES[singleIdx] : null;

  return target.some((role) => {
    // compara com a lista normalizada
    if (rolesArr.includes(role)) return true;
    // aceita quando o papel veio só em `role`
    if (singleCanonical && role === singleCanonical) return true;
    return false;
  });
};

// ----- Helpers de permissão exportados (mantidos) -----
export const canManageCampaigns = (source) =>
  hasGlobalRole(['SuperAdmin'], source) || hasOrgRole(['OrgAdmin', 'OrgOwner'], source);

export const canEditClients = (source) =>
  hasGlobalRole(['SuperAdmin', 'Support'], source) ||
  hasOrgRole(['OrgAgent', 'OrgAdmin', 'OrgOwner'], source);

export const canViewOrganizationsAdmin = (source) =>
  hasGlobalRole(['SuperAdmin', 'Support'], source);

export const canViewOrgPlan = (source) =>
  hasGlobalRole(['SuperAdmin', 'Support'], source) ||
  hasOrgRole(['OrgAdmin', 'OrgOwner'], source);
