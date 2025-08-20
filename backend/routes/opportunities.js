import { Router } from 'express';
import { board, create, update } from '../controllers/opportunitiesController.js';
import { authRequired } from '../middleware/auth.js';
import { withOrg } from '../middleware/withOrg.js';
import { requireRole } from '../middleware/requireRole.js';

const router = Router();

router.use(authRequired, withOrg, requireRole('Agent'));

router.get('/board', board);
router.post('/', create);
router.put('/:id', update);

export default router;
