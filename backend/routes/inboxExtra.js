// backend/routes/inboxExtra.js
import { Router } from 'express';
import * as requireRoleMod from '../middleware/requireRole.js';
import * as ctrl from '../controllers/inboxExtraController.js';

const requireRole =
  requireRoleMod.requireRole ??
  requireRoleMod.default?.requireRole ??
  requireRoleMod.default ??
  requireRoleMod;
const ROLES =
  requireRoleMod.ROLES ??
  requireRoleMod.default?.ROLES ??
  requireRoleMod.ROLES ??
  { OrgAgent: 'OrgAgent', OrgAdmin: 'OrgAdmin', OrgOwner: 'OrgOwner', SuperAdmin: 'SuperAdmin' };

const AGENT_ROLES = [ROLES.OrgAgent, ROLES.OrgAdmin, ROLES.OrgOwner, ROLES.SuperAdmin];
const r = Router();

r.post('/conversations/:id/read', requireRole(AGENT_ROLES), ctrl.markRead);
export default r;
