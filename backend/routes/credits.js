import { Router } from 'express';
import { getStatus } from '../controllers/aiCreditsController.js';

const router = Router();

router.get('/status', getStatus);

export default router;
