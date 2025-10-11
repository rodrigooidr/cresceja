import jwt from 'jsonwebtoken';

const TTL = 60;

export function signQrToken({ userId, orgId, secret, ttl = TTL, role, roles, scope = 'whatsapp_qr' }) {
  if (!secret) throw new Error('JWT secret not configured');
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: String(userId),
    org_id: String(orgId),
    scope,
    iat: now,
    exp: now + ttl,
  };
  if (role) payload.role = role;
  if (Array.isArray(roles) && roles.length) payload.roles = roles;
  return jwt.sign(payload, secret);
}

export function verifyQrToken(token, secret) {
  const p = jwt.verify(token, secret);
  if (p.scope !== 'whatsapp_qr') throw new Error('invalid_scope');
  return p;
}
