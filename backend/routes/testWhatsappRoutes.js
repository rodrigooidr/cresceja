const express = require('express');
const router = express.Router();
const testWhatsapp = require('../controllers/testWhatsappController');
const authenticate = require('../middleware/authenticate');
const isOwner = require('../middleware/isOwner');

router.use(authenticate, isOwner);
router.post('/init', testWhatsapp.initSession);
router.get('/messages', testWhatsapp.getMessages);
router.post('/send', testWhatsapp.sendMessage);

module.exports = router;