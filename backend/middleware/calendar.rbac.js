const ALLOWED_PROFILES = ['orgagent', 'orgadmin', 'orgowner', 'support', 'superadmin'];
const ROLE_ALIASES = {
  admin: 'orgadmin',
  owner: 'orgowner',
  operator: 'orgagent',
  marketing: 'orgagent',
  agent: 'orgagent',
  support: 'support',
  superadmin: 'superadmin',
};

export function resolveRole(req) {
  const headerRole = (req.get && req.get('x-user-role')) || req.headers?.['x-user-role'];
  const userRole = req.user?.calendarRole || req.user?.role;
  const role = String(headerRole || userRole || '').trim().toLowerCase();
  const normalized = ROLE_ALIASES[role] || role;
  return normalized && ALLOWED_PROFILES.includes(normalized) ? normalized : null;
}

export function requireCalendarRole(roles = ['OrgOwner', 'Support', 'SuperAdmin']) {
  const wanted = Array.isArray(roles)
    ? roles.map((r) => ROLE_ALIASES[String(r).toLowerCase()] || String(r).toLowerCase())
    : [];
  return (req, res, next) => {
    const role = resolveRole(req);
    const allowed = (wanted.length === 0 && !!role) || (role && wanted.includes(role));
    if (allowed) {
      req.calendarRole = role;
      return next();
    }
    return res.status(403).json({ error: 'forbidden', reason: 'calendar_role_required' });
  };
}
