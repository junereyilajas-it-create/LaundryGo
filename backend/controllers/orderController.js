const db = require('../config/db');

// Create a new laundry order (Customer)
const createOrder = async (req, res) => {
    try {
        const { service_type, estimated_weight, preferred_date, preferred_time, special_instructions, address_id } = req.body;
        const customer_id = req.user.id;
        
        // Generate a unique order number LAU-YYYY-XXXXX
        const year = new Date().getFullYear();
        const [lastOrder] = await db.query('SELECT id FROM laundry_orders ORDER BY id DESC LIMIT 1');
        const nextId = (lastOrder.length > 0 ? lastOrder[0].id : 0) + 1;
        const order_number = `LAU-${year}-${String(nextId).padStart(5, '0')}`;

        // The exact service_type must be 'customer_dropoff' or 'shop_pickup'
        const sType = service_type === 'PICKUP' ? 'shop_pickup' : 'customer_dropoff';

        const [result] = await db.query(
            `INSERT INTO laundry_orders 
            (order_number, customer_id, service_type, estimated_weight, preferred_date, preferred_time, special_instructions) 
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [order_number, customer_id, sType, estimated_weight, preferred_date, preferred_time, special_instructions]
        );
        
        const orderId = result.insertId;

        // If Pickup, create a pending pickup request
        if (sType === 'shop_pickup') {
            await db.query(
                'INSERT INTO pickup_requests (order_id, customer_id, status, pickup_date, pickup_time, address_id) VALUES (?, ?, ?, ?, ?, ?)',
                [orderId, customer_id, 'pending', preferred_date, preferred_time, address_id || null]
            );
        }

        // Add history
        await db.query(
            'INSERT INTO laundry_status_history (order_id, status, notes, changed_by) VALUES (?, ?, ?, ?)',
            [orderId, 'Pending Request', 'Order placed by customer', customer_id]
        );

        // Add notification
        await db.query(
            'INSERT INTO notifications (user_id, order_id, title, message) VALUES (?, ?, ?, ?)',
            [customer_id, orderId, 'Request Submitted', `Your laundry ${sType === 'shop_pickup' ? 'pickup' : 'drop-off'} request ${order_number} has been submitted.`]
        );

        res.status(201).json({ message: 'Order created successfully', orderId, order_number });
    } catch (error) {
        res.status(500).json({ message: 'Error creating order', error: error.message });
    }
};

// Get all orders (Worker/Admin) or Customer's orders
const getOrders = async (req, res) => {
    try {
        let query = `
            SELECT lo.*, u.name as customer_name, u.phone as customer_phone
            FROM laundry_orders lo
            JOIN users u ON lo.customer_id = u.id
        `;
        let params = [];

        if (req.user.role === 'customer') {
            query += ' WHERE lo.customer_id = ?';
            params.push(req.user.id);
        }
        
        query += ' ORDER BY lo.created_at DESC';

        const [orders] = await db.query(query, params);
        res.json(orders);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching orders', error: error.message });
    }
};

// Get single order details
const getOrderById = async (req, res) => {
    try {
        const orderId = req.params.id;
        
        const [orders] = await db.query(`
            SELECT lo.*, u.name as customer_name, u.phone as customer_phone
            FROM laundry_orders lo
            JOIN users u ON lo.customer_id = u.id
            WHERE lo.id = ?
        `, [orderId]);
        
        if (orders.length === 0) return res.status(404).json({ message: 'Order not found' });
        
        const order = orders[0];

        // Check auth
        if (req.user.role === 'customer' && order.customer_id !== req.user.id) {
            return res.status(403).json({ message: 'Access denied' });
        }

        // Fetch histories
        const [histories] = await db.query('SELECT * FROM laundry_status_history WHERE order_id = ? ORDER BY created_at DESC', [orderId]);
        
        res.json({ ...order, history: histories });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching order details', error: error.message });
    }
};

// Update order status (Worker)
const updateOrderStatus = async (req, res) => {
    try {
        const orderId = req.params.id;
        const { status, notes } = req.body;
        const userId = req.user.id;

        await db.query('UPDATE laundry_orders SET status = ? WHERE id = ?', [status, orderId]);
        
        await db.query(
            'INSERT INTO laundry_status_history (order_id, status, notes, changed_by) VALUES (?, ?, ?, ?)',
            [orderId, status, notes, userId]
        );

        // Fetch customer id and order number for notification
        const [orders] = await db.query('SELECT customer_id, order_number FROM laundry_orders WHERE id = ?', [orderId]);
        const { customer_id, order_number } = orders[0];

        let title = 'Order Update';
        let message = `Your laundry order ${order_number} status is now ${status}.`;

        // If Ready, notify customer
        if (status === 'Ready') {
            title = 'Laundry Ready';
            message = `Your laundry order ${order_number} is finished and ready for pickup or delivery.`;
        } else if (status === 'Completed') {
            title = 'Order Completed';
            message = `Your laundry order ${order_number} has been completed. Thank you for using LaundriGo!`;
        } 

        await db.query(
            'INSERT INTO notifications (user_id, order_id, title, message) VALUES (?, ?, ?, ?)',
            [customer_id, orderId, title, message]
        );

        res.json({ message: 'Status updated successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error updating status', error: error.message });
    }
};

// Request Delivery (Customer)
const requestDelivery = async (req, res) => {
     try {
        const orderId = req.params.id;
        const customer_id = req.user.id;
        const { delivery_date, delivery_time, address_id } = req.body;

        const [orders] = await db.query('SELECT status, customer_id, order_number FROM laundry_orders WHERE id = ?', [orderId]);
        if (orders.length === 0) return res.status(404).json({ message: 'Order not found' });
        
        if (orders[0].customer_id !== customer_id) return res.status(403).json({ message: 'Access denied' });
        if (orders[0].status !== 'Ready') return res.status(400).json({ message: 'Laundry is not Ready yet' });

        // Create delivery request
        await db.query(
            'INSERT INTO delivery_requests (order_id, customer_id, status, delivery_date, delivery_time, address_id) VALUES (?, ?, ?, ?, ?, ?)',
            [orderId, customer_id, 'pending', delivery_date, delivery_time, address_id || null]
        );

        await db.query(
            'INSERT INTO laundry_status_history (order_id, status, notes, changed_by) VALUES (?, ?, ?, ?)',
            [orderId, 'Ready', 'Customer requested delivery', customer_id]
        );

        res.json({ message: 'Delivery requested successfully' });
     } catch (error) {
        res.status(500).json({ message: 'Error requesting delivery', error: error.message });
     }
};

// Full Update Order (Admin CRUD)
const updateOrder = async (req, res) => {
    try {
        const { service_type, estimated_weight, preferred_date, preferred_time, special_instructions, status, payment_status } = req.body;
        let fields = [];
        let params = [];

        if (service_type) { fields.push('service_type = ?'); params.push(service_type); }
        if (estimated_weight !== undefined) { fields.push('estimated_weight = ?'); params.push(estimated_weight); }
        if (preferred_date) { fields.push('preferred_date = ?'); params.push(preferred_date); }
        if (preferred_time) { fields.push('preferred_time = ?'); params.push(preferred_time); }
        if (special_instructions !== undefined) { fields.push('special_instructions = ?'); params.push(special_instructions); }
        if (status) { fields.push('status = ?'); params.push(status); }
        if (payment_status) { fields.push('payment_status = ?'); params.push(payment_status); }

        if (fields.length === 0) return res.status(400).json({ message: 'No fields to update' });
        
        params.push(req.params.id);
        const query = `UPDATE laundry_orders SET ${fields.join(', ')} WHERE id = ?`;
        
        const [result] = await db.query(query, params);
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Order not found' });
        
        res.json({ message: 'Order updated successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error updating order', error: error.message });
    }
};

// Delete Order (Admin CRUD)
const deleteOrder = async (req, res) => {
    try {
        const [result] = await db.query('DELETE FROM laundry_orders WHERE id = ?', [req.params.id]);
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Order not found' });
        res.json({ message: 'Order deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting order', error: error.message });
    }
};

module.exports = { createOrder, getOrders, getOrderById, updateOrderStatus, requestDelivery, updateOrder, deleteOrder };
