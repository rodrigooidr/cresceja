import { Router } from 'express';
import { board, create, update } from '../controllers/opportunitiesController.js';

const router = Router();

router.get('/board', board);
router.post('/', create);
router.put('/:id', update);

export default router;
