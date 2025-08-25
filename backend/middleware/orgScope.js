// backend/middleware/orgScope.js
export async function orgScope(req, res, next) {
  try {
    const orgId = req.user?.org_id;
    if (!orgId) return res.status(401).json({ message: 'org_id ausente no token' });
    // Guarda orgId na request para ser usada nos serviços/queries
    req.orgId = orgId;
    next();
  } catch (e) {
    next(e);
  }
}
