const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { authenticateToken, authorizeRole, authorizeApprovedDriver } = require('../middleware/auth');

router.use(authenticateToken);
router.use(authorizeApprovedDriver);

// Create order (Customer online request)
router.post('/', authorizeRole('customer'), orderController.createOrder);

// Walk-in / Drop-off Laundry (Worker & Admin)
router.post('/walk-in', authorizeRole('worker', 'admin'), orderController.createWalkInOrder);

// Workflow counts and available drivers for assignment
router.get('/workflow/counts', authorizeRole('worker', 'admin'), orderController.getWorkflowCounts);
router.get('/drivers/available', authorizeRole('worker', 'admin'), orderController.getAvailableDrivers);

// Listing & Single Details
router.get('/', orderController.getOrders);
router.get('/:id', orderController.getOrderById);

// SIMPLIFIED WORKFLOW & WORKER ENDPOINTS
router.put('/:id/start-processing', authorizeRole('worker', 'admin'), orderController.startLaundryProcessing);
router.put('/:id/mark-ready', authorizeRole('worker', 'admin'), orderController.markLaundryReady);
router.put('/:id/complete', authorizeRole('worker', 'admin'), orderController.completeOrder);
router.put('/:id/payment-status', authorizeRole('worker', 'admin'), orderController.updateOrderPaymentStatus);

// CUSTOMER FULFILLMENT CHOICE (Delivery vs Self-Pickup)
router.post('/:id/select-fulfillment', authorizeRole('customer', 'worker', 'admin'), orderController.selectFulfillmentChoice);

// WORKER APPROVAL & DRIVER ASSIGNMENT
router.put('/:id/approve', authorizeRole('worker', 'admin'), orderController.approveOrder);
router.put('/:id/reject', authorizeRole('worker', 'admin'), orderController.rejectOrder);
router.put('/:id/assign-driver', authorizeRole('worker', 'admin'), orderController.assignDriver);
router.put('/:id/confirm-receipt', authorizeRole('worker', 'admin'), orderController.confirmLaundryReceipt);
router.post('/:id/record-weight', authorizeRole('worker', 'admin'), orderController.recordLaundryWeight);
router.put('/:id/send-price', authorizeRole('worker', 'admin'), orderController.sendPriceToCustomer);
router.put('/:id/processing-stage', authorizeRole('worker', 'admin'), orderController.updateProcessingStage);

// CUSTOMER WORKFLOW ENDPOINTS
router.put('/:id/customer-weight-decision', authorizeRole('customer'), orderController.customerWeightDecision);
router.put('/:id/cancel', authorizeRole('customer', 'worker', 'admin'), orderController.cancelOrder);
router.post('/:id/delivery', authorizeRole('customer'), orderController.requestDelivery);

// Generic Status Update & Full CRUD
router.put('/:id/status', authorizeRole('worker', 'admin'), orderController.updateOrderStatus);
router.put('/:id', authorizeRole('worker', 'admin'), orderController.updateOrder);
router.delete('/:id', authorizeRole('admin'), orderController.deleteOrder);

module.exports = router;
