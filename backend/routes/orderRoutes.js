const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

router.post('/', authenticateToken, authorizeRole('customer'), orderController.createOrder);
router.get('/', authenticateToken, orderController.getOrders);
router.get('/:id', authenticateToken, orderController.getOrderById);

// Update status (worker/admin)
router.put('/:id/status', authenticateToken, authorizeRole('worker', 'admin'), orderController.updateOrderStatus);

// Customer request delivery
router.post('/:id/delivery', authenticateToken, authorizeRole('customer'), orderController.requestDelivery);

// Full CRUD (Admin)
router.put('/:id', authenticateToken, authorizeRole('worker', 'admin'), orderController.updateOrder);
router.delete('/:id', authenticateToken, authorizeRole('admin'), orderController.deleteOrder);

module.exports = router;
