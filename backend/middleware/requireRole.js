module.exports.ROLES = {
  SuperAdmin: 'superAdmin',
  OrgAdmin: 'orgAdmin',
  Support: 'support',
  User: 'user',
};

module.exports.requireRole = (...allowed) => (req, res, next) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'UNAUTHENTICATED' });
    const role = req.user.role || req.user?.roles?.[0];
    if (!role || !allowed.includes(role)) {
      return res.status(403).json({ error: 'FORBIDDEN', required: allowed });
    }
    next();
  } catch (e) {
    next(e);
  }
};
