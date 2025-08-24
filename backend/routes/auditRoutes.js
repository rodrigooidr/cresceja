import express from 'express';
const router = express.Router();
import * as controller from '../controllers/auditController.js';
import { authRequired } from '../middleware/auth.js';

router.use(authRequired);
router.get('/usage', controller.getIaUsage);
router.get('/activity', controller.getActivityLog);

export default router;



