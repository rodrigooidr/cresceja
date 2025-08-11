const express = require('express');
const router = express.Router();

const authenticate = require('../middleware/authenticate');
const isOwner = require('../middleware/isOwner');
const canUseWhatsAppWeb = require('../middleware/canUseWhatsAppWeb');

const {
  initSession,
  getSessionStatus,
  logoutSession,
  sendMessage,
  sendTestMessage,
  receiveMessage
} = require('../controllers/testWhatsappController');

router.use(authenticate, isOwner);

router.post('/init', canUseWhatsAppWeb, initSession);
router.get('/status', canUseWhatsAppWeb, getSessionStatus);
router.post('/logout', canUseWhatsAppWeb, logoutSession);
router.post('/send', canUseWhatsAppWeb, sendMessage);

router.post('/send-test', sendTestMessage);
router.post('/receive', receiveMessage);

module.exports = router;
