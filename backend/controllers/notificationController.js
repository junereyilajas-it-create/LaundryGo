const db = require('../config/db');

const getNotifications = async (req, res) => {
    try {
        const userId = req.user.id;
        const [notifications] = await db.query(
            'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC',
            [userId]
        );
        res.json(notifications);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching notifications', error: error.message });
    }
};

const markAsRead = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        await db.query('UPDATE notifications SET is_read = TRUE WHERE id = ? AND user_id = ?', [id, userId]);
        res.json({ message: 'Notification marked as read' });
    } catch (error) {
        res.status(500).json({ message: 'Error updating notification', error: error.message });
    }
};

const markAllAsRead = async (req, res) => {
    try {
        const userId = req.user.id;
        await db.query('UPDATE notifications SET is_read = TRUE WHERE user_id = ?', [userId]);
        res.json({ message: 'All notifications marked as read' });
    } catch (error) {
        res.status(500).json({ message: 'Error updating notifications', error: error.message });
    }
};

const deleteNotification = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const [result] = await db.query('DELETE FROM notifications WHERE id = ? AND user_id = ?', [id, userId]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Notification not found' });
        }
        res.json({ message: 'Notification deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting notification', error: error.message });
    }
};

const clearAllNotifications = async (req, res) => {
    try {
        const userId = req.user.id;
        await db.query('DELETE FROM notifications WHERE user_id = ?', [userId]);
        res.json({ message: 'All notifications cleared successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error clearing notifications', error: error.message });
    }
};

module.exports = { getNotifications, markAsRead, markAllAsRead, deleteNotification, clearAllNotifications };

