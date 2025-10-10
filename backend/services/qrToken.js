import jwt from 'jsonwebtoken';

const TTL = 60;

export function signQrToken({ userId, orgId, secret, ttl = TTL }) {
  if (!secret) throw new Error('JWT secret not configured');
  const now = Math.floor(Date.now() / 1000);
  return jwt.sign(
    { sub: String(userId), org_id: String(orgId), scope: 'whatsapp_qr', iat: now, exp: now + ttl },
    secret,
  );
}

export function verifyQrToken(token, secret) {
  const p = jwt.verify(token, secret);
  if (p.scope !== 'whatsapp_qr') throw new Error('invalid_scope');
  return p;
}
