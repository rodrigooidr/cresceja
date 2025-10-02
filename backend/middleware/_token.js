// backend/middleware/_token.js (ESM)
export function extractBearerToken(req) {
  // 1) header Authorization
  let raw = req.headers?.authorization || req.headers?.Authorization || '';
  if (typeof raw === 'string' && raw.includes(',')) {
    // alguns navegadores/axios colam mais de um header — pega o primeiro
    raw = raw.split(',')[0];
  }
  let m = /^Bearer\s+(.+)$/i.exec(raw || '');
  if (m && m[1]) return m[1].trim();

  // 2) query ?access_token=
  const q = req.query?.access_token || req.query?.token;
  if (typeof q === 'string' && q.length > 10) return q.trim();

  // 3) cookie (opcional, se você usar)
  const c = req.cookies?.access_token;
  if (typeof c === 'string' && c.length > 10) return c.trim();

  return null;
}
