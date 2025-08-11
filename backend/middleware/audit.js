
import { audit } from '../services/audit.js';

export async function auditMiddleware(req,res,next){
  const start = Date.now();
  const end = res.end;
  res.end = function(...args){
    const duration = Date.now() - start;
    audit({
      user_id: req.user?.id || null,
      company_id: req.user?.company_id || null,
      action: `${req.method} ${req.path}`,
      resource: req.path,
      channel: 'api',
      metadata: { statusCode: res.statusCode, duration }
    }).catch(()=>{});
    end.apply(this, args);
  };
  next();
}
