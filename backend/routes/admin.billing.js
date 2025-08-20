// backend/routes/admin.billing.js
import { Router } from 'express';
import { authRequired } from '../middleware/auth.js';
import { setPlan, getStatus, reactivate } from '../controllers/adminBillingController.js';

const router = Router();

const requireSuperAdmin = (req, res, next) => {
  if (req.user?.is_superadmin) return next();
  return res.status(403).json({ error: 'forbidden' });
};

router.use(authRequired, requireSuperAdmin);

router.post('/:orgId/subscription', setPlan);
router.get('/:orgId', getStatus);
router.post('/:orgId/reactivate', reactivate);

export default router;
