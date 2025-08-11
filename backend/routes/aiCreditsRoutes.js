import express from 'express';
const router = express.Router();
import controller from '../controllers/aiCreditsController.js';
import authenticate from '../middleware/authenticate.js';

router.use(authenticate);
router.get('/status', controller.getStatus);

export default router;