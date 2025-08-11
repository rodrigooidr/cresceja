const express = require('express');
const router = express.Router();
const controller = require('../controllers/onboardingController');
const authenticate = require('../middleware/authenticate');

router.use(authenticate);
router.post('/check', controller.checkStep);
router.get('/progress', controller.getProgress);

module.exports = router;