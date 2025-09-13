// backend/middleware/requireOrgHeader.js

export function requireOrgHeader(req, res, next) {
  const orgId = req.get('X-Org-Id');
  if (!orgId) {
    return res.status(400).json({ error: 'org_required', message: 'missing X-Org-Id' });
  }
  next();
}

