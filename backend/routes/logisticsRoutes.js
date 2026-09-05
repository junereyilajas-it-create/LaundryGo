const express = require('express');
const router = express.Router();
const logisticsController = require('../controllers/logisticsController');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

// Pickups
router.get('/pickups', authenticateToken, authorizeRole('worker', 'admin', 'driver'), logisticsController.getAllPickups);
router.put('/pickups/:id/status', authenticateToken, authorizeRole('worker', 'admin', 'driver'), logisticsController.updatePickupStatus);
router.delete('/pickups/:id', authenticateToken, authorizeRole('admin'), logisticsController.deletePickup);

// Deliveries
router.get('/deliveries', authenticateToken, authorizeRole('worker', 'admin', 'driver'), logisticsController.getAllDeliveries);
router.put('/deliveries/:id/status', authenticateToken, authorizeRole('worker', 'admin', 'driver'), logisticsController.updateDeliveryStatus);
router.delete('/deliveries/:id', authenticateToken, authorizeRole('admin'), logisticsController.deleteDelivery);

module.exports = router;
