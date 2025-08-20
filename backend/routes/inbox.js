import { Router } from 'express';
import { authRequired } from '../middleware/auth.js';
import { withOrg } from '../middleware/withOrg.js';
import { requireRole } from '../middleware/requireRole.js';
import * as ctrl from '../controllers/inboxController.js';

const router = Router();

router.use(authRequired, withOrg, requireRole('Agent'));

router.get('/', ctrl.list);
router.get('/:id/messages', ctrl.getMessages);
router.post('/:id/messages', ctrl.sendMessage);
router.patch('/:id/status', ctrl.updateStatus);
router.patch('/:id/assign', ctrl.assign);

export default router;
