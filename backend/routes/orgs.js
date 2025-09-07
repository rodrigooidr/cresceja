import { Router } from 'express';
import { authRequired } from '../middleware/auth.js';
import { withOrg } from '../middleware/withOrg.js';
import { requireRole } from '../middleware/requireRole.js';
import { getMe, adminList, adminCreate } from '../controllers/orgsController.js';

const router = Router();

const requireSuperAdmin = (req, res, next) => {
  if (req.user?.is_superadmin) return next();
  return res.status(403).json({ error: 'forbidden' });
};

// GET /api/orgs/me -> retorna a org vinculada ao token
router.get('/me', authRequired, withOrg, requireRole('Viewer'), getMe);
router.get('/admin/orgs', authRequired, requireSuperAdmin, adminList);
router.post('/admin/orgs', authRequired, requireSuperAdmin, adminCreate);

export default router;
