import { Router } from 'express';
import { getLogs } from '../controllers/auditController.js';

const router = Router();

router.get('/', getLogs);

export default router;
