import { isUuid } from '../utils/isUuid.js';

export function withOrgId(req, res, next) {
  const params = req.params || {};
  const orgId = params.orgId || params.id;
  if (!isUuid(orgId)) {
    const err = new Error('invalid orgId');
    err.status = 400;
    return next(err);
  }
  req.orgId = orgId;
  req.orgScopeValidated = true;
  return next();
}

export default withOrgId;
