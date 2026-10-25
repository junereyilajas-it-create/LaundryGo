const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

// All report routes strictly restricted to Admin role
router.use(authenticateToken);
router.use(authorizeRole('admin'));

router.get('/', reportController.getBusinessReport);

module.exports = router;
