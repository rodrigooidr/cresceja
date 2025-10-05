// backend/middleware/orgContext.js
export default function orgContext(req, _res, next) {
  const activeOrgId = req.get?.('x-org-id') ?? req.headers?.['x-org-id'];
  if (!req.context || typeof req.context !== 'object') {
    req.context = {};
  }
  if (activeOrgId) {
    req.context.orgId = activeOrgId;
  }
  next();
}
