const express = require('express');
const router = express.Router();
const serviceController = require('../controllers/serviceController');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

router.get('/', serviceController.getServices);
router.get('/:id', serviceController.getServiceById);
router.post('/', authenticateToken, authorizeRole('admin', 'worker'), serviceController.createService);
router.put('/:id', authenticateToken, authorizeRole('admin', 'worker'), serviceController.updateService);
router.delete('/:id', authenticateToken, authorizeRole('admin', 'worker'), serviceController.deleteService);

module.exports = router;
