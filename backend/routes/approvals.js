import { Router } from 'express';
import { authRequired } from '../middleware/auth.js';
import { requestApproval, approvePost, rejectPost, getApprovalHistory } from '../controllers/approvalController.js';

const router = Router();

// Protege todas as rotas
router.use(authRequired);

// Rotas de aprovação
router.post('/:postId/request', requestApproval);
router.post('/:postId/approve', approvePost);
router.post('/:postId/reject', rejectPost);
router.get('/:postId', getApprovalHistory);

export default router;
