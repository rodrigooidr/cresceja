const express = require('express');
const router = express.Router();
const controller = require('../controllers/auditController');
const authenticate = require('../middleware/authenticate');

router.use(authenticate);
router.get('/usage', controller.getIaUsage);
router.get('/activity', controller.getActivityLog);

module.exports = router;