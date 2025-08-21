// backend/routes/inboxExtra.js
import { Router } from 'express';
import { requireRole } from '../middleware/requireRole.js';
import * as ctrl from '../controllers/inboxExtraController.js';
const r = Router();

r.post('/conversations/:id/read', requireRole('Agent'), ctrl.markRead);
export default r;
