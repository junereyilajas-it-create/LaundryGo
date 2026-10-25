const express = require('express');
const router = express.Router();
const driverController = require('../controllers/driverController');
const { authenticateToken, authorizeRole, authorizeApprovedDriver } = require('../middleware/auth');

router.patch('/:id/location', authenticateToken, authorizeRole('driver', 'admin', 'worker'), authorizeApprovedDriver, driverController.updateLocation);

module.exports = router;
