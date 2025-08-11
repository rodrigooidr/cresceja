const express = require('express');
const router = express.Router();
const controller = require('../controllers/approvalController');
const authenticate = require('../middleware/authenticate');

router.use(authenticate);

router.post('/:postId/request-approval', controller.requestApproval);
router.post('/:postId/approve', controller.approvePost);
router.post('/:postId/reject', controller.rejectPost);
router.get('/:postId/approval-history', controller.getApprovalHistory);

module.exports = router;