import { Router } from 'express';
import { listOpportunities, createOpportunity, updateOpportunity } from '../controllers/opportunitiesController.js';

const router = Router();

router.get('/', listOpportunities);
router.post('/', createOpportunity);
router.put('/:id', updateOpportunity);

export default router;
