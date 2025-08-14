import { Router } from 'express';
import { getProgress, check } from '../controllers/onboardingController.js';
// se precisar proteger as rotas, descomente a linha abaixo e use: router.use(authenticate);
// import { authenticate } from '../middleware/authenticate.js';

const router = Router();

// router.use(authenticate);
router.get('/progress', getProgress);
router.post('/check', check);

export default router;
