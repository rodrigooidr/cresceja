import { Router } from 'express';
import { getLogs } from '../controllers/auditController.js';
import { authRequired, requireRole } from '../middleware/auth.js';

const router = Router();

router.get('/', authRequired, requireRole('admin','manager'), getLogs);

export default router;
