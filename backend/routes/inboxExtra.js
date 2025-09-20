// backend/routes/inboxExtra.js
import { Router } from 'express';
import * as requireRoleMod from '../middleware/requireRole.js';
import * as ctrl from '../controllers/inboxExtraController.js';

const requireRole = requireRoleMod.requireRole ?? requireRoleMod.default?.requireRole ?? requireRoleMod.default ?? requireRoleMod;
const r = Router();

r.post('/conversations/:id/read', requireRole('Agent'), ctrl.markRead);
export default r;
