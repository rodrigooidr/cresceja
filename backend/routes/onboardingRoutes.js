import express from 'express';
const router = express.Router();
import controller from '../controllers/onboardingController.js';
import authenticate from '../middleware/authenticate.js';

router.use(authenticate);
router.post('/check', controller.checkStep);
router.get('/progress', controller.getProgress);

export default router;