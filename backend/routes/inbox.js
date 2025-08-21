import { Router } from 'express';
import { authRequired } from '../middleware/auth.js';
import { withOrg } from '../middleware/withOrg.js';
import { requireRole } from '../middleware/requireRole.js';
import * as ctrl from '../controllers/inboxController.js';

const r = Router();

r.use(authRequired, withOrg);

r.get('/conversations', requireRole('Agent'), ctrl.listConversations);
r.get('/conversations/:id/messages', requireRole('Agent'), ctrl.listMessages);
r.post('/conversations/:id/messages', requireRole('Agent'), ctrl.sendMessage);
r.post('/conversations/:id/ai/enable', requireRole('Agent'), ctrl.enableAI);
r.post('/conversations/:id/ai/disable', requireRole('Agent'), ctrl.disableAI);
r.post('/conversations/:id/handoff', requireRole('Agent'), ctrl.handoffToHuman);
r.post('/conversations/:id/assign', requireRole('Agent'), ctrl.assignConversation);
r.get('/templates', requireRole('Agent'), ctrl.listTemplates);
r.post('/uploads', requireRole('Agent'), ctrl.uploadAsset);
r.post('/messages/:messageId/transcribe', requireRole('Agent'), ctrl.transcribeMessage);

export default r;
