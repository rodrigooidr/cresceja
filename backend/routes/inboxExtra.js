// backend/routes/inboxExtra.js
import { Router } from 'express';
import { requireRole, ROLES } from '../middleware/requireRole.js';
import * as ctrl from '../controllers/inboxExtraController.js';

const AGENT_ROLES = [ROLES.OrgAgent, ROLES.OrgAdmin, ROLES.OrgOwner, ROLES.SuperAdmin];
const r = Router();

r.post('/conversations/:id/read', requireRole(AGENT_ROLES), ctrl.markRead);
export default r;
