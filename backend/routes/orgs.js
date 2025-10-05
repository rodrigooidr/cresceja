// backend/routes/orgs.js
import { Router } from 'express';
import { getAccessibleOrganizations, setActiveOrgForUser } from '../services/orgService.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const user = req.user;
    if (!user?.id) {
      return res.status(401).json({ error: 'unauthenticated' });
    }
    const orgs = await getAccessibleOrganizations(user);
    res.json({ data: orgs, items: orgs });
  } catch (err) {
    next(err);
  }
});

router.post('/select', async (req, res, next) => {
  try {
    const user = req.user;
    if (!user?.id) {
      return res.status(401).json({ error: 'unauthenticated' });
    }
    const { orgId } = req.body || {};
    if (!orgId) {
      return res.status(400).json({ error: 'missing_orgId' });
    }
    await setActiveOrgForUser(user.id, orgId);
    res.json({ ok: true, orgId });
  } catch (err) {
    next(err);
  }
});

export default router;
