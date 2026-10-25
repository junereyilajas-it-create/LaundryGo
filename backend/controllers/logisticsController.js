const db = require('../config/db');
const { logActivity } = require('../utils/activityLogger');

// ---- PICKUPS ----

exports.getAllPickups = async (req, res) => {
    try {
        let query = `
            SELECT p.*, 
                   o.order_number, 
                   o.service_name,
                   o.total_amount,
                   o.payment_status,
                   o.payment_method,
                   u.name as customer_name, 
                   u.phone as customer_phone,
                   COALESCE(p.notes, o.pickup_address_text, a.address) as address_line,
                   COALESCE(p.pickup_latitude, o.pickup_latitude, a.latitude, 8.8105) as latitude, 
                   COALESCE(p.pickup_longitude, o.pickup_longitude, a.longitude, 124.7925) as longitude,
                   du.name as driver_name,
                   du.phone as driver_phone
            FROM pickup_requests p
            JOIN laundry_orders o ON p.order_id = o.id
            JOIN users u ON p.customer_id = u.id
            LEFT JOIN addresses a ON p.address_id = a.id
            LEFT JOIN users du ON p.driver_id = du.id
        `;
        let params = [];
        if (req.user.role === 'driver') {
            // Drivers see only tasks assigned to their authenticated driver account
            query += ' WHERE p.driver_id = ?';
            params.push(req.user.id);
        } else if (req.user.role === 'customer') {
            query += ' WHERE p.customer_id = ?';
            params.push(req.user.id);
        }
        query += ' ORDER BY p.created_at DESC';

        const [pickups] = await db.query(query, params);
        res.json(pickups);
    } catch (error) {
        console.error('Error fetching pickups:', error);
        res.status(500).json({ message: 'Error fetching pickups', error: error.message });
    }
};

exports.updatePickupStatus = async (req, res) => {
    try {
        const { status, driver_id, failure_reason, notes } = req.body;
        const pickupId = req.params.id;
        const userId = req.user.id;

        const [existing] = await db.query(
            `SELECT p.*, o.order_number, o.customer_id, o.status as order_status 
             FROM pickup_requests p 
             JOIN laundry_orders o ON p.order_id = o.id 
             WHERE p.id = ?`, 
            [pickupId]
        );
        if (existing.length === 0) return res.status(404).json({ message: 'Pickup task not found' });

        const task = existing[0];

        // Guard: Prevent duplicate pickup confirmation
        if (status === 'picked_up' && task.status === 'picked_up') {
            return res.status(200).json({ message: 'Pickup already confirmed', status: 'picked_up' });
        }

        let fields = ['status = ?'];
        let params = [status];

        if (driver_id !== undefined) {
            fields.push('driver_id = ?');
            params.push(driver_id);
        }
        if (failure_reason !== undefined) {
            fields.push('failure_reason = ?');
            params.push(failure_reason);
        }
        if (notes !== undefined) {
            fields.push('notes = ?');
            params.push(notes);
        }
        if (status === 'picked_up') {
            fields.push('actual_time = NOW()');
        }

        params.push(pickupId);
        await db.query(`UPDATE pickup_requests SET ${fields.join(', ')} WHERE id = ?`, params);

        // Update overall laundry_order status and create notifications
        let notifTitle = 'Pickup Update';
        let notifMsg = `Your pickup request for ${task.order_number} status is now ${status}.`;

        if (status === 'accepted') {
            await db.query('UPDATE pickup_requests SET driver_id = ? WHERE id = ?', [userId, pickupId]);
            await db.query('UPDATE laundry_orders SET status = "Driver Assigned", assigned_pickup_driver_id = ? WHERE id = ?', [userId, task.order_id]);
            notifTitle = 'Driver Assigned';
            notifMsg = `A driver has accepted your pickup request for order ${task.order_number}.`;
        } else if (status === 'on_the_way') {
            await db.query('UPDATE laundry_orders SET status = "Pickup in Progress" WHERE id = ?', [task.order_id]);
            await db.query(
                'INSERT INTO laundry_status_history (order_id, status, changed_by, notes) VALUES (?, "Pickup in Progress", ?, "Driver is en route to pickup address")',
                [task.order_id, userId]
            );
            notifTitle = 'Driver On The Way';
            notifMsg = `Your driver is on the way to pick up your laundry for order ${task.order_number}. You can track their location in real-time.`;
        } else if (status === 'arrived') {
            await db.query('UPDATE laundry_orders SET status = "Pickup in Progress" WHERE id = ?', [task.order_id]);
            notifTitle = 'Driver Arrived';
            notifMsg = `Your driver has arrived at the pickup location for order ${task.order_number}.`;
        } else if (status === 'picked_up') {
            await db.query('UPDATE laundry_orders SET status = "Picked Up", pickup_confirmed_by = ?, pickup_confirmed_at = NOW() WHERE id = ?', [userId, task.order_id]);
            await db.query(
                'INSERT INTO laundry_status_history (order_id, status, changed_by, notes) VALUES (?, "Picked Up", ?, "Driver confirmed laundry collection. En route to laundry facility.")', 
                [task.order_id, userId]
            );
            notifTitle = 'Laundry Picked Up';
            notifMsg = 'Your laundry has been picked up successfully. It will be weighed and checked by our laundry staff before processing begins.';

            // Also notify worker queue to weigh
            const [staff] = await db.query('SELECT id FROM users WHERE role IN ("worker", "admin")');
            for (const worker of staff) {
                await db.query(
                    'INSERT INTO notifications (user_id, order_id, title, message) VALUES (?, ?, "Laundry Picked Up - Weighing Required", ?)',
                    [worker.id, task.order_id, `Driver completed pickup for order ${task.order_number}. Arriving at shop for weighing and confirmation.`]
                );
            }
        } else if (status === 'failed') {
            notifTitle = 'Pickup Attempt Failed';
            notifMsg = `Pickup for order ${task.order_number} could not be completed: ${failure_reason || 'Driver reported issue'}.`;
        }

        await db.query(
            'INSERT INTO notifications (user_id, order_id, title, message) VALUES (?, ?, ?, ?)',
            [task.customer_id, task.order_id, notifTitle, notifMsg]
        );

        await logActivity({
            req,
            actorId: userId,
            actorName: req.user.name,
            actorRole: req.user.role,
            actionType: `pickup_${status}`,
            description: `Pickup status for order ${task.order_number} updated to '${status}'`,
            entityType: 'pickup',
            entityId: pickupId,
            outcome: status === 'failed' ? 'failure' : 'success',
            metadata: { order_number: task.order_number, status, failure_reason }
        });

        res.json({ message: 'Pickup status updated successfully', status });
    } catch (error) {
        console.error('Error updating pickup:', error);
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
            SELECT d.*, 
                   o.order_number, 
                   o.service_name,
                   o.total_amount,
                   o.payment_status,
                   o.payment_method,
                   u.name as customer_name, 
                   u.phone as customer_phone,
                   COALESCE(d.notes, o.delivery_address_text, a.address) as address_line,
                   COALESCE(d.delivery_latitude, o.delivery_latitude, o.pickup_latitude, a.latitude, 8.8105) as latitude, 
                   COALESCE(d.delivery_longitude, o.delivery_longitude, o.pickup_longitude, a.longitude, 124.7925) as longitude,
                   du.name as driver_name,
                   du.phone as driver_phone
            FROM delivery_requests d
            JOIN laundry_orders o ON d.order_id = o.id
            JOIN users u ON d.customer_id = u.id
            LEFT JOIN addresses a ON d.address_id = a.id
            LEFT JOIN users du ON d.driver_id = du.id
        `;
        let params = [];
        if (req.user.role === 'driver') {
            // Drivers see only tasks assigned to their authenticated driver account
            query += ' WHERE d.driver_id = ?';
            params.push(req.user.id);
        } else if (req.user.role === 'customer') {
            query += ' WHERE d.customer_id = ?';
            params.push(req.user.id);
        }
        query += ' ORDER BY d.created_at DESC';

        const [deliveries] = await db.query(query, params);
        res.json(deliveries);
    } catch (error) {
        console.error('Error fetching deliveries:', error);
        res.status(500).json({ message: 'Error fetching deliveries', error: error.message });
    }
};

exports.updateDeliveryStatus = async (req, res) => {
    try {
        const { status, driver_id, failure_reason, proof_notes, notes } = req.body;
        const deliveryId = req.params.id;
        const userId = req.user.id;

        const [existing] = await db.query(
            `SELECT d.*, o.order_number, o.customer_id 
             FROM delivery_requests d 
             JOIN laundry_orders o ON d.order_id = o.id 
             WHERE d.id = ?`, 
            [deliveryId]
        );
        if (existing.length === 0) return res.status(404).json({ message: 'Delivery task not found' });

        const task = existing[0];

        // Guard: Prevent duplicate delivery confirmation
        if (status === 'delivered' && task.status === 'delivered') {
            return res.status(200).json({ message: 'Delivery already confirmed', status: 'delivered' });
        }

        let fields = ['status = ?'];
        let params = [status];

        if (driver_id !== undefined) {
            fields.push('driver_id = ?');
            params.push(driver_id);
        }
        if (failure_reason !== undefined) {
            fields.push('failure_reason = ?');
            params.push(failure_reason);
        }
        if (proof_notes !== undefined) {
            fields.push('proof_notes = ?');
            params.push(proof_notes);
        }
        if (notes !== undefined) {
            fields.push('notes = ?');
            params.push(notes);
        }
        if (status === 'delivered') {
            fields.push('actual_time = NOW()');
        }

        params.push(deliveryId);
        await db.query(`UPDATE delivery_requests SET ${fields.join(', ')} WHERE id = ?`, params);

        let notifTitle = 'Delivery Update';
        let notifMsg = `Your delivery for order ${task.order_number} status is now ${status}.`;

        if (status === 'assigned') {
            notifTitle = 'Delivery Driver Assigned';
            notifMsg = `A driver has been assigned to deliver your clean laundry for order ${task.order_number}.`;
        } else if (status === 'on_the_way' || status === 'out_for_delivery') {
            await db.query('UPDATE laundry_orders SET status = "Out for Delivery" WHERE id = ?', [task.order_id]);
            await db.query(
                'INSERT INTO laundry_status_history (order_id, status, changed_by, notes) VALUES (?, "Out for Delivery", ?, "Driver is on the way for delivery")',
                [task.order_id, userId]
            );
            notifTitle = 'Driver On The Way';
            notifMsg = `Your driver is on the way to deliver your fresh laundry for order ${task.order_number}. You can track their arrival live.`;
        } else if (status === 'arrived') {
            notifTitle = 'Driver Arrived';
            notifMsg = `Your driver has arrived at the delivery destination for order ${task.order_number}.`;
        } else if (status === 'delivered') {
            await db.query('UPDATE laundry_orders SET status = "Delivered", delivery_confirmed_by = ?, delivery_confirmed_at = NOW() WHERE id = ?', [userId, task.order_id]);
            await db.query(
                'INSERT INTO laundry_status_history (order_id, status, changed_by, notes) VALUES (?, "Delivered", ?, ?)',
                [task.order_id, userId, proof_notes || 'Driver confirmed successful delivery']
            );
            notifTitle = 'Laundry Delivered!';
            notifMsg = `Your laundry order ${task.order_number} has been delivered successfully. Thank you for choosing LaundriGo!`;

            // Also notify worker staff that delivery is complete
            const [staff] = await db.query('SELECT id FROM users WHERE role IN ("worker", "admin")');
            for (const worker of staff) {
                await db.query(
                    'INSERT INTO notifications (user_id, order_id, title, message) VALUES (?, ?, "Delivery Completed", ?)',
                    [worker.id, task.order_id, `Order ${task.order_number} was successfully delivered by driver.`]
                );
            }
        } else if (status === 'failed') {
            notifTitle = 'Delivery Attempt Failed';
            notifMsg = `Delivery for order ${task.order_number} could not be completed: ${failure_reason || 'Driver reported issue'}.`;
        }

        await db.query(
            'INSERT INTO notifications (user_id, order_id, title, message) VALUES (?, ?, ?, ?)',
            [task.customer_id, task.order_id, notifTitle, notifMsg]
        );

        await logActivity({
            req,
            actorId: userId,
            actorName: req.user.name,
            actorRole: req.user.role,
            actionType: `delivery_${status}`,
            description: `Delivery status for order ${task.order_number} updated to '${status}'`,
            entityType: 'delivery',
            entityId: deliveryId,
            outcome: status === 'failed' ? 'failure' : 'success',
            metadata: { order_number: task.order_number, status, failure_reason }
        });

        res.json({ message: 'Delivery status updated successfully', status });
    } catch (error) {
        console.error('Error updating delivery:', error);
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
