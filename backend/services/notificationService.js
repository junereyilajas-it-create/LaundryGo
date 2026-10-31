const db = require('../config/db');
const jwt = require('jsonwebtoken');

let ioInstance = null;

/**
 * Initialize Socket.IO instance and attach authentication middleware
 */
function initSocket(io) {
    ioInstance = io;

    // Socket authentication middleware
    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth?.token || socket.handshake.query?.token;
            if (!token) {
                return next(new Error('Authentication token required'));
            }

            const cleanToken = token.startsWith('Bearer ') ? token.slice(7) : token;
            const secret = process.env.JWT_SECRET || 'laundrigo_super_secret_jwt_key_2026';
            const decoded = jwt.verify(cleanToken, secret);

            // Fetch user from db to ensure account is valid and active
            const [users] = await db.query(
                'SELECT id, name, email, role, is_active, approval_status FROM users WHERE id = ?',
                [decoded.id]
            );

            if (users.length === 0 || (users[0].is_active !== undefined && !users[0].is_active)) {
                return next(new Error('User not found or account deactivated'));
            }

            socket.user = users[0];
            next();
        } catch (err) {
            console.warn('Socket authentication error:', err.message);
            next(new Error('Authentication failed: ' + err.message));
        }
    });

    io.on('connection', async (socket) => {
        const user = socket.user;
        const userRoom = `user_${user.id}`;
        const roleRoom = `role_${user.role}`;

        socket.join(userRoom);
        socket.join(roleRoom);

        console.log(`🔌 [Socket.IO] User #${user.id} (${user.name}, ${user.role}) connected to rooms: ${userRoom}, ${roleRoom}`);

        // Immediately send latest unread count on connection/reconnection
        try {
            const count = await getUnreadCount(user.id);
            socket.emit('notification:unread_count', { count });
        } catch (e) {
            console.error('Error sending initial unread count:', e.message);
        }

        socket.on('disconnect', (reason) => {
            console.log(`🔌 [Socket.IO] User #${user.id} disconnected (${reason})`);
        });
    });

    console.log('✓ Real-time Socket.IO notification service initialized.');
}

function getIo() {
    return ioInstance;
}

/**
 * Get unread notification count for a user
 */
async function getUnreadCount(userId) {
    const [rows] = await db.query(
        'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0',
        [userId]
    );
    return rows[0]?.count || 0;
}

/**
 * Check if user allowed this notification category
 */
async function isNotificationAllowed(userId, type) {
    // System and critical alerts are always allowed
    if (type === 'system') return true;

    try {
        const [prefs] = await db.query(
            'SELECT * FROM notification_preferences WHERE user_id = ?',
            [userId]
        );

        if (prefs.length === 0) return true; // Default to true if no preference set

        const userPref = prefs[0];
        if (type === 'order' || type === 'laundry') {
            return userPref.laundry_updates !== 0;
        }
        if (type === 'payment') {
            return userPref.payment_updates !== 0;
        }
        if (type === 'delivery') {
            return userPref.delivery_updates !== 0;
        }
        if (type === 'account') {
            return userPref.account_updates !== 0;
        }

        return true;
    } catch (e) {
        console.error('Error checking notification preference:', e.message);
        return true; // Fail safe to allowed
    }
}

/**
 * Resolve target URL based on user role and context
 */
function resolveTargetUrl(userRole, { type, orderId, customUrl }) {
    if (customUrl) return customUrl;

    if (userRole === 'customer') {
        if (orderId) return `/customer/orders?orderId=${orderId}`;
        if (type === 'payment') return '/customer/payments';
        if (type === 'delivery') return '/customer/tracking';
        return '/customer/orders';
    }

    if (userRole === 'worker') {
        if (orderId) return `/worker/orders?orderId=${orderId}`;
        if (type === 'payment') return '/worker/payments';
        if (type === 'delivery') return '/worker/tracking';
        return '/worker/orders';
    }

    if (userRole === 'admin') {
        if (type === 'account' || type === 'system') return '/worker/users?tab=applications';
        if (orderId) return `/worker/orders?orderId=${orderId}`;
        if (type === 'payment') return '/worker/payments';
        if (type === 'delivery') return '/worker/tracking';
        return '/worker/orders';
    }

    if (userRole === 'driver') {
        if (orderId) return `/driver?orderId=${orderId}`;
        if (type === 'delivery') return '/driver/map';
        return '/driver';
    }

    return null;
}

/**
 * Core notification creation function
 */
async function createNotification({
    userId,
    title,
    message,
    type,
    notificationType,
    orderId = null,
    relatedOrderId = null,
    relatedUserId = null,
    targetUrl = null
}) {
    try {
        const finalType = type || notificationType || 'order';
        const finalOrderId = orderId || relatedOrderId || null;

        if (!userId || !title || !message) {
            console.warn('createNotification missing required fields:', { userId, title, message });
            return null;
        }

        // 1. Check user preferences
        const allowed = await isNotificationAllowed(userId, finalType);
        if (!allowed) {
            console.log(`Notification skipped for user #${userId} due to preference setting (category: ${finalType})`);
            return null;
        }

        // 2. Prevent duplicate notifications for the exact same event within 60 seconds
        const [recent] = await db.query(
            `SELECT id FROM notifications 
             WHERE user_id = ? AND title = ? AND message = ? 
             AND created_at >= NOW() - INTERVAL 1 MINUTE 
             LIMIT 1`,
            [userId, title, message]
        );

        if (recent.length > 0) {
            console.log(`Duplicate notification suppressed for user #${userId}: "${title}"`);
            return null;
        }

        // 3. Resolve target URL if not specified
        const [userRows] = await db.query('SELECT role FROM users WHERE id = ?', [userId]);
        const userRole = userRows[0]?.role || 'customer';
        const finalTargetUrl = resolveTargetUrl(userRole, { type: finalType, orderId: finalOrderId, customUrl: targetUrl });

        // 4. Validate foreign key references
        let safeOrderId = null;
        if (finalOrderId) {
            const [orderCheck] = await db.query('SELECT id FROM laundry_orders WHERE id = ?', [finalOrderId]);
            if (orderCheck.length > 0) {
                safeOrderId = finalOrderId;
            }
        }

        let safeUserId = null;
        if (relatedUserId) {
            const [userCheck] = await db.query('SELECT id FROM users WHERE id = ?', [relatedUserId]);
            if (userCheck.length > 0) {
                safeUserId = relatedUserId;
            }
        }

        // 5. Insert notification
        const [result] = await db.query(
            `INSERT INTO notifications 
             (user_id, order_id, related_order_id, related_user_id, title, message, notification_type, target_url, is_read, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, NOW())`,
            [userId, safeOrderId, safeOrderId, safeUserId, title, message, finalType, finalTargetUrl]
        );

        const newId = result.insertId;

        // 5. Fetch complete inserted record
        const [createdRows] = await db.query(
            'SELECT * FROM notifications WHERE id = ?',
            [newId]
        );
        const notification = createdRows[0];

        // 6. Real-time emit to the target user
        if (ioInstance) {
            const userRoom = `user_${userId}`;
            const unreadCount = await getUnreadCount(userId);

            ioInstance.to(userRoom).emit('notification:new', notification);
            ioInstance.to(userRoom).emit('notification:unread_count', { count: unreadCount });
            console.log(`🚀 [Socket.IO] Real-time notification delivered to user #${userId} (Unread: ${unreadCount}): "${title}"`);
        }

        return notification;
    } catch (err) {
        console.error('Error creating notification:', err);
        return null;
    }
}

/**
 * Helper to notify all workers and the administrator
 */
async function notifyWorkersAndAdmin({
    title,
    message,
    type,
    notificationType,
    orderId = null,
    relatedOrderId = null,
    relatedUserId = null,
    targetUrl = null
}) {
    try {
        const finalType = type || notificationType || 'order';
        const finalOrderId = orderId || relatedOrderId || null;

        const [staff] = await db.query(
            `SELECT id, role FROM users 
             WHERE role IN ('worker', 'admin') AND (is_active IS NULL OR is_active = 1)`
        );

        const results = [];
        for (const person of staff) {
            // Avoid notifying the person who triggered it if relatedUserId is provided
            if (relatedUserId && person.id === relatedUserId) continue;

            const res = await createNotification({
                userId: person.id,
                title,
                message,
                type: finalType,
                orderId: finalOrderId,
                relatedUserId,
                targetUrl
            });
            if (res) results.push(res);
        }
        return results;
    } catch (e) {
        console.error('Error in notifyWorkersAndAdmin:', e);
        return [];
    }
}

/**
 * Helper to notify only the administrator(s)
 */
async function notifyAdmins({
    title,
    message,
    type,
    notificationType,
    orderId = null,
    relatedOrderId = null,
    relatedUserId = null,
    targetUrl = null
}) {
    try {
        const finalType = type || notificationType || 'system';
        const finalOrderId = orderId || relatedOrderId || null;

        const [admins] = await db.query(
            "SELECT id FROM users WHERE role = 'admin' AND (is_active IS NULL OR is_active = 1)"
        );

        const results = [];
        for (const admin of admins) {
            const res = await createNotification({
                userId: admin.id,
                title,
                message,
                type: finalType,
                orderId: finalOrderId,
                relatedUserId,
                targetUrl: targetUrl || '/worker/users?tab=applications'
            });
            if (res) results.push(res);
        }
        return results;
    } catch (e) {
        console.error('Error in notifyAdmins:', e);
        return [];
    }
}

/**
 * Broadcast notification count update via Socket.IO
 */
async function emitUnreadCountUpdate(userId) {
    if (!ioInstance || !userId) return;
    try {
        const count = await getUnreadCount(userId);
        ioInstance.to(`user_${userId}`).emit('notification:unread_count', { count });
    } catch (e) {
        console.error('Error emitting unread count update:', e.message);
    }
}

module.exports = {
    initSocket,
    getIo,
    getUnreadCount,
    createNotification,
    notifyWorkersAndAdmin,
    notifyAdmins,
    emitUnreadCountUpdate,
    isNotificationAllowed
};
