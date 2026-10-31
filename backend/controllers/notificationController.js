const db = require('../config/db');
const { emitUnreadCountUpdate } = require('../services/notificationService');

/**
 * Fetch notifications of logged-in user
 * Supports ?filter=all|unread, ?limit=50, ?page=1
 */
const getNotifications = async (req, res) => {
    try {
        const userId = req.user.id;
        const filter = req.query.filter || 'all';
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const offset = (page - 1) * limit;

        let query = 'SELECT * FROM notifications WHERE user_id = ?';
        const params = [userId];

        if (filter === 'unread') {
            query += ' AND is_read = 0';
        }

        query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);

        const [notifications] = await db.query(query, params);

        // Also fetch total unread count
        const [unreadResult] = await db.query(
            'SELECT COUNT(*) as unread_count FROM notifications WHERE user_id = ? AND is_read = 0',
            [userId]
        );
        const unreadCount = unreadResult[0]?.unread_count || 0;

        // If client requested paginated object format
        if (req.query.paginated === 'true') {
            const [countResult] = await db.query(
                filter === 'unread'
                    ? 'SELECT COUNT(*) as total FROM notifications WHERE user_id = ? AND is_read = 0'
                    : 'SELECT COUNT(*) as total FROM notifications WHERE user_id = ?',
                [userId]
            );
            const total = countResult[0]?.total || 0;

            return res.json({
                notifications,
                total,
                unread_count: unreadCount,
                page,
                total_pages: Math.ceil(total / limit)
            });
        }

        // Default: return notifications array directly for complete backwards-compatibility
        res.json(notifications);
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ message: 'Error fetching notifications', error: error.message });
    }
};

/**
 * Fetch only unread notifications
 */
const getUnreadNotifications = async (req, res) => {
    try {
        const userId = req.user.id;
        const [notifications] = await db.query(
            'SELECT * FROM notifications WHERE user_id = ? AND is_read = 0 ORDER BY created_at DESC',
            [userId]
        );
        res.json(notifications);
    } catch (error) {
        console.error('Error fetching unread notifications:', error);
        res.status(500).json({ message: 'Error fetching unread notifications', error: error.message });
    }
};

/**
 * Get count of unread notifications
 */
const getUnreadCount = async (req, res) => {
    try {
        const userId = req.user.id;
        const [result] = await db.query(
            'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0',
            [userId]
        );
        const count = result[0]?.count || 0;
        res.json({ unread_count: count, count, unreadCount: count });
    } catch (error) {
        console.error('Error getting unread count:', error);
        res.status(500).json({ message: 'Error getting unread count', error: error.message });
    }
};

/**
 * Mark a single notification as read
 */
const markAsRead = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const [result] = await db.query(
            'UPDATE notifications SET is_read = 1, read_at = NOW() WHERE id = ? AND user_id = ?',
            [id, userId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Notification not found' });
        }

        await emitUnreadCountUpdate(userId);

        const [countResult] = await db.query(
            'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0',
            [userId]
        );
        const unreadCount = countResult[0]?.count || 0;

        res.json({ 
            message: 'Notification marked as read', 
            id: parseInt(id),
            unread_count: unreadCount,
            count: unreadCount,
            unreadCount 
        });
    } catch (error) {
        console.error('Error marking notification as read:', error);
        res.status(500).json({ message: 'Error updating notification', error: error.message });
    }
};

/**
 * Mark a single notification as unread
 */
const markAsUnread = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const [result] = await db.query(
            'UPDATE notifications SET is_read = 0, read_at = NULL WHERE id = ? AND user_id = ?',
            [id, userId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Notification not found' });
        }

        await emitUnreadCountUpdate(userId);

        const [countResult] = await db.query(
            'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0',
            [userId]
        );
        const unreadCount = countResult[0]?.count || 0;

        res.json({ 
            message: 'Notification marked as unread', 
            id: parseInt(id),
            unread_count: unreadCount,
            count: unreadCount,
            unreadCount
        });
    } catch (error) {
        console.error('Error marking notification as unread:', error);
        res.status(500).json({ message: 'Error updating notification', error: error.message });
    }
};

/**
 * Mark all notifications as read for logged-in user
 */
const markAllAsRead = async (req, res) => {
    try {
        const userId = req.user.id;
        await db.query(
            'UPDATE notifications SET is_read = 1, read_at = NOW() WHERE user_id = ? AND is_read = 0',
            [userId]
        );

        await emitUnreadCountUpdate(userId);
        res.json({ 
            message: 'All notifications marked as read',
            unread_count: 0,
            count: 0,
            unreadCount: 0
        });
    } catch (error) {
        console.error('Error marking all notifications as read:', error);
        res.status(500).json({ message: 'Error updating notifications', error: error.message });
    }
};

/**
 * Delete a single notification
 */
const deleteNotification = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const [result] = await db.query(
            'DELETE FROM notifications WHERE id = ? AND user_id = ?',
            [id, userId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Notification not found' });
        }

        await emitUnreadCountUpdate(userId);
        res.json({ message: 'Notification deleted successfully', id: parseInt(id) });
    } catch (error) {
        console.error('Error deleting notification:', error);
        res.status(500).json({ message: 'Error deleting notification', error: error.message });
    }
};

/**
 * Clear all notifications for logged-in user
 */
const clearAllNotifications = async (req, res) => {
    try {
        const userId = req.user.id;
        await db.query('DELETE FROM notifications WHERE user_id = ?', [userId]);

        await emitUnreadCountUpdate(userId);
        res.json({ message: 'All notifications cleared successfully' });
    } catch (error) {
        console.error('Error clearing notifications:', error);
        res.status(500).json({ message: 'Error clearing notifications', error: error.message });
    }
};

/**
 * Get notification preferences for logged-in user
 */
const getPreferences = async (req, res) => {
    try {
        const userId = req.user.id;
        let [rows] = await db.query(
            'SELECT * FROM notification_preferences WHERE user_id = ?',
            [userId]
        );

        if (rows.length === 0) {
            await db.query(
                `INSERT INTO notification_preferences (user_id, laundry_updates, payment_updates, delivery_updates, account_updates)
                 VALUES (?, 1, 1, 1, 1)`,
                [userId]
            );
            [rows] = await db.query('SELECT * FROM notification_preferences WHERE user_id = ?', [userId]);
        }

        const pref = rows[0];
        res.json({
            laundry_updates: Boolean(pref.laundry_updates),
            payment_updates: Boolean(pref.payment_updates),
            delivery_updates: Boolean(pref.delivery_updates),
            account_updates: Boolean(pref.account_updates)
        });
    } catch (error) {
        console.error('Error fetching notification preferences:', error);
        res.status(500).json({ message: 'Error fetching preferences', error: error.message });
    }
};

/**
 * Update notification preferences for logged-in user
 */
const updatePreferences = async (req, res) => {
    try {
        const userId = req.user.id;
        const {
            laundry_updates = true,
            payment_updates = true,
            delivery_updates = true,
            account_updates = true
        } = req.body;

        await db.query(
            `INSERT INTO notification_preferences (user_id, laundry_updates, payment_updates, delivery_updates, account_updates)
             VALUES (?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE 
                laundry_updates = VALUES(laundry_updates),
                payment_updates = VALUES(payment_updates),
                delivery_updates = VALUES(delivery_updates),
                account_updates = VALUES(account_updates),
                updated_at = NOW()`,
            [
                userId,
                laundry_updates ? 1 : 0,
                payment_updates ? 1 : 0,
                delivery_updates ? 1 : 0,
                account_updates ? 1 : 0
            ]
        );

        res.json({
            message: 'Notification preferences updated successfully',
            preferences: {
                laundry_updates: Boolean(laundry_updates),
                payment_updates: Boolean(payment_updates),
                delivery_updates: Boolean(delivery_updates),
                account_updates: Boolean(account_updates)
            }
        });
    } catch (error) {
        console.error('Error updating notification preferences:', error);
        res.status(500).json({ message: 'Error updating preferences', error: error.message });
    }
};

/**
 * Dispatch an event notification through the running server's Socket.IO
 */
const emitNotificationEvent = async (req, res) => {
    try {
        const { userId, title, message, type, notificationType, orderId, relatedOrderId, relatedUserId, targetUrl, broadcast } = req.body;
        const notificationService = require('../services/notificationService');

        let result;
        if (broadcast === 'workers_and_admin') {
            result = await notificationService.notifyWorkersAndAdmin({
                title,
                message,
                type: type || notificationType,
                orderId: orderId || relatedOrderId,
                relatedUserId,
                targetUrl
            });
        } else if (broadcast === 'admins') {
            result = await notificationService.notifyAdmins({
                title,
                message,
                type: type || notificationType,
                orderId: orderId || relatedOrderId,
                relatedUserId,
                targetUrl
            });
        } else {
            result = await notificationService.createNotification({
                userId: userId || req.user.id,
                title,
                message,
                type: type || notificationType,
                orderId: orderId || relatedOrderId,
                relatedUserId,
                targetUrl
            });
        }

        res.json({ success: true, notification: result });
    } catch (e) {
        console.error('Error emitting notification event:', e);
        res.status(500).json({ success: false, error: e.message });
    }
};

module.exports = {
    getNotifications,
    getUnreadNotifications,
    getUnreadCount,
    markAsRead,
    markAsUnread,
    markAllAsRead,
    deleteNotification,
    clearAllNotifications,
    getPreferences,
    updatePreferences,
    emitNotificationEvent
};

