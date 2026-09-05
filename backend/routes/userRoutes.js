const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

// Allow workers and admins to manage all users
router.get('/', authenticateToken, authorizeRole('worker', 'admin'), userController.getAllUsers);
router.post('/', authenticateToken, authorizeRole('worker', 'admin'), userController.createUser);

// Anyone can get their own info, or worker/admin can get any user
router.get('/:id', authenticateToken, userController.getUserById);

router.put('/:id', authenticateToken, authorizeRole('worker', 'admin'), userController.updateUser);
router.delete('/:id', authenticateToken, authorizeRole('admin'), userController.deleteUser);

module.exports = router;
