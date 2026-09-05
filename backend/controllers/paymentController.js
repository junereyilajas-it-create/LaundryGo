const db = require('../config/db');

exports.getPayments = async (req, res) => {
    try {
        let query = `
            SELECT p.*, o.order_number, u.name as customer_name
            FROM payments p
            JOIN laundry_orders o ON p.order_id = o.id
            JOIN users u ON o.customer_id = u.id
            ORDER BY p.created_at DESC
        `;
        const [payments] = await db.query(query);
        res.json(payments);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching payments', error: error.message });
    }
};

exports.getPaymentById = async (req, res) => {
    try {
        let query = `
            SELECT p.*, o.order_number, u.name as customer_name
            FROM payments p
            JOIN laundry_orders o ON p.order_id = o.id
            JOIN users u ON o.customer_id = u.id
            WHERE p.id = ?
        `;
        const [payments] = await db.query(query, [req.params.id]);
        if (payments.length === 0) return res.status(404).json({ message: 'Payment not found' });
        res.json(payments[0]);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching payment', error: error.message });
    }
};

exports.createPayment = async (req, res) => {
    try {
        const { order_id, amount, payment_method, payment_status } = req.body;
        if (!order_id || !amount || !payment_method) {
            return res.status(400).json({ message: 'order_id, amount, and payment_method are required' });
        }

        const [result] = await db.query(
            'INSERT INTO payments (order_id, amount, payment_method, payment_status) VALUES (?, ?, ?, ?)',
            [order_id, amount, payment_method, payment_status || 'unpaid']
        );

        res.status(201).json({ message: 'Payment created successfully', id: result.insertId });
    } catch (error) {
        res.status(500).json({ message: 'Error creating payment', error: error.message });
    }
};

exports.updatePayment = async (req, res) => {
    try {
        const { amount, payment_method, payment_status } = req.body;
        let fields = [];
        let params = [];

        if (amount !== undefined) { fields.push('amount = ?'); params.push(amount); }
        if (payment_method) { fields.push('payment_method = ?'); params.push(payment_method); }
        if (payment_status) { fields.push('payment_status = ?'); params.push(payment_status); }

        if (fields.length === 0) return res.status(400).json({ message: 'No fields to update' });

        params.push(req.params.id);
        const query = `UPDATE payments SET ${fields.join(', ')} WHERE id = ?`;

        const [result] = await db.query(query, params);
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Payment not found' });

        // Update laundry_orders payment_status as well if it changed
        if (payment_status) {
            const [p] = await db.query('SELECT order_id FROM payments WHERE id = ?', [req.params.id]);
            if (p.length > 0) {
                await db.query('UPDATE laundry_orders SET payment_status = ? WHERE id = ?', [payment_status, p[0].order_id]);
            }
        }

        res.json({ message: 'Payment updated successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error updating payment', error: error.message });
    }
};

exports.deletePayment = async (req, res) => {
    try {
        const [result] = await db.query('DELETE FROM payments WHERE id = ?', [req.params.id]);
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Payment not found' });
        res.json({ message: 'Payment deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting payment', error: error.message });
    }
};
