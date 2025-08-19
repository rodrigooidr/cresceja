import { Router } from 'express';
import {
  getLogs,
  getIaUsage,
  getActivityLog
} from '../controllers/auditController.js';
import { authenticate } from '../middleware/authenticate.js';

const router = Router();
router.use(authenticate);
router.get('/', getLogs);
router.get('/usage', getIaUsage);
router.get('/activity', getActivityLog);

export default router;
