const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

router.get('/:orderId', messageController.getOrderMessages);
router.post('/:orderId', messageController.sendOrderMessage);

module.exports = router;
