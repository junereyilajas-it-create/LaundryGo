const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

// All user management and profile routes require an authenticated token
router.use(authenticateToken);

// 1. Self Profile Update (Any authenticated user)
router.put('/profile', userController.updateProfile);
router.put('/profile/update', userController.updateProfile);
router.put('/profile/location', userController.updateProfileLocation);

// 2. Driver Application Workflow (Admin Only)
router.get('/driver-applications', authorizeRole('admin'), userController.getDriverApplications);
router.post('/drivers/:id/approve', authorizeRole('admin'), userController.approveDriver);
router.post('/drivers/:id/reapprove', authorizeRole('admin'), userController.reapproveDriver);
router.post('/drivers/:id/reject', authorizeRole('admin'), userController.rejectDriver);
router.post('/drivers/:id/resend-sms', authorizeRole('admin'), userController.resendDriverSms);


// 3. User Management Summary & Operations (Admin Only)
router.get('/summary', authorizeRole('admin'), userController.getUserManagementSummary);
router.get('/customers', authorizeRole('admin', 'worker'), userController.getCustomers);
router.put('/:id/toggle-active', authorizeRole('admin'), userController.toggleUserActive);
router.post('/admin', authorizeRole('admin'), userController.createAdmin);

// 4. User CRUD (Admin & Worker for customer queries)
router.get('/', authorizeRole('admin', 'worker'), userController.getAllUsers);
router.post('/', authorizeRole('admin'), userController.createUser);
router.get('/:id', userController.getUserById);
router.put('/:id', authorizeRole('admin'), userController.updateUser);
router.delete('/:id', authorizeRole('admin'), userController.deleteUser);

module.exports = router;
