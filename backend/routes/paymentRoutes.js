const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

router.get('/', authenticateToken, authorizeRole('admin', 'worker'), paymentController.getPayments);
router.get('/:id', authenticateToken, paymentController.getPaymentById);
router.post('/', authenticateToken, authorizeRole('admin', 'worker', 'customer'), paymentController.createPayment);
router.put('/:id', authenticateToken, authorizeRole('admin', 'worker'), paymentController.updatePayment);
router.delete('/:id', authenticateToken, authorizeRole('admin'), paymentController.deletePayment);

module.exports = router;
