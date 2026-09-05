const db = require('../config/db');

// ---- PICKUPS ----

exports.getAllPickups = async (req, res) => {
    try {
        let query = `
            SELECT p.*, o.order_number, u.name as customer_name, u.phone as customer_phone,
                   a.address, a.latitude, a.longitude
            FROM pickup_requests p
            JOIN laundry_orders o ON p.order_id = o.id
            JOIN users u ON p.customer_id = u.id
            LEFT JOIN addresses a ON p.address_id = a.id
        `;
        let params = [];
        if (req.user.role === 'driver') {
            query += ' WHERE p.driver_id = ?';
            params.push(req.user.id);
        }
        const [pickups] = await db.query(query, params);
        res.json(pickups);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching pickups', error: error.message });
    }
};

exports.updatePickupStatus = async (req, res) => {
    try {
        const { status, driver_id } = req.body;
        let query = 'UPDATE pickup_requests SET status = ?';
        let params = [status];
        
        if (driver_id !== undefined) {
            query += ', driver_id = ?';
            params.push(driver_id);
        }
        
        query += ' WHERE id = ?';
        params.push(req.params.id);

        await db.query(query, params);
        
        // If marked Picked Up, we should probably update laundry status to 'Picked Up' too.
        if (status === 'picked_up') {
            const [p] = await db.query('SELECT order_id FROM pickup_requests WHERE id = ?', [req.params.id]);
            if (p.length > 0) {
                await db.query('UPDATE laundry_orders SET status = ? WHERE id = ?', ['Picked Up', p[0].order_id]);
                await db.query('INSERT INTO laundry_status_history (order_id, status, changed_by, notes) VALUES (?, ?, ?, ?)', 
                    [p[0].order_id, 'Picked Up', req.user.id, 'Driver marked as picked up']
                );
            }
        }
        
        res.json({ message: 'Pickup updated successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error updating pickup', error: error.message });
    }
};

exports.deletePickup = async (req, res) => {
    try {
        await db.query('DELETE FROM pickup_requests WHERE id = ?', [req.params.id]);
        res.json({ message: 'Pickup deleted' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting pickup', error: error.message });
    }
};


// ---- DELIVERIES ----

exports.getAllDeliveries = async (req, res) => {
    try {
        let query = `
            SELECT d.*, o.order_number, u.name as customer_name, u.phone as customer_phone,
                   a.address, a.latitude, a.longitude
            FROM delivery_requests d
            JOIN laundry_orders o ON d.order_id = o.id
            JOIN users u ON d.customer_id = u.id
            LEFT JOIN addresses a ON d.address_id = a.id
        `;
        let params = [];
        if (req.user.role === 'driver') {
            query += ' WHERE d.driver_id = ?';
            params.push(req.user.id);
        }
        const [deliveries] = await db.query(query, params);
        res.json(deliveries);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching deliveries', error: error.message });
    }
};

exports.updateDeliveryStatus = async (req, res) => {
    try {
        const { status, driver_id } = req.body;
        let query = 'UPDATE delivery_requests SET status = ?';
        let params = [status];
        
        if (driver_id !== undefined) {
            query += ', driver_id = ?';
            params.push(driver_id);
        }
        
        query += ' WHERE id = ?';
        params.push(req.params.id);

        await db.query(query, params);
        
        // If out_for_delivery or delivered, update main order too
        if (status === 'out_for_delivery' || status === 'delivered') {
            const mappedStatus = status === 'out_for_delivery' ? 'Out for Delivery' : 'Delivered';
            const [d] = await db.query('SELECT order_id FROM delivery_requests WHERE id = ?', [req.params.id]);
            if (d.length > 0) {
                await db.query('UPDATE laundry_orders SET status = ? WHERE id = ?', [mappedStatus, d[0].order_id]);
                await db.query('INSERT INTO laundry_status_history (order_id, status, changed_by, notes) VALUES (?, ?, ?, ?)', 
                    [d[0].order_id, mappedStatus, req.user.id, `Driver marked as ${mappedStatus}`]
                );
            }
        }
        
        res.json({ message: 'Delivery updated successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error updating delivery', error: error.message });
    }
};

exports.deleteDelivery = async (req, res) => {
    try {
        await db.query('DELETE FROM delivery_requests WHERE id = ?', [req.params.id]);
        res.json({ message: 'Delivery deleted' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting delivery', error: error.message });
    }
};
