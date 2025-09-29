const UUID_RX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function withOrgId(req, res, next) {
  const params = req.params || {};
  const orgId = params.orgId || params.id;
  if (!UUID_RX.test(orgId || '')) {
    const err = new Error('invalid orgId');
    err.status = 400;
    return next(err);
  }
  req.orgId = orgId;
  return next();
}

export default withOrgId;
