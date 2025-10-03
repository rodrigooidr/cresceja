import { Router } from 'express';
import { authRequired } from '../middleware/auth.js';
import { withOrg } from '../middleware/withOrg.js';

const router = Router();
router.get('/ai/settings', authRequired, withOrg, (_req, res) => {
  res.json({ providers: { openai: true }, features: { smartReplies: true, summaries: true }, limits: { dailyRequests: 1000 } });
});

export default router;
