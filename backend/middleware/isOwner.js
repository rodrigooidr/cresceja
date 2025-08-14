// backend/middleware/isOwner.js
// Exige que o usuário autenticado tenha cargo de dono/owner (ou admin/superadmin).
export function isOwner(req, res, next) {
  try {
    const role = req.user?.role;
    if (role === 'owner' || role === 'admin' || role === 'superadmin') {
      return next();
    }
    return res.status(403).json({ error: 'forbidden' });
  } catch {
    return res.status(401).json({ error: 'unauthorized' });
  }
}
export default isOwner;
