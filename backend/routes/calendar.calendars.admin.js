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

router.put('/calendar/calendars/:name/permissions', requireAuth, requireOrgAdmin, async (req, res, next) => {
  try {
    const orgId = req.user?.org_id;
    const name = req.params.name;

    if (!name) return res.status(400).json({ error: 'name_required' });

    const { aliases = [], skills = [], slotMin = null, buffers = {} } = req.body || {};

    if (!Array.isArray(aliases) || !Array.isArray(skills)) {
      return res.status(400).json({ error: 'aliases_and_skills_must_be_arrays' });
    }
    if (slotMin !== null && (Number.isNaN(Number(slotMin)) || Number(slotMin) <= 0)) {
      return res.status(400).json({ error: 'slotMin_invalid' });
    }
    if (buffers && typeof buffers !== 'object') {
      return res.status(400).json({ error: 'buffers_invalid' });
    }

    const parseBuffer = (value) => {
      if (value === null || value === undefined || value === '') return null;
      const num = Number(value);
      return Number.isNaN(num) ? null : num;
    };

    const perms = {
      aliases: aliases.map((a) => String(a).trim().toLowerCase()).filter(Boolean),
      skills: skills.map((s) => String(s).trim()).filter(Boolean),
      ...(slotMin ? { slotMin: Number(slotMin) } : {}),
      ...(buffers
        ? {
            buffers: {
              pre: parseBuffer(buffers.pre),
              post: parseBuffer(buffers.post),
            },
          }
        : {}),
    };

    const upd = await query(
      `
      UPDATE public.channel_accounts
         SET permissions_json = COALESCE($3::jsonb, '{}'::jsonb)
       WHERE org_id=$1
         AND channel='google_calendar'
         AND lower(name)=lower($2)
    `,
      [orgId, name, JSON.stringify(perms)],
    );

    res.json({ ok: true, updated: upd.rowCount });
  } catch (e) {
    next(e);
  }
});

export default router;
