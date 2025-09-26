import express from 'express';
import { query } from '#db';
import * as authModule from '../middleware/auth.js';
import { hasGlobalRole, hasOrgRole, ROLES } from '../lib/permissions.js';

const router = express.Router();
const requireAuth =
  authModule?.requireAuth ||
  authModule?.authRequired ||
  authModule?.default ||
  ((_req, _res, next) => next());

function requireOrgAdmin(req, res, next) {
  if (hasOrgRole(req.user, [ROLES.OrgAdmin, ROLES.OrgOwner])) return next();
  if (hasGlobalRole(req.user, [ROLES.SuperAdmin, ROLES.Support])) return next();
  return res.status(403).json({ error: 'forbidden' });
}

router.put('/calendar/services', requireAuth, requireOrgAdmin, async (req, res, next) => {
  try {
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    for (const it of items) {
      if (!it?.name) return res.status(400).json({ error: 'name_required' });
      if (it?.durationMin && Number.isNaN(Number(it.durationMin))) {
        return res.status(400).json({ error: 'durationMin_invalid' });
      }
    }
    await query(
      `
      UPDATE public.org_ai_settings
         SET collect_fields = jsonb_set(
           COALESCE(collect_fields,'{}'::jsonb),
           '{appointment_services}',
           $2::jsonb,
           true
         ),
             updated_at = now()
       WHERE org_id=$1
    `,
      [req.user?.org_id, JSON.stringify(items)],
    );
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

export default router;
