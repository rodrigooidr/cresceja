import { Router } from 'express';
import {
  list,
  create,
  qualificar,
  moverParaOportunidade,
} from '../controllers/leadsController.js';
import { authRequired } from '../middleware/auth.js';
import { withOrgScope } from '../middleware/withOrg.js';
import { requireRole, ROLES } from '../middleware/requireRole.js';

const AGENT_ROLES = [ROLES.OrgAgent, ROLES.OrgAdmin, ROLES.OrgOwner, ROLES.SuperAdmin];

const router = Router();

router.use(authRequired, withOrgScope, requireRole(AGENT_ROLES));

router.get('/', list);
router.post('/', create);
router.put('/:id/qualificar', qualificar);
router.post('/:id/mover-para-oportunidade', moverParaOportunidade);

export default router;
