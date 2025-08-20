import { Router } from 'express';
import { authRequired } from '../middleware/auth.js';
import { withOrg } from '../middleware/withOrg.js';
import { requireRole } from '../middleware/requireRole.js';
import * as ctrl from '../controllers/channelsController.js';

const router = Router();

router.use(authRequired, withOrg, requireRole('Manager'));

router.get('/', ctrl.list);
router.post('/', ctrl.create);
router.put('/:id', ctrl.update);
router.delete('/:id', ctrl.remove);
router.post('/whatsapp/baileys/session', ctrl.baileysSession);

export default router;
