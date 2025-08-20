import { Router } from 'express';
import {
  list,
  create,
  qualificar,
  moverParaOportunidade,
} from '../controllers/leadsController.js';

const router = Router();

router.get('/', list);
router.post('/', create);
router.put('/:id/qualificar', qualificar);
router.post('/:id/mover-para-oportunidade', moverParaOportunidade);

export default router;
