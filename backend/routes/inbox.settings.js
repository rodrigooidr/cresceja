import express from 'express';
import { authRequired } from '../middleware/auth.js';
import { withOrg } from '../middleware/withOrg.js';

const router = express.Router();

router.get('/inbox/templates', authRequired, withOrg, (_req, res) => res.json([]));
router.get('/inbox/quick-replies', authRequired, withOrg, (_req, res) => res.json([]));
router.get('/inbox/features', authRequired, withOrg, (_req, res) => res.json({}));

router.get('/inbox/conversations', authRequired, withOrg, (req, res) => {
  const { status = 'open', limit = 50 } = req.query;
  res.json({
    status,
    items: [],
    paging: {
      limit: Number(limit),
      next: null,
    },
  });
});

export default router;
