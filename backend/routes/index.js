const express = require('express');
const router = express.Router();
const repurposeController = require('../controllers/repurposeController');
const iaController = require('../controllers/iaController');
const crmController = require('../controllers/crmController');
const authenticate = require('../middleware/authenticate');

router.post('/ia/parse-message', authenticate, iaController.parseMessage);
router.post('/crm-leads/auto-create', authenticate, crmController.autoCreateLead);
router.post('/posts/:postId/repurpose', authenticate, repurposeController.repurposePost);
router.use('/test-whatsapp', require('./testWhatsappRoutes'));
router.use('/approvals', require('./approvalRoutes'));
router.use('/ai-credits', require('./aiCreditsRoutes'));
router.use('/onboarding', require('./onboardingRoutes'));
router.use('/audit', require('./auditRoutes'));

module.exports = router;