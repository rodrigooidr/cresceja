const express = require('express');
const router = express.Router();
const controller = require('../controllers/aiCreditsController');
const authenticate = require('../middleware/authenticate');

router.use(authenticate);
router.get('/status', controller.getStatus);

module.exports = router;