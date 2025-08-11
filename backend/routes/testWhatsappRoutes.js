import express from 'express';
const router = express.Router();

import authenticate from '../middleware/authenticate.js';
import isOwner from '../middleware/isOwner.js';
import canUseWhatsAppWeb from '../middleware/canUseWhatsAppWeb.js';

import { initSession,
  getSessionStatus,
  logoutSession,
  sendMessage,
  sendTestMessage,
  receiveMessage } from '../controllers/testWhatsappController.js';

router.use(authenticate, isOwner);

router.post('/init', canUseWhatsAppWeb, initSession);
router.get('/status', canUseWhatsAppWeb, getSessionStatus);
router.post('/logout', canUseWhatsAppWeb, logoutSession);
router.post('/send', canUseWhatsAppWeb, sendMessage);

router.post('/send-test', sendTestMessage);
router.post('/receive', receiveMessage);

export default router;
