import { Router } from 'express';
import { authRequired } from '../middleware/auth.js';
import { withOrg } from '../middleware/withOrg.js';

const router = Router();
router.use(authRequired, withOrg);

// shape mínimo que o frontend espera
router.get('/settings', (_req, res) => {
  res.json({
    triage: true,
    sse: true,
    shortcuts: true,
    features: { quickReplies: true, templates: true },
  });
});

export default router;
