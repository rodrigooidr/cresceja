const hierarchy = ['Viewer', 'Agent', 'Manager', 'OrgOwner'];

export function requireRole(minRole) {
  const minIndex = hierarchy.indexOf(minRole);
  return (req, res, next) => {
    const role = req.orgRole;
    const idx = hierarchy.indexOf(role);
    if (idx === -1 || idx < minIndex) {
      return res.status(403).json({ error: 'forbidden' });
    }
    next();
  };
}
