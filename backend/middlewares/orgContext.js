// backend/middlewares/orgContext.js
export function attachOrgFromHeader(req, _res, next) {
  const h = req.headers['x-org-id'];
  if (h) req.org = req.org ? { ...req.org, id: String(h) } : { id: String(h) };
  next();
}
