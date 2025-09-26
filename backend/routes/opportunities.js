import { Router } from 'express';
import { board, create, update } from '../controllers/opportunitiesController.js';
import { authRequired } from '../middleware/auth.js';
import { withOrg } from '../middleware/withOrg.js';
import * as requireRoleMod from '../middleware/requireRole.js';

const router = Router();

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

router.use(authRequired, withOrg, requireRole(AGENT_ROLES));

router.get('/board', board);
router.post('/', create);
router.put('/:id', update);

export default router;
