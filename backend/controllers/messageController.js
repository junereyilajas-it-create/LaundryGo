const db = require('../config/db');
const { createNotification } = require('../services/notificationService');

// Get all messages for a specific order
exports.getOrderMessages = async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const userId = req.user.id;
        const userRole = req.user.role;

        // Verify order exists and user has access
        const [orders] = await db.query(
            `SELECT o.id, o.order_number, o.customer_id, 
                    p.driver_id as pickup_driver_id, 
                    d.driver_id as delivery_driver_id
             FROM laundry_orders o
             LEFT JOIN pickup_requests p ON o.id = p.order_id
             LEFT JOIN delivery_requests d ON o.id = d.order_id
             WHERE o.id = ?`,
            [orderId]
        );

        if (orders.length === 0) {
            return res.status(404).json({ message: 'Order not found' });
        }

        const order = orders[0];

        // Permissions check:
        // Customer can only view their own order messages
        // Driver can view if they are assigned to pickup or delivery
        // Admin and Worker can view all
        if (userRole === 'customer' && order.customer_id !== userId) {
            return res.status(403).json({ message: 'Access denied' });
        }
        if (userRole === 'driver' && order.pickup_driver_id !== userId && order.delivery_driver_id !== userId) {
            return res.status(403).json({ message: 'Access denied to this order conversation' });
        }

        const [messages] = await db.query(
            `SELECT m.id, m.order_id, m.sender_id, m.message, m.is_read, m.created_at,
                    u.name as sender_name, u.role as sender_role
             FROM order_messages m
             JOIN users u ON m.sender_id = u.id
             WHERE m.order_id = ?
             ORDER BY m.created_at ASC`,
            [orderId]
        );

        // Mark unread messages sent by others as read
        await db.query(
            'UPDATE order_messages SET is_read = 1 WHERE order_id = ? AND sender_id != ?',
            [orderId, userId]
        );

        res.json(messages);
    } catch (error) {
        console.error('Error fetching order messages:', error);
        res.status(500).json({ message: 'Error fetching messages', error: error.message });
    }
};

// Send a message in an order conversation
exports.sendOrderMessage = async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const senderId = req.user.id;
        const senderRole = req.user.role;
        const { message } = req.body;

        if (!message || message.trim() === '') {
            return res.status(400).json({ message: 'Message content cannot be empty' });
        }

        // Fetch order details
        const [orders] = await db.query(
            `SELECT o.id, o.order_number, o.customer_id, 
                    p.driver_id as pickup_driver_id, 
                    d.driver_id as delivery_driver_id
             FROM laundry_orders o
             LEFT JOIN pickup_requests p ON o.id = p.order_id
             LEFT JOIN delivery_requests d ON o.id = d.order_id
             WHERE o.id = ?`,
            [orderId]
        );

        if (orders.length === 0) {
            return res.status(404).json({ message: 'Order not found' });
        }

        const order = orders[0];

        // Permissions check
        if (senderRole === 'customer' && order.customer_id !== senderId) {
            return res.status(403).json({ message: 'Access denied' });
        }
        if (senderRole === 'driver' && order.pickup_driver_id !== senderId && order.delivery_driver_id !== senderId) {
            return res.status(403).json({ message: 'Access denied to this order conversation' });
        }

        // Insert message
        const [result] = await db.query(
            'INSERT INTO order_messages (order_id, sender_id, message) VALUES (?, ?, ?)',
            [orderId, senderId, message.trim()]
        );

        // Notify recipient(s)
        const recipientIds = new Set();
        if (senderId !== order.customer_id) {
            recipientIds.add(order.customer_id);
        }
        if (order.pickup_driver_id && senderId !== order.pickup_driver_id) {
            recipientIds.add(order.pickup_driver_id);
        }
        if (order.delivery_driver_id && senderId !== order.delivery_driver_id) {
            recipientIds.add(order.delivery_driver_id);
        }

        for (const recipientId of recipientIds) {
            await createNotification({
                userId: recipientId,
                orderId: parseInt(orderId),
                title: `New message on #${order.order_number}`,
                message: `${req.user.name || 'User'}: ${message.trim().substring(0, 60)}`,
                type: 'order',
                relatedUserId: senderId,
                targetUrl: null // will be resolved per recipient's role
            });
        }

        res.status(201).json({
            message: 'Message sent successfully',
            id: result.insertId,
            order_id: parseInt(orderId),
            sender_id: senderId,
            sender_name: req.user.name,
            sender_role: senderRole,
            created_at: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error sending order message:', error);
        res.status(500).json({ message: 'Error sending message', error: error.message });
    }
};
