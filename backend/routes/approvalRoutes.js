import express from 'express';
const router = express.Router();
import controller from '../controllers/approvalController.js';
import authenticate from '../middleware/authenticate.js';

router.use(authenticate);

router.post('/:postId/request-approval', controller.requestApproval);
router.post('/:postId/approve', controller.approvePost);
router.post('/:postId/reject', controller.rejectPost);
router.get('/:postId/approval-history', controller.getApprovalHistory);

export default router;