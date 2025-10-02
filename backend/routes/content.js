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
import { withOrgScope } from '../middleware/withOrg.js';
import { requireRole, ROLES } from '../middleware/requireRole.js';

const router = Router();

const AGENT_ROLES = [ROLES.OrgAgent, ROLES.OrgAdmin, ROLES.OrgOwner, ROLES.SuperAdmin];

router.use(authRequired, withOrgScope, requireRole(AGENT_ROLES));

router.get('/assets', listAssets);
router.post('/assets', createAsset);

router.get('/posts', listPosts);
router.get('/posts/:id', getPost);
router.post('/posts', createPost);
router.put('/posts/:id', updatePost);

export default router;
