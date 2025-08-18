import express from 'express';
const router = express.Router();
import * as controller from '../controllers/auditController.js';
import { authenticate } from '../middleware/authenticate.js';

router.use(authenticate);
router.get('/usage', controller.getIaUsage);
router.get('/activity', controller.getActivityLog);

export default router;



