// Middleware de diagnóstico para logs de feature flag
export function diagFeatureLog(featureKey) {
  return (req, _res, next) => {
    const orgId =
      req?.org?.id ??
      req?.headers?.['x-org-id'] ??
      req?.user?.org_id ??
      req?.user?.orgId ??
      null;
    req._diag = req._diag || {};
    req._diag.feature = { key: featureKey, seenOrgId: orgId };
    try {
      const info = {
        at: 'requireOrgFeature(pre)',
        featureKey,
        seenOrgId: orgId,
        authRole: req.user?.role,
        authRoles: req.user?.roles,
        path: req.originalUrl,
        method: req.method,
      };
      req.log ? req.log.info(info) : console.log(info);
    } catch {}
    next();
  };
}

export default diagFeatureLog;
