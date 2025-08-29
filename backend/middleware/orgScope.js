// middleware/orgScope.js
export function orgScope(req, res, next) {
  let orgId = req.user?.org_id;
  if (!orgId && (req.user?.role === 'SuperAdmin' || req.user?.is_support)) {
    orgId = req.headers['x-org-id'] || null;
  }
  if (!orgId) return res.status(401).json({ message: 'org_id missing in token' });
  req.orgId = orgId;
  next();
}

