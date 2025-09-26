import { Router } from 'express';
import {
  listAssets,
  createAsset,
  listPosts,
  getPost,
  createPost,
  updatePost,
} from '../controllers/contentController.js';
import { authRequired } from '../middleware/auth.js';
import { withOrg } from '../middleware/withOrg.js';
import * as requireRoleMod from '../middleware/requireRole.js';

const router = Router();

const requireRole =
  requireRoleMod.requireRole ??
  requireRoleMod.default?.requireRole ??
  requireRoleMod.default ??
  requireRoleMod;
const ROLES =
  requireRoleMod.ROLES ??
  requireRoleMod.default?.ROLES ??
  requireRoleMod.ROLES ??
  { OrgAgent: 'OrgAgent', OrgAdmin: 'OrgAdmin', OrgOwner: 'OrgOwner', SuperAdmin: 'SuperAdmin' };

const AGENT_ROLES = [ROLES.OrgAgent, ROLES.OrgAdmin, ROLES.OrgOwner, ROLES.SuperAdmin];

router.use(authRequired, withOrg, requireRole(AGENT_ROLES));

router.get('/assets', listAssets);
router.post('/assets', createAsset);

router.get('/posts', listPosts);
router.get('/posts/:id', getPost);
router.post('/posts', createPost);
router.put('/posts/:id', updatePost);

export default router;
