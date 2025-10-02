// ESM
export function extractBearerToken(req) {
  // 1) Authorization (normalizar vírgulas/dúplicas)
  let raw = req.headers?.authorization || req.headers?.Authorization || '';
  if (typeof raw === 'string' && raw.includes(',')) {
    raw = raw.split(',')[0]; // pega o primeiro "Bearer ..."
  }
  const m = /^Bearer\s+(.+)$/i.exec(raw || '');
  if (m && m[1]) return m[1].trim();

  // 2) Query (?access_token= ou ?token=) — usado por SSE/EventSource
  const q = req.query?.access_token || req.query?.token;
  if (typeof q === 'string' && q.length > 10) return q.trim();

  // 3) Cookie (se algum dia usar)
  const c = req.cookies?.access_token;
  if (typeof c === 'string' && c.length > 10) return c.trim();

  return null;
}
