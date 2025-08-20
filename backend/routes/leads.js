import { Router } from 'express';
import {
  list,
  create,
  qualificar,
  moverParaOportunidadeStub,
} from '../controllers/leadsController.js';

const router = Router();

router.get('/', list);
router.post('/', create);
router.put('/:id/qualificar', qualificar);
router.post('/:id/mover-para-oportunidade', moverParaOportunidadeStub);

export default router;
