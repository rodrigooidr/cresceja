import { Router } from 'express';
import { authRequired } from '../middleware/auth.js';
import { withOrg } from '../middleware/withOrg.js';

const router = Router();
router.use(authRequired, withOrg);

router.get('/templates', (_req, res) => res.json({ items: [] }));
router.get('/quick-replies', (_req, res) => res.json({ items: [] }));

export default router;
