
import { query } from '../config/db.js';

export async function ensureConsent(req,res,next){
  // If lead exists and has consent=false, add a header so UI can prompt
  const leadId = req.headers['x-lead-id'];
  if(!leadId) return next();
  const r = await query('SELECT consent FROM leads WHERE id=$1',[leadId]);
  if(r.rowCount && !r.rows[0].consent){
    res.setHeader('X-Requires-Consent','true');
  }
  next();
}
