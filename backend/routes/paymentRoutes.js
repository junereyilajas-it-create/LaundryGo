const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

router.use(authenticateToken);

// GCash Checkout and Verification
router.post('/gcash/checkout', paymentController.initiateGcashCheckout);
router.post('/gcash/verify', paymentController.verifyGcashPayment);

// GCash Simulated Demo Payment (Customer)
router.post('/gcash/demo/generate-pin', authorizeRole('customer', 'worker', 'admin'), paymentController.generateGcashDemoPin);
router.post('/gcash/demo/verify-and-pay', authorizeRole('customer', 'worker', 'admin'), paymentController.verifyAndProcessGcashDemoPayment);

// Cash on Delivery (COD) Selection by Customer & Collection by Driver or Worker/Admin
router.post('/cod/select', authorizeRole('customer'), paymentController.selectCodPayment);
router.post('/cod/collect', authorizeRole('driver', 'worker', 'admin'), paymentController.recordCodCollection);

// Payment Listings and Management
router.get('/', authorizeRole('admin', 'worker', 'customer', 'driver'), paymentController.getPayments);
router.get('/order/:orderId', paymentController.getPaymentsByOrderId);
router.get('/:id', paymentController.getPaymentById);
router.post('/', authorizeRole('admin', 'worker', 'customer'), paymentController.createPayment);
router.put('/:id', authorizeRole('admin', 'worker'), paymentController.updatePayment);
router.delete('/:id', authorizeRole('admin'), paymentController.deletePayment);

module.exports = router;
