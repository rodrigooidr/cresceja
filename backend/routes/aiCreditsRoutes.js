import express from 'express';
import { authRequired } from '../middleware/auth.js';
import * as controller from '../controllers/aiCreditsController.js';

const router = express.Router();
router.use(authRequired);
router.get('/status', controller.getStatus);
export default router;
