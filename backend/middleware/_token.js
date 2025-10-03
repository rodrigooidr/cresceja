// backend/middleware/_token.js
export function extractBearer(req) {
  const rawHeader = req.headers?.authorization ?? req.headers?.Authorization ?? '';
  const candidates = String(rawHeader || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((value) => value.replace(/^Bearer\s+/i, ''));

  if (req.query?.access_token) {
    candidates.unshift(String(req.query.access_token));
  }

  if (req.cookies?.authToken) {
    candidates.unshift(String(req.cookies.authToken));
  }

  return candidates.find((token) => token && token.length > 10) || null;
}
