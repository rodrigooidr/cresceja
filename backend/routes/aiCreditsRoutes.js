import express from 'express';
import { authenticate } from '../middleware/authenticate.js';
import * as controller from '../controllers/aiCreditsController.js';

const router = express.Router();
router.use(authenticate);
router.get('/status', controller.getStatus);
export default router;
