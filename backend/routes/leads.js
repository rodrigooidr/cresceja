import { Router } from 'express';
import {
  list,
  create,
  qualificar,
  moverParaOportunidade,
} from '../controllers/leadsController.js';
import { authRequired } from '../middleware/auth.js';
import { withOrg } from '../middleware/withOrg.js';
import * as requireRoleMod from '../middleware/requireRole.js';

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

const router = Router();

router.use(authRequired, withOrg, requireRole(AGENT_ROLES));

router.get('/', list);
router.post('/', create);
router.put('/:id/qualificar', qualificar);
router.post('/:id/mover-para-oportunidade', moverParaOportunidade);

export default router;
