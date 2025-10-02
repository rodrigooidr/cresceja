import { Router } from 'express';
import { board, create, update } from '../controllers/opportunitiesController.js';
import { authRequired } from '../middleware/auth.js';
import { withOrgScope } from '../middleware/withOrg.js';
import { requireRole, ROLES } from '../middleware/requireRole.js';

const router = Router();

const AGENT_ROLES = [ROLES.OrgAgent, ROLES.OrgAdmin, ROLES.OrgOwner, ROLES.SuperAdmin];

router.use(authRequired, withOrgScope, requireRole(AGENT_ROLES));

router.get('/board', board);
router.post('/', create);
router.put('/:id', update);

export default router;
