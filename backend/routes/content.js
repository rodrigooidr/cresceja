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
import { requireRole } from '../middleware/requireRole.js';

const router = Router();

router.use(authRequired, withOrg, requireRole('Agent'));

router.get('/assets', listAssets);
router.post('/assets', createAsset);

router.get('/posts', listPosts);
router.get('/posts/:id', getPost);
router.post('/posts', createPost);
router.put('/posts/:id', updatePost);

export default router;
