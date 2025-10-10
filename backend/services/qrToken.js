import jwt from 'jsonwebtoken';

const DEFAULT_TTL = 60; // segundos

export function signQrToken({ userId, orgId, secret, ttl = DEFAULT_TTL }) {
  if (!secret) throw new Error('JWT secret not configured');
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: String(userId),
    org_id: String(orgId),
    scope: 'whatsapp_qr',
    iat: now,
    exp: now + ttl,
  };
  return jwt.sign(payload, secret, { algorithm: 'HS256' });
}

export function verifyQrToken(token, secret) {
  const payload = jwt.verify(token, secret, { algorithms: ['HS256'] });
  if (payload.scope !== 'whatsapp_qr') {
    throw new Error('invalid_scope');
  }
  return payload;
}
