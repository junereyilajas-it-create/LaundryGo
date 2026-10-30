const db = require('../config/db');
const bcrypt = require('bcrypt');
const smsService = require('../utils/smsService');
const { logActivity } = require('../utils/activityLogger');

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

// 1. Get Unified User Management Summary (Admin Only)
exports.getUserManagementSummary = async (req, res) => {
    try {
        // Enforce Admin Only
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied: User management is restricted to Administrators.' });
        }

        // Customers with order count
        const [customers] = await db.query(`
            SELECT u.id, u.name, u.email, u.phone, u.created_at, 
                   COALESCE(u.is_active, 1) as is_active,
                   COALESCE(u.approval_status, 'approved') as approval_status,
                   COUNT(lo.id) as total_orders
            FROM users u
            LEFT JOIN laundry_orders lo ON u.id = lo.customer_id
            WHERE u.role = 'customer'
            GROUP BY u.id
            ORDER BY u.created_at DESC
        `);

        // Drivers with active tasks, completed tasks, & application approval status
        const [drivers] = await db.query(`
            SELECT u.id, u.name, u.email, u.phone, u.created_at, 
                   COALESCE(u.is_active, 1) as is_active,
                   COALESCE(u.approval_status, 'pending') as approval_status,
                   da.status as application_status,
                   da.applied_at,
                   da.reviewed_at,
                   da.rejection_reason,
                   da.sms_status,
                   da.sms_sent_at,
                   da.sms_reference,
                   da.sms_error,
                   (SELECT COUNT(*) FROM pickup_requests p WHERE p.driver_id = u.id AND p.status IN ('assigned', 'on_the_way')) as active_pickups,
                   (SELECT COUNT(*) FROM delivery_requests d WHERE d.driver_id = u.id AND d.status IN ('assigned', 'out_for_delivery')) as active_deliveries,
                   ((SELECT COUNT(*) FROM pickup_requests p2 WHERE p2.driver_id = u.id AND p2.status = 'picked_up') +
                    (SELECT COUNT(*) FROM delivery_requests d2 WHERE d2.driver_id = u.id AND d2.status = 'delivered')) as completed_tasks
            FROM users u
            LEFT JOIN driver_applications da ON u.id = da.user_id
            WHERE u.role = 'driver'
            ORDER BY u.created_at DESC
        `);

        // Workers with processed order count
        const [workers] = await db.query(`
            SELECT u.id, u.name, u.email, u.phone, u.created_at, 
                   COALESCE(u.is_active, 1) as is_active,
                   COALESCE(u.approval_status, 'approved') as approval_status,
                   (SELECT COUNT(*) FROM laundry_orders lo WHERE lo.weight_recorded_by = u.id) as completed_processing_tasks
            FROM users u
            WHERE u.role = 'worker'
            ORDER BY u.created_at DESC
        `);

        // Authorized Admin accounts (strictly single admin)
        const [admins] = await db.query(`
            SELECT u.id, u.name, u.email, u.phone, u.created_at, 
                   COALESCE(u.is_active, 1) as is_active,
                   COALESCE(u.approval_status, 'approved') as approval_status
            FROM users u
            WHERE u.role = 'admin'
            ORDER BY u.created_at DESC
        `);

        // Driver Applications list (all applications with full SMS & review audit)
        const [driverApplications] = await db.query(`
            SELECT da.*, 
                   u.name as applicant_name, 
                   u.email as applicant_email, 
                   u.phone as applicant_phone,
                   u.is_active as user_is_active,
                   ru.name as reviewer_name
            FROM driver_applications da
            JOIN users u ON da.user_id = u.id
            LEFT JOIN users ru ON da.reviewed_by = ru.id
            ORDER BY da.applied_at DESC
        `);

        res.json({
            customers,
            drivers,
            workers,
            admins,
            driverApplications,
            totals: {
                customers: customers.length,
                drivers: drivers.length,
                workers: workers.length,
                admins: admins.length,
                pendingDrivers: driverApplications.filter(a => a.status === 'pending').length
            }
        });
    } catch (error) {
        console.error('Error fetching user management summary:', error);
        res.status(500).json({ message: 'Error fetching user management summary', error: error.message });
    }
};

// 2. Get Driver Applications (Admin Only)
exports.getDriverApplications = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied: Admin only.' });
        }

        const [applications] = await db.query(`
            SELECT da.*, 
                   u.name as applicant_name, 
                   u.email as applicant_email, 
                   u.phone as applicant_phone,
                   u.is_active as user_is_active,
                   ru.name as reviewer_name
            FROM driver_applications da
            JOIN users u ON da.user_id = u.id
            LEFT JOIN users ru ON da.reviewed_by = ru.id
            ORDER BY da.applied_at DESC
        `);

        res.json(applications);
    } catch (error) {
        console.error('Error fetching driver applications:', error);
        res.status(500).json({ message: 'Error fetching driver applications', error: error.message });
    }
};

// 3. Approve Driver Application (Admin Only)
exports.approveDriver = async (req, res) => {
    const driverId = parseInt(req.params.id);

    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied: Only an Administrator can approve driver applications.' });
        }

        const [drivers] = await db.query(
            `SELECT u.id, u.name, u.email, u.phone, u.approval_status, da.status as app_status 
             FROM users u 
             LEFT JOIN driver_applications da ON u.id = da.user_id 
             WHERE u.id = ? AND u.role = 'driver'`,
            [driverId]
        );

        if (drivers.length === 0) {
            return res.status(404).json({ message: 'Driver account not found.' });
        }

        const driver = drivers[0];

        // Idempotency: Prevent re-approval of an already approved driver
        if (driver.approval_status === 'approved' && driver.app_status === 'approved') {
            return res.status(400).json({ message: `Driver ${driver.name} is already approved.` });
        }

        // Database Transaction for Atomic State Commit
        const connection = await db.getConnection();
        await connection.beginTransaction();

        try {
            // Activate driver account and set approval_status to 'approved'
            await connection.query(
                'UPDATE users SET is_active = 1, approval_status = "approved" WHERE id = ?',
                [driverId]
            );

            // Update or insert driver application record
            await connection.query(`
                INSERT INTO driver_applications (user_id, status, reviewed_at, reviewed_by, sms_status)
                VALUES (?, 'approved', NOW(), ?, 'not_sent')
                ON DUPLICATE KEY UPDATE 
                    status = 'approved', 
                    reviewed_at = NOW(), 
                    reviewed_by = VALUES(reviewed_by),
                    rejection_reason = NULL
            `, [driverId, req.user.id]);

            // In-app notification for the driver
            await connection.query(
                'INSERT INTO notifications (user_id, title, message) VALUES (?, "Driver Application Approved", ?)',
                [
                    driverId,
                    'Congratulations! Your LaundriGo driver application has been approved. You now have full access to delivery assignments and the driver dashboard.'
                ]
            );

            await connection.commit();
        } catch (dbErr) {
            await connection.rollback();
            throw dbErr;
        } finally {
            connection.release();
        }

        console.log(`✓ Driver #${driverId} (${driver.name}) successfully approved in database.`);

        // Send SMS Notification ONLY after database transaction has successfully committed
        let smsResult = { success: false, status: 'not_configured', message: 'No phone number provided' };
        if (driver.phone) {
            smsResult = await smsService.sendDriverApprovalNotification(driver.name, driver.phone);

            // Record SMS delivery status in driver_applications table
            if (smsResult.success) {
                await db.query(
                    'UPDATE driver_applications SET sms_status = "sent", sms_sent_at = NOW(), sms_reference = ?, sms_error = NULL WHERE user_id = ?',
                    [smsResult.reference || 'SENT', driverId]
                );
            } else {
                await db.query(
                    'UPDATE driver_applications SET sms_status = ?, sms_error = ? WHERE user_id = ?',
                    [smsResult.status === 'not_configured' ? 'not_configured' : 'failed', smsResult.error || 'SMS send failed', driverId]
                );
            }
        } else {
            await db.query(
                'UPDATE driver_applications SET sms_status = "failed", sms_error = "Driver has no registered phone number" WHERE user_id = ?',
                [driverId]
            );
        }

        await logActivity({
            req,
            actorId: req.user.id,
            actorName: req.user.name,
            actorRole: req.user.role,
            actionType: 'driver_approved',
            description: `Approved and activated driver application for ${driver.name} (#${driverId})`,
            entityType: 'user',
            entityId: driverId,
            outcome: 'success',
            metadata: { driver_name: driver.name, phone: driver.phone, sms_status: smsResult.status }
        });

        res.json({
            message: `Driver ${driver.name} has been approved and activated.`,
            driverId,
            approval_status: 'approved',
            is_active: 1,
            sms: {
                sent: smsResult.success,
                status: smsResult.status,
                provider: smsResult.provider || null,
                reference: smsResult.reference || null,
                feedback: smsResult.success 
                    ? `Approval SMS dispatched to ${driver.phone}`
                    : (smsResult.status === 'not_configured' 
                        ? 'Driver approved. SMS provider is not configured (set SEMAPHORE_API_KEY in .env to enable SMS).' 
                        : `Driver approved. SMS dispatch failed: ${smsResult.error}`)
            }
        });
    } catch (error) {
        console.error('Error approving driver:', error);
        res.status(500).json({ message: 'Error approving driver application', error: error.message });
    }
};

// 3b. Re-Approve Driver Application (Admin Only)
exports.reapproveDriver = async (req, res) => {
    const driverId = parseInt(req.params.id);

    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied: Only an Administrator can re-approve driver applications.' });
        }

        const [drivers] = await db.query(
            `SELECT u.id, u.name, u.email, u.phone, u.approval_status, u.is_active, da.status as app_status 
             FROM users u 
             LEFT JOIN driver_applications da ON u.id = da.user_id 
             WHERE u.id = ? AND u.role = 'driver'`,
            [driverId]
        );

        if (drivers.length === 0) {
            return res.status(404).json({ message: 'Driver account not found.' });
        }

        const driver = drivers[0];

        // Idempotency: Prevent re-approval if already active & approved
        if (driver.approval_status === 'approved' && driver.app_status === 'approved' && driver.is_active === 1) {
            return res.status(400).json({ message: `Driver ${driver.name} is already active and approved.` });
        }

        // Database Transaction for Atomic State Commit
        const connection = await db.getConnection();
        await connection.beginTransaction();

        try {
            await connection.query(
                'UPDATE users SET is_active = 1, approval_status = "approved" WHERE id = ?',
                [driverId]
            );

            await connection.query(`
                INSERT INTO driver_applications (user_id, status, reviewed_at, reviewed_by, sms_status)
                VALUES (?, 'approved', NOW(), ?, 'not_sent')
                ON DUPLICATE KEY UPDATE 
                    status = 'approved', 
                    reviewed_at = NOW(), 
                    reviewed_by = VALUES(reviewed_by),
                    rejection_reason = NULL
            `, [driverId, req.user.id]);

            await connection.query(
                'INSERT INTO notifications (user_id, title, message) VALUES (?, "Driver Application Re-Approved", ?)',
                [
                    driverId,
                    'Congratulations! Your LaundriGo driver application has been re-approved by the Administrator. You now have full access to delivery assignments and the driver dashboard.'
                ]
            );

            await connection.commit();
        } catch (dbErr) {
            await connection.rollback();
            throw dbErr;
        } finally {
            connection.release();
        }

        console.log(`✓ Driver #${driverId} (${driver.name}) successfully re-approved by Admin.`);

        let smsResult = { success: false, status: 'not_configured', message: 'No phone number provided' };
        if (driver.phone) {
            smsResult = await smsService.sendDriverApprovalNotification(driver.name, driver.phone);

            if (smsResult.success) {
                await db.query(
                    'UPDATE driver_applications SET sms_status = "sent", sms_sent_at = NOW(), sms_reference = ?, sms_error = NULL WHERE user_id = ?',
                    [smsResult.reference || 'REAPPROVED', driverId]
                );
            } else {
                await db.query(
                    'UPDATE driver_applications SET sms_status = ?, sms_error = ? WHERE user_id = ?',
                    [smsResult.status === 'not_configured' ? 'not_configured' : 'failed', smsResult.error || 'SMS send failed', driverId]
                );
            }
        }

        await logActivity({
            req,
            actorId: req.user.id,
            actorName: req.user.name,
            actorRole: req.user.role,
            actionType: 'driver_reapproved',
            description: `Re-approved driver application for ${driver.name} (#${driverId})`,
            entityType: 'user',
            entityId: driverId,
            outcome: 'success',
            metadata: { driver_name: driver.name, phone: driver.phone, sms_status: smsResult.status }
        });

        res.json({
            message: `Driver ${driver.name} has been successfully re-approved and activated.`,
            driverId,
            approval_status: 'approved',
            is_active: 1,
            sms: {
                sent: smsResult.success,
                status: smsResult.status,
                provider: smsResult.provider || null,
                reference: smsResult.reference || null,
                feedback: smsResult.success 
                    ? `Approval SMS dispatched to ${driver.phone}`
                    : (smsResult.status === 'not_configured' 
                        ? 'Driver re-approved. SMS provider is not configured (set SEMAPHORE_API_KEY in .env to enable SMS).' 
                        : `Driver re-approved. SMS dispatch failed: ${smsResult.error}`)
            }
        });
    } catch (error) {
        console.error('Error re-approving driver:', error);
        res.status(500).json({ message: 'Error re-approving driver application', error: error.message });
    }
};

// 4. Reject Driver Application (Admin Only)
exports.rejectDriver = async (req, res) => {

    const driverId = parseInt(req.params.id);
    const { reason } = req.body || {};

    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied: Only an Administrator can reject driver applications.' });
        }

        const [drivers] = await db.query(
            `SELECT u.id, u.name, u.email, da.status as app_status 
             FROM users u 
             LEFT JOIN driver_applications da ON u.id = da.user_id 
             WHERE u.id = ? AND u.role = 'driver'`,
            [driverId]
        );

        if (drivers.length === 0) {
            return res.status(404).json({ message: 'Driver account not found.' });
        }

        const driver = drivers[0];
        const rejectionReason = (reason && reason.trim()) ? reason.trim() : 'Application did not meet LaundriGo driver requirements.';

        // Database Transaction
        const connection = await db.getConnection();
        await connection.beginTransaction();

        try {
            // Keep driver deactivated and mark as rejected
            await connection.query(
                'UPDATE users SET is_active = 0, approval_status = "rejected" WHERE id = ?',
                [driverId]
            );

            await connection.query(`
                INSERT INTO driver_applications (user_id, status, reviewed_at, reviewed_by, rejection_reason)
                VALUES (?, 'rejected', NOW(), ?, ?)
                ON DUPLICATE KEY UPDATE 
                    status = 'rejected', 
                    reviewed_at = NOW(), 
                    reviewed_by = VALUES(reviewed_by),
                    rejection_reason = VALUES(rejection_reason)
            `, [driverId, req.user.id, rejectionReason]);

            // In-app notification for the driver
            await connection.query(
                'INSERT INTO notifications (user_id, title, message) VALUES (?, "Driver Application Update", ?)',
                [
                    driverId,
                    `Your LaundriGo driver application has not been approved. Reason: ${rejectionReason}`
                ]
            );

            await connection.commit();
        } catch (dbErr) {
            await connection.rollback();
            throw dbErr;
        } finally {
            connection.release();
        }

        await logActivity({
            req,
            actorId: req.user.id,
            actorName: req.user.name,
            actorRole: req.user.role,
            actionType: 'driver_rejected',
            description: `Rejected driver application for ${driver.name} (#${driverId}). Reason: ${rejectionReason}`,
            entityType: 'user',
            entityId: driverId,
            outcome: 'failure',
            metadata: { driver_name: driver.name, reason: rejectionReason }
        });

        res.json({
            message: `Driver application for ${driver.name} has been rejected.`,
            driverId,
            approval_status: 'rejected',
            is_active: 0,
            rejection_reason: rejectionReason
        });
    } catch (error) {
        console.error('Error rejecting driver:', error);
        res.status(500).json({ message: 'Error rejecting driver application', error: error.message });
    }
};

// 5. Resend Approval SMS (Admin Only)
exports.resendDriverSms = async (req, res) => {
    const driverId = parseInt(req.params.id);

    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied: Admin only.' });
        }

        const [drivers] = await db.query(
            `SELECT u.id, u.name, u.phone, u.approval_status 
             FROM users u 
             WHERE u.id = ? AND u.role = 'driver'`,
            [driverId]
        );

        if (drivers.length === 0) {
            return res.status(404).json({ message: 'Driver not found.' });
        }

        const driver = drivers[0];

        if (driver.approval_status !== 'approved') {
            return res.status(400).json({ message: 'Cannot send approval SMS: Driver application is not approved yet.' });
        }

        if (!driver.phone) {
            return res.status(400).json({ message: 'Driver does not have a registered mobile number.' });
        }

        const smsResult = await smsService.sendDriverApprovalNotification(driver.name, driver.phone);

        if (smsResult.success) {
            await db.query(
                'UPDATE driver_applications SET sms_status = "sent", sms_sent_at = NOW(), sms_reference = ?, sms_error = NULL WHERE user_id = ?',
                [smsResult.reference || 'RESENT', driverId]
            );
            await logActivity({
                req,
                actorId: req.user.id,
                actorName: req.user.name,
                actorRole: req.user.role,
                actionType: 'sms_resend',
                description: `Resent approval SMS to driver ${driver.name} (${driver.phone}) - Reference: ${smsResult.reference || 'SENT'}`,
                entityType: 'user',
                entityId: driverId,
                outcome: 'success',
                metadata: { phone: driver.phone, reference: smsResult.reference }
            });
            return res.json({
                message: `Approval SMS sent successfully to ${driver.phone}.`,
                sms: smsResult
            });
        } else {
            await db.query(
                'UPDATE driver_applications SET sms_status = ?, sms_error = ? WHERE user_id = ?',
                [smsResult.status === 'not_configured' ? 'not_configured' : 'failed', smsResult.error || 'Failed to dispatch SMS', driverId]
            );
            await logActivity({
                req,
                actorId: req.user.id,
                actorName: req.user.name,
                actorRole: req.user.role,
                actionType: 'sms_resend',
                description: `Failed to resend approval SMS to ${driver.name} (${driver.phone}): ${smsResult.error || smsResult.status}`,
                entityType: 'user',
                entityId: driverId,
                outcome: 'failure',
                metadata: { phone: driver.phone, error: smsResult.error, status: smsResult.status }
            });
            return res.status(400).json({
                message: smsResult.status === 'not_configured'
                    ? 'SMS provider is not configured. Set SEMAPHORE_API_KEY in backend/.env'
                    : `SMS dispatch failed: ${smsResult.error}`,
                sms: smsResult
            });
        }
    } catch (error) {
        console.error('Error resending driver SMS:', error);
        res.status(500).json({ message: 'Error resending approval SMS', error: error.message });
    }
};

// 6. Toggle User Active / Inactive Status (Admin Only)
exports.toggleUserActive = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied: Admin only.' });
        }

        const userId = parseInt(req.params.id);

        const [users] = await db.query(
            'SELECT id, name, role, email, COALESCE(is_active, 1) as is_active FROM users WHERE id = ?',
            [userId]
        );
        if (users.length === 0) return res.status(404).json({ message: 'User not found' });
        const user = users[0];

        const targetStatus = user.is_active ? 0 : 1;

        // Prevent self-deactivation by the single administrator
        if (req.user.id === userId && targetStatus === 0) {
            return res.status(400).json({ message: 'You cannot deactivate your own administrative account.' });
        }

        // If deactivating a driver, verify no active pickup or delivery tasks exist!
        if (user.role === 'driver' && targetStatus === 0) {
            const [activePickups] = await db.query(
                'SELECT id FROM pickup_requests WHERE driver_id = ? AND status IN ("assigned", "on_the_way")',
                [userId]
            );
            const [activeDeliveries] = await db.query(
                'SELECT id FROM delivery_requests WHERE driver_id = ? AND status IN ("assigned", "out_for_delivery")',
                [userId]
            );

            const totalActive = activePickups.length + activeDeliveries.length;
            if (totalActive > 0) {
                return res.status(400).json({
                    message: `Cannot deactivate driver ${user.name}: Driver currently has ${totalActive} active assignment(s). Please reassign or resolve those tasks first.`
                });
            }
        }

        await db.query('UPDATE users SET is_active = ? WHERE id = ?', [targetStatus, userId]);

        await logActivity({
            req,
            actorId: req.user.id,
            actorName: req.user.name,
            actorRole: req.user.role,
            actionType: targetStatus ? 'user_activated' : 'user_deactivated',
            description: `${targetStatus ? 'Activated' : 'Deactivated'} ${user.role} account for ${user.name} (${user.email})`,
            entityType: 'user',
            entityId: userId,
            outcome: 'success',
            metadata: { targetStatus, user_name: user.name, role: user.role }
        });

        res.json({
            message: `User ${user.name} is now ${targetStatus ? 'Activated' : 'Deactivated'}.`,
            userId: user.id,
            is_active: targetStatus
        });
    } catch (error) {
        console.error('Error toggling user active status:', error);
        res.status(500).json({ message: 'Error toggling user status', error: error.message });
    }
};

// 7. Enforce Single Admin Architecture: Disable Creation of Additional Admins
exports.createAdmin = async (req, res) => {
    return res.status(403).json({
        message: 'LaundriGo operates with a single authorized Administrator account (Junerey@gmail.com). Additional administrator accounts are not permitted.'
    });
};

// 8. Standard getAllUsers (Admin or Worker for customer list)
exports.getAllUsers = async (req, res) => {
    try {
        const { role } = req.query;
        if (req.user.role !== 'admin' && !(req.user.role === 'worker' && role === 'customer')) {
            return res.status(403).json({ message: 'Access denied.' });
        }

        let query = 'SELECT id, name, email, role, phone, COALESCE(is_active, 1) as is_active, COALESCE(approval_status, "approved") as approval_status, created_at FROM users';
        let params = [];
        if (role) {
            query += ' WHERE role = ?';
            params.push(role.toLowerCase());
        }
        query += ' ORDER BY created_at DESC';
        const [users] = await db.query(query, params);
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching users', error: error.message });
    }
};

// 9. Get User By ID (Admin Only or Self)
exports.getUserById = async (req, res) => {
    try {
        const targetId = parseInt(req.params.id);
        if (req.user.role !== 'admin' && req.user.id !== targetId) {
            return res.status(403).json({ message: 'Access denied.' });
        }

        const [users] = await db.query(
            'SELECT id, name, email, role, phone, COALESCE(is_active, 1) as is_active, COALESCE(approval_status, "approved") as approval_status, created_at FROM users WHERE id = ?',
            [targetId]
        );
        if (users.length === 0) return res.status(404).json({ message: 'User not found' });
        res.json(users[0]);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching user', error: error.message });
    }
};

// 10. Create User (Customer, Worker, Driver by Admin)
exports.createUser = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied: Only an Administrator can create new user accounts.' });
        }

        const { name, email, password, phone, role } = req.body;
        if (!name || !email || !password) return res.status(400).json({ message: 'Missing required fields' });
        
        const normalizedEmail = email.trim().toLowerCase();
        if (!EMAIL_REGEX.test(normalizedEmail)) {
            return res.status(400).json({ message: 'Invalid email format' });
        }

        const targetRole = (role || 'customer').toLowerCase();
        if (targetRole === 'admin') {
            return res.status(403).json({ message: 'Additional Administrator accounts cannot be created.' });
        }

        const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [normalizedEmail]);
        if (existing.length > 0) {
            return res.status(409).json({ message: 'This email address is already registered. Please log in or use another email.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const isDriver = targetRole === 'driver';
        const approvalStatus = isDriver ? 'approved' : 'approved'; // Admin-created accounts are approved

        const [result] = await db.query(
            'INSERT INTO users (name, email, password, phone, role, is_active, approval_status, created_by) VALUES (?, ?, ?, ?, ?, 1, ?, ?)',
            [name.trim(), normalizedEmail, hashedPassword, phone ? phone.trim() : null, targetRole, approvalStatus, req.user.id]
        );

        if (isDriver) {
            await db.query(`
                INSERT INTO driver_applications (user_id, status, reviewed_at, reviewed_by, sms_status)
                VALUES (?, 'approved', NOW(), ?, 'not_configured')
            `, [result.insertId, req.user.id]);
        }

        await logActivity({
            req,
            actorId: req.user.id,
            actorName: req.user.name,
            actorRole: req.user.role,
            actionType: 'user_created',
            description: `Created new ${targetRole} account for ${name.trim()} (${normalizedEmail})`,
            entityType: 'user',
            entityId: result.insertId,
            outcome: 'success',
            metadata: { created_name: name.trim(), email: normalizedEmail, role: targetRole }
        });

        res.status(201).json({ message: 'User created successfully', id: result.insertId });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY' || error.errno === 1062) {
            return res.status(409).json({ message: 'This email address is already registered. Please log in or use another email.' });
        }
        res.status(500).json({ message: 'Error creating user', error: error.message });
    }
};

// 11. Update User (Admin Only)
exports.updateUser = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied: Admin only.' });
        }

        const { name, email, phone, role, password, is_active, approval_status } = req.body;
        
        let fields = [];
        let params = [];
        
        if (name) { fields.push('name = ?'); params.push(name.trim()); }
        if (email) { fields.push('email = ?'); params.push(email.trim().toLowerCase()); }
        if (phone !== undefined) { fields.push('phone = ?'); params.push(phone ? phone.trim() : null); }
        if (role) { 
            if (role === 'admin') {
                return res.status(403).json({ message: 'Role escalation to Admin is not permitted.' });
            }
            fields.push('role = ?'); 
            params.push(role); 
        }
        if (is_active !== undefined) {
            fields.push('is_active = ?');
            params.push(is_active ? 1 : 0);
        }
        if (approval_status) {
            fields.push('approval_status = ?');
            params.push(approval_status);
        }
        if (password) {
            if (password.length < 8) {
                return res.status(400).json({ message: 'Password must be at least 8 characters long.' });
            }
            const hashedPassword = await bcrypt.hash(password, 10);
            fields.push('password = ?');
            params.push(hashedPassword);
        }
        
        if (fields.length === 0) return res.status(400).json({ message: 'No fields to update' });
        
        params.push(req.params.id);
        const query = `UPDATE users SET ${fields.join(', ')} WHERE id = ?`;
        
        const [result] = await db.query(query, params);
        if (result.affectedRows === 0) return res.status(404).json({ message: 'User not found' });
        
        await logActivity({
            req,
            actorId: req.user.id,
            actorName: req.user.name,
            actorRole: req.user.role,
            actionType: 'user_updated',
            description: `Updated account details for user #${req.params.id}`,
            entityType: 'user',
            entityId: req.params.id,
            outcome: 'success',
            metadata: { updatedUserId: req.params.id, name, email, role }
        });

        res.json({ message: 'User updated successfully' });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY' || error.errno === 1062) {
            return res.status(409).json({ message: 'This email address is already in use by another account.' });
        }
        res.status(500).json({ message: 'Error updating user', error: error.message });
    }
};

// 12. Update Profile (Self Service for Authenticated User)
exports.updateProfile = async (req, res) => {
    try {
        const { name, phone, password } = req.body;
        
        let fields = [];
        let params = [];
        
        if (name) { fields.push('name = ?'); params.push(name.trim()); }
        if (phone !== undefined) { fields.push('phone = ?'); params.push(phone ? phone.trim() : null); }
        if (password) {
            if (password.length < 8) {
                return res.status(400).json({ message: 'Password must be at least 8 characters long.' });
            }
            const hashedPassword = await bcrypt.hash(password, 10);
            fields.push('password = ?');
            params.push(hashedPassword);
        }
        
        if (fields.length === 0) return res.status(400).json({ message: 'No fields to update' });
        
        params.push(req.user.id);
        const query = `UPDATE users SET ${fields.join(', ')} WHERE id = ?`;
        
        const [result] = await db.query(query, params);
        if (result.affectedRows === 0) return res.status(404).json({ message: 'User not found' });
        
        await logActivity({
            req,
            actorId: req.user.id,
            actorName: req.user.name,
            actorRole: req.user.role,
            actionType: 'profile_updated',
            description: `${req.user.name} updated their profile settings`,
            entityType: 'user',
            entityId: req.user.id,
            outcome: 'success'
        });

        res.json({ message: 'Profile updated successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error updating profile', error: error.message });
    }
};

// 13. Delete User (Admin Only)
exports.deleteUser = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied: Admin only.' });
        }

        const targetId = parseInt(req.params.id);

        // Cannot delete self or primary admin
        if (req.user.id === targetId) {
            return res.status(400).json({ message: 'You cannot delete the primary administrator account.' });
        }

        const [userCheck] = await db.query('SELECT name, email, role FROM users WHERE id = ?', [targetId]);
        if (userCheck.length > 0 && userCheck[0].email.toLowerCase() === 'junerey@gmail.com') {
            return res.status(400).json({ message: 'The primary administrator account cannot be deleted.' });
        }

        const [result] = await db.query('DELETE FROM users WHERE id = ?', [targetId]);
        if (result.affectedRows === 0) return res.status(404).json({ message: 'User not found' });

        await logActivity({
            req,
            actorId: req.user.id,
            actorName: req.user.name,
            actorRole: req.user.role,
            actionType: 'user_deleted',
            description: `Deleted ${userCheck[0]?.role || 'user'} account #${targetId} (${userCheck[0]?.name || ''})`,
            entityType: 'user',
            entityId: targetId,
            outcome: 'success'
        });

        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting user', error: error.message });
    }
};

// 14. Update Confirmed Location in Customer Profile (Pin Location on Map)
exports.updateProfileLocation = async (req, res) => {
    try {
        const { address, latitude, longitude } = req.body;
        const userId = req.user.id;

        if (!address || !address.trim()) {
            return res.status(400).json({ message: 'Address description is required.' });
        }

        const lat = parseFloat(latitude);
        const lng = parseFloat(longitude);

        if (isNaN(lat) || lat < -90 || lat > 90 || isNaN(lng) || lng < -180 || lng > 180) {
            return res.status(400).json({ message: 'Valid latitude and longitude coordinates are required.' });
        }

        const trimmedAddress = address.trim();

        // 1. Update user profile default location
        await db.query(
            'UPDATE users SET default_address = ?, latitude = ?, longitude = ? WHERE id = ?',
            [trimmedAddress, lat, lng, userId]
        );

        // 2. Also ensure address is added/updated in addresses table
        const [existing] = await db.query(
            'SELECT id FROM addresses WHERE user_id = ? AND (address = ? OR (ABS(latitude - ?) < 0.0001 AND ABS(longitude - ?) < 0.0001))',
            [userId, trimmedAddress, lat, lng]
        );

        let addressId;
        if (existing.length > 0) {
            addressId = existing[0].id;
            await db.query('UPDATE addresses SET address = ?, latitude = ?, longitude = ? WHERE id = ?', [trimmedAddress, lat, lng, addressId]);
        } else {
            const [ins] = await db.query(
                'INSERT INTO addresses (user_id, address, latitude, longitude) VALUES (?, ?, ?, ?)',
                [userId, trimmedAddress, lat, lng]
            );
            addressId = ins.insertId;
        }

        // 3. Centralized Activity Log
        await logActivity({
            req,
            actorId: userId,
            actorName: req.user.name,
            actorRole: req.user.role,
            actionType: 'profile_location_saved',
            description: `${req.user.name} confirmed and pinned their pickup location: ${trimmedAddress} (${lat.toFixed(5)}, ${lng.toFixed(5)})`,
            entityType: 'address',
            entityId: addressId,
            outcome: 'success',
            metadata: { address: trimmedAddress, latitude: lat, longitude: lng }
        });

        res.json({
            message: 'Pickup location saved successfully to profile.',
            address: trimmedAddress,
            latitude: lat,
            longitude: lng,
            addressId
        });
    } catch (error) {
        console.error('Error updating profile location:', error);
        res.status(500).json({ message: 'Error saving profile location', error: error.message });
    }
};

// 13. Get all active customers for Walk-in Laundry (Admin & Worker)
exports.getCustomers = async (req, res) => {
    try {
        const [customers] = await db.query(
            'SELECT id, name, email, phone, default_address, created_at FROM users WHERE role = "customer" AND COALESCE(is_active, 1) = 1 ORDER BY name ASC'
        );
        res.json(customers);
    } catch (error) {
        console.error('Error fetching customers:', error);
        res.status(500).json({ message: 'Error fetching customers', error: error.message });
    }
};

