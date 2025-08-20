import { Router } from 'express';
import {
  list,
  create,
  qualificar,
  moverParaOportunidade,
} from '../controllers/leadsController.js';
import { authRequired } from '../middleware/auth.js';
import { withOrg } from '../middleware/withOrg.js';
import { requireRole } from '../middleware/requireRole.js';

const router = Router();

router.use(authRequired, withOrg, requireRole('Agent'));

router.get('/', list);
router.post('/', create);
router.put('/:id/qualificar', qualificar);
router.post('/:id/mover-para-oportunidade', moverParaOportunidade);

export default router;
