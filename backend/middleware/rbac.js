// backend/middleware/rbac.js
export function requireAny(roles) {
  return (req, res, next) => {
    const role = req.user?.role;
    if (!role || !roles.includes(role)) {
      return res.status(403).json({ message: 'forbidden' });
    }
    next();
  };
}

export const requireAgent = requireAny(['Agent','Manager','OrgOwner','SuperAdmin']);
export const requireManager = requireAny(['Manager','OrgOwner','SuperAdmin']);
