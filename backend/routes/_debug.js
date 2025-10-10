import express from 'express';
import { getUserRoles } from '../middlewares/auth.js';

const router = express.Router();

router.get('/whoami', (req, res) => {
  res.json({
    user: {
      id: req.user?.id,
      email: req.user?.email,
      role: req.user?.role,
      roles: getUserRoles(req),
    },
    org_id: req.org?.id || req.headers['x-org-id'] || null,
  });
});

export default router;
