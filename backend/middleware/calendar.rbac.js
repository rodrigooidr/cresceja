const ALLOWED_PROFILES = ['OrgAgent', 'OrgAdmin', 'OrgOwner', 'Support', 'SuperAdmin'];

function resolveRole(req) {
  const headerRole = (req.get && req.get('x-user-role')) || req.headers?.['x-user-role'];
  const userRole = req.user?.calendarRole || req.user?.role;
  const role = (headerRole || userRole || '').toLowerCase();
  return role && ALLOWED_PROFILES.includes(role) ? role : null;
}

function requireCalendarRole(roles = ['OrgOwner', 'Support', 'SuperAdmin']) {
  const wanted = roles.map((r) => r.toLowerCase());
  return (req, res, next) => {
    const role = resolveRole(req);
    if (role && (wanted.length === 0 || wanted.includes(role))) {
      req.calendarRole = role;
      return next();
    }
    return res.status(403).json({ error: 'forbidden', reason: 'calendar_role_required' });
  };
}

module.exports = { requireCalendarRole, resolveRole };
