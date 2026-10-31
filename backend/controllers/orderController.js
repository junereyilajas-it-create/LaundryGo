const db = require('../config/db');
const { calculateLaundryPricing } = require('../utils/pricingCalculator');
const { logActivity } = require('../utils/activityLogger');
const { createNotification, notifyWorkersAndAdmin } = require('../services/notificationService');

// 1. Create a new laundry order (Customer) - supports COD and standard request
const createOrder = async (req, res) => {
    try {
        const { 
            service_name,
            estimated_weight, 
            preferred_date, 
            preferred_time, 
            special_instructions, 
            address_id,
            pickup_address_text,
            delivery_address_text,
            pickup_latitude,
            pickup_longitude,
            delivery_latitude,
            delivery_longitude,
            payment_method
        } = req.body;
        
        const customer_id = req.user.id;
        const sType = 'shop_pickup';
        const sName = service_name || 'Wash & Fold';

        // Validate estimated weight strictly
        const numericWeight = parseFloat(estimated_weight);
        if (isNaN(numericWeight) || numericWeight <= 0) {
            return res.status(400).json({ message: 'A valid estimated weight greater than zero is required.' });
        }
        if (numericWeight > 100) {
            return res.status(400).json({ message: 'Estimated laundry weight cannot exceed 100 kg in a single request.' });
        }

        // Authoritative backend package pricing calculation
        const pricing = calculateLaundryPricing(numericWeight);
        const calcAmount = pricing.totalAmount;
        const loadCount = pricing.loadCount;
        const loadDetails = JSON.stringify(pricing.loads);

        // Parse and validate numeric geographic coordinates
        let pLat = pickup_latitude !== undefined && pickup_latitude !== null && pickup_latitude !== '' ? parseFloat(pickup_latitude) : 8.8105;
        let pLng = pickup_longitude !== undefined && pickup_longitude !== null && pickup_longitude !== '' ? parseFloat(pickup_longitude) : 124.7925;
        if (isNaN(pLat) || pLat < -90 || pLat > 90) pLat = 8.8105;
        if (isNaN(pLng) || pLng < -180 || pLng > 180) pLng = 124.7925;

        let dLat = delivery_latitude !== undefined && delivery_latitude !== null && delivery_latitude !== '' ? parseFloat(delivery_latitude) : pLat;
        let dLng = delivery_longitude !== undefined && delivery_longitude !== null && delivery_longitude !== '' ? parseFloat(delivery_longitude) : pLng;
        if (isNaN(dLat) || dLat < -90 || dLat > 90) dLat = pLat;
        if (isNaN(dLng) || dLng < -180 || dLng > 180) dLng = pLng;

        const pAddress = pickup_address_text ? pickup_address_text.trim() : 'Poblacion, Lagonglong, Misamis Oriental, 9006 Philippines';
        const dAddress = delivery_address_text ? delivery_address_text.trim() : pAddress;

        // Normalized payment method and status
        let pMethod = 'COD';
        let pStatus = 'Pending';

        if (payment_method) {
            const pmUpper = payment_method.toUpperCase();
            if (pmUpper === 'GCASH_DEMO' || pmUpper === 'GCASH') {
                pMethod = 'GCASH_DEMO';
                pStatus = 'Paid (Demo)';
            } else {
                pMethod = 'COD';
                pStatus = 'Pending';
            }
        }

        // Idempotency: prevent accidental duplicate submission within 10 seconds for same customer/details
        const [recentOrders] = await db.query(
            `SELECT id, order_number, total_amount, estimated_amount, load_count, status, payment_method, payment_status 
             FROM laundry_orders 
             WHERE customer_id = ? 
               AND service_name = ? 
               AND total_amount = ? 
               AND created_at >= (NOW() - INTERVAL 10 SECOND)
             ORDER BY id DESC LIMIT 1`,
            [customer_id, sName, calcAmount]
        );

        if (recentOrders.length > 0) {
            return res.status(200).json({
                message: 'Laundry request confirmed (duplicate submission prevented).',
                orderId: recentOrders[0].id,
                order_number: recentOrders[0].order_number,
                total_amount: recentOrders[0].total_amount,
                estimated_amount: recentOrders[0].estimated_amount || recentOrders[0].total_amount,
                load_count: recentOrders[0].load_count || loadCount,
                load_details: pricing.loads,
                payment_method: recentOrders[0].payment_method,
                payment_status: recentOrders[0].payment_status,
                status: recentOrders[0].status
            });
        }
        
        // Generate a unique order number LAU-YYYY-XXXXX
        const year = new Date().getFullYear();
        const [lastOrder] = await db.query('SELECT id FROM laundry_orders ORDER BY id DESC LIMIT 1');
        const nextId = (lastOrder.length > 0 ? lastOrder[0].id : 0) + 1;
        const order_number = `LAU-${year}-${String(nextId).padStart(5, '0')}`;

        // Initial order status per workflow requirement: "Pending Approval"
        const initialStatus = 'Pending Approval';

        const [result] = await db.query(
            `INSERT INTO laundry_orders 
            (order_number, customer_id, service_type, service_name, estimated_weight, total_amount, estimated_amount, load_count, load_details, pricing_version, preferred_date, preferred_time, special_instructions, pickup_address_text, delivery_address_text, pickup_latitude, pickup_longitude, delivery_latitude, delivery_longitude, payment_method, status, payment_status) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                order_number, 
                customer_id, 
                sType, 
                sName, 
                pricing.measuredWeight, 
                calcAmount,
                calcAmount,
                loadCount,
                loadDetails,
                pricing.pricingVersion,
                preferred_date || new Date().toISOString().split('T')[0], 
                preferred_time || 'Afternoon', 
                special_instructions || '',
                pAddress,
                dAddress,
                pLat,
                pLng,
                dLat,
                dLng,
                pMethod,
                initialStatus,
                pStatus
            ]
        );
        
        const orderId = result.insertId;

        // Create a pending pickup request with confirmed coordinates
        await db.query(
            'INSERT INTO pickup_requests (order_id, customer_id, status, pickup_date, pickup_time, address_id, notes, pickup_latitude, pickup_longitude) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [orderId, customer_id, 'pending', preferred_date, preferred_time, address_id || null, pAddress, pLat, pLng]
        );

        // Add history entry
        await db.query(
            'INSERT INTO laundry_status_history (order_id, status, notes, changed_by) VALUES (?, ?, ?, ?)',
            [orderId, initialStatus, `Order placed by customer (${loadCount} load(s), estimated ₱${calcAmount.toFixed(2)}) with Doorstep Pickup (${pMethod} - ${pStatus})`, customer_id]
        );

        // Centralized Activity Logging
        await logActivity({
            req,
            actorId: customer_id,
            actorName: req.user.name,
            actorRole: 'customer',
            actionType: 'order_created',
            description: `New laundry request submitted – Customer: ${req.user.name} (Order #${order_number})`,
            entityType: 'order',
            entityId: orderId,
            outcome: 'success',
            metadata: {
                order_number,
                service_name: sName,
                weight: pricing.measuredWeight,
                load_count: loadCount,
                loads: pricing.loads,
                total_amount: calcAmount,
                payment_method: pMethod
            }
        });

        // Add initial notification for customer
        await createNotification({
            userId: customer_id,
            orderId,
            title: 'Laundry Request Submitted',
            message: `Your laundry order ${order_number} has been submitted successfully and is Pending Approval.`,
            type: 'order',
            targetUrl: `/customer/orders?orderId=${orderId}`
        });

        // Notify all workers/admins about the new order
        await notifyWorkersAndAdmin({
            orderId,
            title: 'New Order Received',
            message: `New order ${order_number} (${pMethod}, ${loadCount} load(s), ₱${calcAmount.toFixed(2)}) submitted by customer. Awaiting approval.`,
            type: 'order',
            relatedUserId: customer_id,
            targetUrl: `/worker/orders?orderId=${orderId}`
        });

        res.status(201).json({ 
            message: 'Order created successfully', 
            orderId, 
            order_number,
            total_amount: calcAmount,
            estimated_amount: calcAmount,
            load_count: loadCount,
            load_details: pricing.loads,
            payment_method: pMethod,
            payment_status: pStatus,
            status: initialStatus
        });
    } catch (error) {
        console.error('Error creating order:', error);
        res.status(500).json({ message: 'Error creating order', error: error.message });
    }
};

// 2. Get all orders (Worker/Admin sees all, Customer sees their own, Driver sees assigned)
const getOrders = async (req, res) => {
    try {
        let query = `
            SELECT lo.*, 
                   COALESCE(lo.pickup_address_text, '') as pickup_address,
                   COALESCE(lo.delivery_address_text, '') as delivery_address,
                   u.name as customer_name, 
                   u.phone as customer_phone,
                   u.email as customer_email,
                   p.id as pickup_id,
                   p.status as pickup_status,
                   p.driver_id as pickup_driver_id,
                   pu.name as pickup_driver_name,
                   pu.phone as pickup_driver_phone,
                   d.id as delivery_id,
                   d.status as delivery_status,
                   d.driver_id as delivery_driver_id,
                   du.name as delivery_driver_name,
                   du.phone as delivery_driver_phone,
                   (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE order_id = lo.id AND (payment_status = 'paid' OR payment_status = 'Paid (Demo)')) as total_paid,
                   pay_u.name as payment_collected_by_name
            FROM laundry_orders lo
            JOIN users u ON lo.customer_id = u.id
            LEFT JOIN pickup_requests p ON lo.id = p.order_id
            LEFT JOIN users pu ON COALESCE(lo.assigned_pickup_driver_id, p.driver_id) = pu.id
            LEFT JOIN delivery_requests d ON lo.id = d.order_id
            LEFT JOIN users du ON COALESCE(lo.assigned_delivery_driver_id, d.driver_id) = du.id
            LEFT JOIN users pay_u ON lo.payment_collected_by = pay_u.id
        `;
        let params = [];

        if (req.user.role === 'customer') {
            query += ' WHERE lo.customer_id = ?';
            params.push(req.user.id);
        } else if (req.user.role === 'driver') {
            query += ' WHERE p.driver_id = ? OR d.driver_id = ? OR lo.assigned_pickup_driver_id = ? OR lo.assigned_delivery_driver_id = ?';
            params.push(req.user.id, req.user.id, req.user.id, req.user.id);
        }
        
        query += ' ORDER BY lo.created_at DESC';

        const [orders] = await db.query(query, params);
        res.json(orders);
    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).json({ message: 'Error fetching orders', error: error.message });
    }
};

// 3. Get single order details with full history, logistics & payments
const getOrderById = async (req, res) => {
    try {
        const orderId = req.params.id;
        
        const [orders] = await db.query(`
            SELECT lo.*, 
                   COALESCE(lo.pickup_address_text, '') as pickup_address,
                   COALESCE(lo.delivery_address_text, '') as delivery_address,
                   u.name as customer_name, 
                   u.phone as customer_phone,
                   u.email as customer_email,
                   p.id as pickup_id,
                   p.status as pickup_status,
                   p.driver_id as pickup_driver_id,
                   pu.name as pickup_driver_name,
                   pu.phone as pickup_driver_phone,
                   pu.latitude as pickup_driver_lat,
                   pu.longitude as pickup_driver_lng,
                   d.id as delivery_id,
                   d.status as delivery_status,
                   d.driver_id as delivery_driver_id,
                   du.name as delivery_driver_name,
                   du.phone as delivery_driver_phone,
                   du.latitude as delivery_driver_lat,
                   du.longitude as delivery_driver_lng,
                   app_u.name as approver_name,
                   pcu.name as pickup_confirmer_name,
                   dcu.name as delivery_confirmer_name,
                   wcu.name as weight_recorder_name,
                   pay_u.name as payment_collected_by_name
            FROM laundry_orders lo
            JOIN users u ON lo.customer_id = u.id
            LEFT JOIN pickup_requests p ON lo.id = p.order_id
            LEFT JOIN users pu ON COALESCE(lo.assigned_pickup_driver_id, p.driver_id) = pu.id
            LEFT JOIN delivery_requests d ON lo.id = d.order_id
            LEFT JOIN users du ON COALESCE(lo.assigned_delivery_driver_id, d.driver_id) = du.id
            LEFT JOIN users app_u ON lo.approved_by = app_u.id
            LEFT JOIN users pcu ON lo.pickup_confirmed_by = pcu.id
            LEFT JOIN users dcu ON lo.delivery_confirmed_by = dcu.id
            LEFT JOIN users wcu ON lo.weight_recorded_by = wcu.id
            LEFT JOIN users pay_u ON lo.payment_collected_by = pay_u.id
            WHERE lo.id = ?
        `, [orderId]);
        
        if (orders.length === 0) return res.status(404).json({ message: 'Order not found' });
        
        const order = orders[0];

        // Check customer authorization
        if (req.user.role === 'customer' && order.customer_id !== req.user.id) {
            return res.status(403).json({ message: 'Access denied' });
        }

        // Fetch audit history
        const [histories] = await db.query(
            `SELECT h.*, u.name as changed_by_name, u.role as changed_by_role
             FROM laundry_status_history h
             LEFT JOIN users u ON h.changed_by = u.id
             WHERE h.order_id = ?
             ORDER BY h.created_at DESC`,
            [orderId]
        );

        // Fetch payments
        const [payments] = await db.query(
            'SELECT * FROM payments WHERE order_id = ? ORDER BY created_at DESC',
            [orderId]
        );

        // Parse load_details if string
        if (order.load_details && typeof order.load_details === 'string') {
            try {
                order.load_details = JSON.parse(order.load_details);
            } catch (e) {}
        }
        
        res.json({ ...order, history: histories, payments });
    } catch (error) {
        console.error('Error fetching order details:', error);
        res.status(500).json({ message: 'Error fetching order details', error: error.message });
    }
};

// 4. Worker: Approve Request
const approveOrder = async (req, res) => {
    try {
        const orderId = req.params.id;
        const workerId = req.user.id;

        const [orders] = await db.query('SELECT * FROM laundry_orders WHERE id = ?', [orderId]);
        if (orders.length === 0) return res.status(404).json({ message: 'Order not found' });
        const order = orders[0];

        if (order.status !== 'Pending Approval' && order.status !== 'Pending Request') {
            return res.status(400).json({ message: `Cannot approve order currently in '${order.status}' status.` });
        }

        // Transition to Approved (Awaiting Pickup Assignment for Doorstep Pickup)
        const nextStatus = 'Awaiting Pickup Assignment';

        await db.query('UPDATE laundry_orders SET status = ?, approved_by = ?, approved_at = NOW() WHERE id = ?', [nextStatus, workerId, orderId]);

        // Audit status history
        await db.query(
            'INSERT INTO laundry_status_history (order_id, status, notes, changed_by) VALUES (?, ?, ?, ?)',
            [orderId, nextStatus, 'Request approved by laundry staff. Queued for pickup/dropoff.', workerId]
        );

        // Notify customer
        await createNotification({
            userId: order.customer_id,
            orderId,
            title: 'Order Approved',
            message: `Your laundry request ${order.order_number} has been approved and is being arranged for pickup.`,
            type: 'order',
            relatedUserId: workerId,
            targetUrl: `/customer/orders?orderId=${orderId}`
        });

        await logActivity({
            req,
            actorId: workerId,
            actorName: req.user.name,
            actorRole: req.user.role,
            actionType: 'order_approved',
            description: `Laundry requests approved – Order #${order.order_number}`,
            entityType: 'order',
            entityId: orderId,
            outcome: 'success'
        });

        res.json({ message: 'Order approved successfully', status: nextStatus });
    } catch (error) {
        console.error('Error approving order:', error);
        res.status(500).json({ message: 'Error approving order', error: error.message });
    }
};

// 5. Worker: Reject Request
const rejectOrder = async (req, res) => {
    try {
        const orderId = req.params.id;
        const { rejection_reason } = req.body;
        const workerId = req.user.id;

        if (!rejection_reason) {
            return res.status(400).json({ message: 'A rejection reason is required.' });
        }

        const [orders] = await db.query('SELECT * FROM laundry_orders WHERE id = ?', [orderId]);
        if (orders.length === 0) return res.status(404).json({ message: 'Order not found' });
        const order = orders[0];

        await db.query(
            'UPDATE laundry_orders SET status = "Cancelled", rejection_reason = ? WHERE id = ?',
            [rejection_reason, orderId]
        );

        await db.query('UPDATE pickup_requests SET status = "cancelled" WHERE order_id = ?', [orderId]);

        // Audit status history
        await db.query(
            'INSERT INTO laundry_status_history (order_id, status, notes, changed_by) VALUES (?, "Cancelled", ?, ?)',
            [orderId, `Request rejected: ${rejection_reason}`, workerId]
        );

        // Notify customer
        await createNotification({
            userId: order.customer_id,
            orderId,
            title: 'Order Request Declined',
            message: `Your laundry request ${order.order_number} could not be accepted: ${rejection_reason}`,
            type: 'order',
            relatedUserId: workerId,
            targetUrl: `/customer/orders?orderId=${orderId}`
        });

        await logActivity({
            req,
            actorId: workerId,
            actorName: req.user.name,
            actorRole: req.user.role,
            actionType: 'order_rejected',
            description: `Rejected laundry order ${order.order_number}. Reason: ${rejection_reason}`,
            entityType: 'order',
            entityId: orderId,
            outcome: 'failure',
            metadata: { reason: rejection_reason }
        });

        res.json({ message: 'Order rejected', status: 'Cancelled' });
    } catch (error) {
        console.error('Error rejecting order:', error);
        res.status(500).json({ message: 'Error rejecting order', error: error.message });
    }
};

// 6. Worker: Assign Driver (Pickup or Delivery)
const assignDriver = async (req, res) => {
    try {
        const orderId = req.params.id;
        const { driver_id, task_type } = req.body; // task_type: 'pickup' | 'delivery'
        const workerId = req.user.id;

        if (!driver_id) {
            return res.status(400).json({ message: 'Please select a driver to assign.' });
        }

        // Verify driver exists and is active & approved
        const [drivers] = await db.query(
            'SELECT id, name, phone, is_active, approval_status FROM users WHERE id = ? AND role = "driver"',
            [driver_id]
        );
        if (drivers.length === 0) {
            return res.status(404).json({ message: 'Driver not found.' });
        }
        if (!drivers[0].is_active || drivers[0].approval_status !== 'approved') {
            return res.status(400).json({ message: 'Selected driver account is not approved or is inactive and cannot receive new assignments.' });
        }

        const driver = drivers[0];

        const [orders] = await db.query('SELECT * FROM laundry_orders WHERE id = ?', [orderId]);
        if (orders.length === 0) return res.status(404).json({ message: 'Order not found' });
        const order = orders[0];

        const isDelivery = (task_type === 'delivery' || order.status === 'Ready for Delivery');

        if (isDelivery) {
            // Assign delivery driver
            await db.query('UPDATE laundry_orders SET assigned_delivery_driver_id = ?, status = "Delivery Assigned" WHERE id = ?', [driver_id, orderId]);

            const [existDelivery] = await db.query('SELECT id FROM delivery_requests WHERE order_id = ?', [orderId]);
            if (existDelivery.length > 0) {
                await db.query('UPDATE delivery_requests SET driver_id = ?, status = "assigned" WHERE order_id = ?', [driver_id, orderId]);
            } else {
                await db.query(
                    'INSERT INTO delivery_requests (order_id, customer_id, driver_id, status, delivery_date, delivery_time, notes) VALUES (?, ?, ?, "assigned", CURDATE(), "Afternoon", ?)',
                    [orderId, order.customer_id, driver_id, order.delivery_address_text || '']
                );
            }

            await db.query(
                'INSERT INTO laundry_status_history (order_id, status, notes, changed_by) VALUES (?, "Delivery Assigned", ?, ?)',
                [orderId, `Delivery assigned to driver ${driver.name}`, workerId]
            );

            // Notify driver
            await createNotification({
                userId: driver_id,
                orderId,
                title: 'Delivery Task Assigned',
                message: `You have been assigned delivery task for order ${order.order_number}. Destination: ${order.delivery_address_text || 'Poblacion, Lagonglong'}.`,
                type: 'delivery',
                relatedUserId: workerId,
                targetUrl: `/driver?orderId=${orderId}`
            });

            // Notify customer
            await createNotification({
                userId: order.customer_id,
                orderId,
                title: 'Delivery Driver Assigned',
                message: `Driver ${driver.name} has been assigned to deliver your clean laundry.`,
                type: 'delivery',
                relatedUserId: driver_id,
                targetUrl: `/customer/orders?orderId=${orderId}`
            });

            await logActivity({
                req,
                actorId: workerId,
                actorName: req.user.name,
                actorRole: req.user.role,
                actionType: 'driver_assigned',
                description: `Driver assigned – Order #${order.order_number}`,
                entityType: 'order',
                entityId: orderId,
                outcome: 'success',
                metadata: { driver_id, driver_name: driver.name, task_type: 'delivery' }
            });

            return res.json({ message: `Delivery driver ${driver.name} assigned successfully.`, status: 'Delivery Assigned' });
        } else {
            // Assign pickup driver
            await db.query('UPDATE laundry_orders SET assigned_pickup_driver_id = ?, status = "Driver Assigned" WHERE id = ?', [driver_id, orderId]);

            const [existPickup] = await db.query('SELECT id FROM pickup_requests WHERE order_id = ?', [orderId]);
            if (existPickup.length > 0) {
                await db.query('UPDATE pickup_requests SET driver_id = ?, status = "assigned" WHERE order_id = ?', [driver_id, orderId]);
            } else {
                await db.query(
                    'INSERT INTO pickup_requests (order_id, customer_id, driver_id, status, pickup_date, pickup_time, notes) VALUES (?, ?, ?, "assigned", CURDATE(), "Afternoon", ?)',
                    [orderId, order.customer_id, driver_id, order.pickup_address_text || '']
                );
            }

            await db.query(
                'INSERT INTO laundry_status_history (order_id, status, notes, changed_by) VALUES (?, "Driver Assigned", ?, ?)',
                [orderId, `Pickup assigned to driver ${driver.name}`, workerId]
            );

            // Notify driver
            await createNotification({
                userId: driver_id,
                orderId,
                title: 'New Pickup Task Assigned',
                message: `You have been assigned pickup task for order ${order.order_number}. Address: ${order.pickup_address_text || 'Poblacion, Lagonglong'}.`,
                type: 'delivery',
                relatedUserId: workerId,
                targetUrl: `/driver?orderId=${orderId}`
            });

            // Notify customer
            await createNotification({
                userId: order.customer_id,
                orderId,
                title: 'Pickup Driver Assigned',
                message: `Your laundry request has been approved, and driver ${driver.name} has been assigned for pickup. Please wait for the driver to update their status.`,
                type: 'delivery',
                relatedUserId: driver_id,
                targetUrl: `/customer/orders?orderId=${orderId}`
            });

            await logActivity({
                req,
                actorId: workerId,
                actorName: req.user.name,
                actorRole: req.user.role,
                actionType: 'driver_assigned',
                description: `Driver assigned – Order #${order.order_number}`,
                entityType: 'order',
                entityId: orderId,
                outcome: 'success',
                metadata: { driver_id, driver_name: driver.name, task_type: 'pickup' }
            });

            return res.json({ message: `Pickup driver ${driver.name} assigned successfully.`, status: 'Driver Assigned' });
        }
    } catch (error) {
        console.error('Error assigning driver:', error);
        res.status(500).json({ message: 'Error assigning driver', error: error.message });
    }
};

// 7. Worker: Explicitly Confirm Physical Receipt of Laundry
const confirmLaundryReceipt = async (req, res) => {
    try {
        const orderId = req.params.id;
        const workerId = req.user.id;

        const [orders] = await db.query('SELECT * FROM laundry_orders WHERE id = ?', [orderId]);
        if (orders.length === 0) return res.status(404).json({ message: 'Order not found' });
        const order = orders[0];

        const nextStatus = 'Laundry Received';
        await db.query('UPDATE laundry_orders SET status = ? WHERE id = ?', [nextStatus, orderId]);

        await db.query(
            'INSERT INTO laundry_status_history (order_id, status, notes, changed_by) VALUES (?, ?, "Physical receipt of laundry verified at laundry hub. Awaiting weighing.", ?)',
            [orderId, nextStatus, workerId]
        );

        await createNotification({
            userId: order.customer_id,
            orderId,
            title: 'Laundry Received at Facility',
            message: `Your laundry for order ${order.order_number} has been received at our facility and is being calibrated on our scale.`,
            type: 'order',
            relatedUserId: workerId,
            targetUrl: `/customer/orders?orderId=${orderId}`
        });

        await logActivity({
            req,
            actorId: workerId,
            actorName: req.user.name,
            actorRole: req.user.role,
            actionType: 'laundry_received',
            description: `Physical receipt of laundry confirmed at facility for order ${order.order_number}`,
            entityType: 'order',
            entityId: orderId,
            outcome: 'success'
        });

        res.json({ message: 'Laundry receipt confirmed successfully', status: nextStatus });
    } catch (error) {
        console.error('Error confirming receipt:', error);
        res.status(500).json({ message: 'Error confirming laundry receipt', error: error.message });
    }
};

// 8. Worker: Record Laundry Weight & Calculate Automated Multi-load Pricing
const recordLaundryWeight = async (req, res) => {
    try {
        const orderId = req.params.id;
        const { actual_weight } = req.body;
        const workerId = req.user.id;

        if (actual_weight === undefined || actual_weight === null || actual_weight === '') {
            return res.status(400).json({ message: 'Actual measured weight is required.' });
        }

        const numericWeight = parseFloat(actual_weight);
        if (isNaN(numericWeight) || numericWeight <= 0) {
            return res.status(400).json({ message: 'Weight must be a positive numeric value greater than zero.' });
        }

        const [orders] = await db.query('SELECT * FROM laundry_orders WHERE id = ?', [orderId]);
        if (orders.length === 0) return res.status(404).json({ message: 'Order not found' });
        const order = orders[0];

        // Run pricing rule calculation
        const pricing = calculateLaundryPricing(numericWeight);

        let nextStatus;
        let notifTitle;
        let notifMessage;

        if (pricing.isOverweight) {
            // Overweight > 8 kg requires customer approval before processing
            nextStatus = 'Awaiting Customer Confirmation';
            notifTitle = 'Weight Confirmation Required';
            notifMessage = `Your laundry has been weighed. Actual weight: ${pricing.measuredWeight} kg. Final laundry cost: ₱${pricing.totalAmount.toFixed(2)}. Please review your updated order details.`;
        } else {
            // Standard weight (<= 8kg) - immediately commence processing
            nextStatus = 'Processing';
            notifTitle = 'Laundry Weighed & Processing Started';
            notifMessage = `Your laundry has been weighed. Actual weight: ${pricing.measuredWeight} kg. Final laundry cost: ₱${pricing.totalAmount.toFixed(2)}. Please review your updated order details.`;
        }

        await db.query(
            `UPDATE laundry_orders 
             SET actual_weight = ?, 
                 load_count = ?, 
                 load_details = ?, 
                 total_amount = ?, 
                 final_amount = ?,
                 pricing_version = ?, 
                 weight_recorded_by = ?, 
                 weight_recorded_at = NOW(),
                 status = ?,
                 processing_stage = ?
             WHERE id = ?`,
            [
                pricing.measuredWeight,
                pricing.loadCount,
                JSON.stringify(pricing.loads),
                pricing.totalAmount,
                pricing.totalAmount,
                pricing.pricingVersion,
                workerId,
                nextStatus,
                pricing.isOverweight ? null : 'Washing',
                orderId
            ]
        );

        // Audit status history
        await db.query(
            'INSERT INTO laundry_status_history (order_id, status, notes, changed_by) VALUES (?, ?, ?, ?)',
            [
                orderId, 
                nextStatus, 
                `Recorded weight: ${pricing.measuredWeight} kg across ${pricing.loadCount} load(s). Total: ₱${pricing.totalAmount.toFixed(2)}. ${pricing.isOverweight ? 'Awaiting customer confirmation.' : 'Standard load.'}`, 
                workerId
            ]
        );

        // Customer notification
        await createNotification({
            userId: order.customer_id,
            orderId,
            title: notifTitle,
            message: notifMessage,
            type: 'order',
            relatedUserId: workerId,
            targetUrl: `/customer/orders?orderId=${orderId}`
        });

        await logActivity({
            req,
            actorId: workerId,
            actorName: req.user.name,
            actorRole: req.user.role,
            actionType: 'weight_recorded',
            description: `Recorded actual weight: ${pricing.measuredWeight} kg across ${pricing.loadCount} load(s) (₱${pricing.totalAmount.toFixed(2)}) for order ${order.order_number}`,
            entityType: 'order',
            entityId: orderId,
            outcome: 'success',
            metadata: { actual_weight: pricing.measuredWeight, load_count: pricing.loadCount, total_amount: pricing.totalAmount }
        });

        res.json({
            message: 'Laundry weight recorded successfully',
            pricing,
            status: nextStatus
        });
    } catch (error) {
        console.error('Error recording weight:', error);
        res.status(500).json({ message: 'Error recording weight', error: error.message });
    }
};

// Worker: Send Price & Weight to Customer explicitly
const sendPriceToCustomer = async (req, res) => {
    try {
        const orderId = req.params.id;
        const workerId = req.user.id;

        const [orders] = await db.query('SELECT * FROM laundry_orders WHERE id = ?', [orderId]);
        if (orders.length === 0) return res.status(404).json({ message: 'Order not found' });
        const order = orders[0];

        if (!order.actual_weight || parseFloat(order.actual_weight) <= 0) {
            return res.status(400).json({ message: 'Actual laundry weight must be recorded before sending price to customer.' });
        }

        const pricing = calculateLaundryPricing(order.actual_weight);
        const finalPrice = pricing.totalAmount;
        const nextStatus = pricing.isOverweight ? 'Awaiting Customer Confirmation' : 'Processing';
        const notifTitle = pricing.isOverweight ? 'Weight & Price Confirmation Required' : 'Laundry Weighed & Pricing Confirmed';
        const notifMessage = `Your laundry has been weighed. Actual weight: ${pricing.measuredWeight} kg. Final laundry cost: ₱${finalPrice.toFixed(2)}. Please review your updated order details.`;

        await db.query(
            `UPDATE laundry_orders 
             SET total_amount = ?, 
                 final_amount = ?,
                 status = ?,
                 processing_stage = COALESCE(processing_stage, ?)
             WHERE id = ?`,
            [finalPrice, finalPrice, nextStatus, pricing.isOverweight ? null : 'Washing', orderId]
        );

        await db.query(
            'INSERT INTO laundry_status_history (order_id, status, notes, changed_by) VALUES (?, ?, ?, ?)',
            [orderId, nextStatus, `Sent final pricing to customer: ₱${finalPrice.toFixed(2)} for ${pricing.measuredWeight} kg across ${pricing.loadCount} load(s).`, workerId]
        );

        await createNotification({
            userId: order.customer_id,
            orderId,
            title: notifTitle,
            message: notifMessage,
            type: 'order',
            relatedUserId: workerId,
            targetUrl: `/customer/orders?orderId=${orderId}`
        });

        await logActivity({
            req,
            actorId: workerId,
            actorName: req.user.name,
            actorRole: req.user.role,
            actionType: 'price_sent',
            description: `Sent final price ₱${finalPrice.toFixed(2)} to customer for order ${order.order_number} (${pricing.measuredWeight} kg, ${pricing.loadCount} load(s))`,
            entityType: 'order',
            entityId: orderId,
            outcome: 'success',
            metadata: { finalPrice, measuredWeight: pricing.measuredWeight, loadCount: pricing.loadCount }
        });

        res.json({
            message: 'Pricing notification sent to customer successfully.',
            pricing,
            status: nextStatus
        });
    } catch (error) {
        console.error('Error sending price to customer:', error);
        res.status(500).json({ message: 'Error sending price to customer', error: error.message });
    }
};

// 9. Customer: Approve or Reject Overweight Proposal
const customerWeightDecision = async (req, res) => {
    try {
        const orderId = req.params.id;
        const { decision, rejection_reason } = req.body; // 'approve' | 'reject'
        const customerId = req.user.id;

        const [orders] = await db.query(
            'SELECT * FROM laundry_orders WHERE id = ? AND customer_id = ?',
            [orderId, customerId]
        );

        if (orders.length === 0) return res.status(404).json({ message: 'Order not found or unauthorized' });
        const order = orders[0];

        if (order.status !== 'Awaiting Customer Approval' && order.status !== 'Awaiting Customer Confirmation') {
            return res.status(400).json({ message: `Order is not awaiting weight confirmation (Current status: ${order.status})` });
        }

        if (decision === 'approve') {
            // Customer approved the load allocation and total price
            const nextStatus = 'Processing';
            await db.query(
                `UPDATE laundry_orders 
                 SET weight_approved_by_customer = 1, 
                     weight_approved_at = NOW(), 
                     status = ?,
                     processing_stage = 'Washing'
                 WHERE id = ?`,
                [nextStatus, orderId]
            );

            await db.query(
                'INSERT INTO laundry_status_history (order_id, status, notes, changed_by) VALUES (?, ?, ?, ?)',
                [orderId, nextStatus, `Customer explicitly approved overweight load allocation and total price of ₱${parseFloat(order.total_amount).toFixed(2)}.`, customerId]
            );

            // Notify staff
            await notifyWorkersAndAdmin({
                orderId,
                title: 'Weight Proposal Approved',
                message: `Customer approved weight allocation for order ${order.order_number}. Processing has commenced.`,
                type: 'order',
                relatedUserId: customerId,
                targetUrl: `/worker/orders?orderId=${orderId}`
            });

            await logActivity({
                req,
                actorId: customerId,
                actorName: req.user.name,
                actorRole: 'customer',
                actionType: 'customer_price_confirmed',
                description: `Customer confirmed and approved weight & pricing of ₱${parseFloat(order.total_amount).toFixed(2)} for order ${order.order_number}`,
                entityType: 'order',
                entityId: orderId,
                outcome: 'success'
            });

            return res.json({
                message: 'You have approved the load allocation and pricing. Our laundry team will now begin processing your clothes!',
                status: nextStatus
            });
        } else if (decision === 'reject') {
            // Customer rejected proposal: stops processing
            const nextStatus = 'Customer Rejected Weight Proposal';
            const reason = rejection_reason || 'Customer declined additional charges for multiple loads';

            await db.query(
                `UPDATE laundry_orders 
                 SET weight_approved_by_customer = 0, 
                     rejection_reason = ?, 
                     status = ?
                 WHERE id = ?`,
                [reason, nextStatus, orderId]
            );

            await db.query(
                'INSERT INTO laundry_status_history (order_id, status, notes, changed_by) VALUES (?, ?, ?, ?)',
                [orderId, nextStatus, `Customer rejected overweight proposal: ${reason}`, customerId]
            );

            // Notify staff to contact customer or arrange return
            await notifyWorkersAndAdmin({
                orderId,
                title: 'Customer Rejected Weight Proposal',
                message: `Customer rejected weight proposal for order ${order.order_number}. Staff resolution or return required.`,
                type: 'order',
                relatedUserId: customerId,
                targetUrl: `/worker/orders?orderId=${orderId}`
            });

            await logActivity({
                req,
                actorId: customerId,
                actorName: req.user.name,
                actorRole: 'customer',
                actionType: 'customer_price_rejected',
                description: `Customer rejected weight proposal for order ${order.order_number}. Reason: ${reason}`,
                entityType: 'order',
                entityId: orderId,
                outcome: 'failure',
                metadata: { reason }
            });

            return res.json({
                message: 'You have declined the proposed weight allocation. Laundry processing has been stopped and our staff will contact you.',
                status: nextStatus
            });
        } else {
            return res.status(400).json({ message: "Invalid decision. Must be 'approve' or 'reject'." });
        }
    } catch (error) {
        console.error('Error handling customer weight decision:', error);
        res.status(500).json({ message: 'Error processing decision', error: error.message });
    }
};

// 10. Worker: Advance Normal Processing Stage (Washing -> Drying -> Folding -> Quality Check -> Ready for Delivery)
const updateProcessingStage = async (req, res) => {
    try {
        const orderId = req.params.id;
        const { stage, notes } = req.body; // 'Washing' | 'Drying' | 'Folding' | 'Quality Check' | 'Ready for Delivery'
        const workerId = req.user.id;

        const VALID_STAGES = ['Washing', 'Drying', 'Folding', 'Quality Check', 'Ready for Delivery'];
        if (!stage || !VALID_STAGES.includes(stage)) {
            return res.status(400).json({ message: `Invalid processing stage. Allowed stages: ${VALID_STAGES.join(', ')}` });
        }

        const [orders] = await db.query('SELECT * FROM laundry_orders WHERE id = ?', [orderId]);
        if (orders.length === 0) return res.status(404).json({ message: 'Order not found' });
        const order = orders[0];

        // Guard: Prevent proceeding if overweight without customer approval!
        if (order.actual_weight > 8 && order.weight_approved_by_customer !== 1) {
            return res.status(400).json({ 
                message: 'Cannot process overweight laundry (>8kg) without explicit customer approval.' 
            });
        }

        let nextOrderStatus = 'Processing';
        let notifTitle = `Laundry Stage: ${stage}`;
        let notifMsg = `Your laundry order ${order.order_number} is now in the ${stage} stage.`;

        if (stage === 'Ready for Delivery') {
            nextOrderStatus = 'Ready for Delivery';
            notifTitle = 'Laundry Ready for Delivery!';
            notifMsg = `Your laundry for order ${order.order_number} is clean, neatly folded, and ready for delivery. A driver will be assigned shortly.`;
        }

        await db.query(
            'UPDATE laundry_orders SET processing_stage = ?, status = ? WHERE id = ?',
            [stage, nextOrderStatus, orderId]
        );

        await db.query(
            'INSERT INTO laundry_status_history (order_id, status, notes, changed_by) VALUES (?, ?, ?, ?)',
            [orderId, nextOrderStatus, notes || `Processing stage advanced to ${stage}`, workerId]
        );

        await createNotification({
            userId: order.customer_id,
            orderId,
            title: notifTitle,
            message: notifMsg,
            type: 'order',
            relatedUserId: workerId,
            targetUrl: `/customer/orders?orderId=${orderId}`
        });

        await logActivity({
            req,
            actorId: workerId,
            actorName: req.user.name,
            actorRole: req.user.role,
            actionType: stage === 'Ready for Delivery' ? 'ready_for_delivery' : 'stage_advanced',
            description: `Order ${order.order_number} advanced to '${stage}'`,
            entityType: 'order',
            entityId: orderId,
            outcome: 'success',
            metadata: { stage }
        });

        res.json({
            message: `Processing stage updated to ${stage}`,
            processing_stage: stage,
            status: nextOrderStatus
        });
    } catch (error) {
        console.error('Error updating processing stage:', error);
        res.status(500).json({ message: 'Error updating processing stage', error: error.message });
    }
};

// 11. Worker Dashboard: Get Workflow Counts for filter tabs
const getWorkflowCounts = async (req, res) => {
    try {
        const [orders] = await db.query('SELECT status FROM laundry_orders');
        
        const counts = {
            'all': orders.length,
            'Pending Approval': 0,
            'Approved': 0,
            'Awaiting Pickup Assignment': 0,
            'Driver Assigned': 0,
            'Pickup in Progress': 0,
            'Laundry Received': 0,
            'Awaiting Customer Approval': 0,
            'Processing': 0,
            'Ready for Delivery': 0,
            'Delivery in Progress': 0,
            'Completed': 0,
            'Cancelled': 0
        };

        orders.forEach(o => {
            const st = o.status;
            if (st === 'Pending Approval' || st === 'Pending Request') counts['Pending Approval']++;
            else if (st === 'Approved') counts['Approved']++;
            else if (st === 'Awaiting Pickup Assignment') counts['Awaiting Pickup Assignment']++;
            else if (st === 'Driver Assigned' || st === 'Pickup Scheduled') counts['Driver Assigned']++;
            else if (st === 'Pickup in Progress') counts['Pickup in Progress']++;
            else if (st === 'Laundry Received' || st === 'Picked Up') counts['Laundry Received']++;
            else if (st === 'Awaiting Customer Approval') counts['Awaiting Customer Approval']++;
            else if (st === 'Processing' || st === 'Washing' || st === 'Drying' || st === 'Folding' || st === 'Quality Check') counts['Processing']++;
            else if (st === 'Ready for Delivery' || st === 'Ready') counts['Ready for Delivery']++;
            else if (st === 'Delivery Assigned' || st === 'Out for Delivery') counts['Delivery in Progress']++;
            else if (st === 'Delivered' || st === 'Completed') counts['Completed']++;
            else if (st === 'Cancelled' || st === 'Customer Rejected Weight Proposal') counts['Cancelled']++;
        });

        res.json(counts);
    } catch (error) {
        console.error('Error fetching workflow counts:', error);
        res.status(500).json({ message: 'Error fetching workflow counts', error: error.message });
    }
};

// 12. Helper: Get available active drivers for assignment modal
const getAvailableDrivers = async (req, res) => {
    try {
        const [drivers] = await db.query(`
            SELECT u.id, u.name, u.phone, u.email, u.is_active,
                   (SELECT COUNT(*) FROM pickup_requests p WHERE p.driver_id = u.id AND p.status IN ('assigned', 'on_the_way')) as active_pickups,
                   (SELECT COUNT(*) FROM delivery_requests d WHERE d.driver_id = u.id AND d.status IN ('assigned', 'out_for_delivery')) as active_deliveries
            FROM users u
            WHERE u.role = 'driver' AND u.is_active = 1 AND u.approval_status = 'approved'
            ORDER BY (active_pickups + active_deliveries) ASC, u.name ASC
        `);
        res.json(drivers);
    } catch (error) {
        console.error('Error fetching drivers:', error);
        res.status(500).json({ message: 'Error fetching available drivers', error: error.message });
    }
};

// Update order status (General fallback)
const updateOrderStatus = async (req, res) => {
    try {
        const orderId = req.params.id;
        const { status, notes, total_amount, estimated_weight } = req.body;
        const userId = req.user.id;

        const [orders] = await db.query('SELECT status, customer_id, order_number FROM laundry_orders WHERE id = ?', [orderId]);
        if (orders.length === 0) return res.status(404).json({ message: 'Order not found' });

        const currentOrder = orders[0];

        let updateSql = 'UPDATE laundry_orders SET status = ?';
        let updateParams = [status];

        if (total_amount !== undefined) {
            updateSql += ', total_amount = ?';
            updateParams.push(parseFloat(total_amount) || 0);
        }
        if (estimated_weight !== undefined) {
            updateSql += ', estimated_weight = ?';
            updateParams.push(parseFloat(estimated_weight) || 0);
        }

        updateSql += ' WHERE id = ?';
        updateParams.push(orderId);

        await db.query(updateSql, updateParams);
        
        await db.query(
            'INSERT INTO laundry_status_history (order_id, status, notes, changed_by) VALUES (?, ?, ?, ?)',
            [orderId, status, notes || `Status updated to ${status}`, userId]
        );

        await createNotification({
            userId: currentOrder.customer_id,
            orderId,
            title: 'Order Status Updated',
            message: `Your order ${currentOrder.order_number} status is now ${status}.`,
            type: 'order',
            relatedUserId: userId,
            targetUrl: `/customer/orders?orderId=${orderId}`
        });

        await logActivity({
            req,
            actorId: userId,
            actorName: req.user.name,
            actorRole: req.user.role,
            actionType: 'order_status_updated',
            description: `Order ${currentOrder.order_number} status updated to '${status}'`,
            entityType: 'order',
            entityId: orderId,
            outcome: 'success',
            metadata: { status }
        });

        res.json({ message: 'Status updated successfully', status });
    } catch (error) {
        console.error('Error updating status:', error);
        res.status(500).json({ message: 'Error updating status', error: error.message });
    }
};

// Customer or Staff cancel order
const cancelOrder = async (req, res) => {
    try {
        const orderId = req.params.id;
        const userId = req.user.id;
        const isStaff = req.user.role === 'worker' || req.user.role === 'admin';

        let query = 'SELECT status, customer_id, order_number, assigned_pickup_driver_id, assigned_delivery_driver_id FROM laundry_orders WHERE id = ?';
        let params = [orderId];
        if (!isStaff) {
            query += ' AND customer_id = ?';
            params.push(userId);
        }

        const [orders] = await db.query(query, params);
        if (orders.length === 0) return res.status(404).json({ message: 'Order not found' });
        const targetOrder = orders[0];

        if (!isStaff && targetOrder.status !== 'Pending Approval' && targetOrder.status !== 'Pending Request') {
            return res.status(400).json({ 
                message: 'This order is already being processed or assigned and cannot be cancelled automatically.' 
            });
        }

        await db.query('UPDATE laundry_orders SET status = "Cancelled" WHERE id = ?', [orderId]);
        await db.query('UPDATE pickup_requests SET status = "cancelled" WHERE order_id = ?', [orderId]);
        await db.query('UPDATE delivery_requests SET status = "cancelled" WHERE order_id = ?', [orderId]);

        await db.query(
            'INSERT INTO laundry_status_history (order_id, status, notes, changed_by) VALUES (?, "Cancelled", ?, ?)',
            [orderId, isStaff ? `Cancelled by staff (${req.user.name || req.user.role})` : 'Cancelled by customer', userId]
        );

        // Notify customer or staff
        if (isStaff) {
            await createNotification({
                userId: targetOrder.customer_id,
                orderId,
                title: 'Order Cancelled',
                message: `Your laundry order ${targetOrder.order_number} was cancelled by laundry staff.`,
                type: 'order',
                relatedUserId: userId,
                targetUrl: `/customer/orders?orderId=${orderId}`
            });
        } else {
            await notifyWorkersAndAdmin({
                orderId,
                title: 'Order Cancelled by Customer',
                message: `Customer cancelled order ${targetOrder.order_number}.`,
                type: 'order',
                relatedUserId: userId,
                targetUrl: `/worker/orders?orderId=${orderId}`
            });

            // If a driver was assigned, notify them of cancellation
            const assignedDriver = targetOrder.assigned_pickup_driver_id || targetOrder.assigned_delivery_driver_id;
            if (assignedDriver) {
                await createNotification({
                    userId: assignedDriver,
                    orderId,
                    title: 'Assigned Task Cancelled',
                    message: `Order ${targetOrder.order_number} has been cancelled by the customer.`,
                    type: 'delivery',
                    relatedUserId: userId,
                    targetUrl: '/driver'
                });
            }
        }

        await logActivity({
            req,
            actorId: userId,
            actorName: req.user.name,
            actorRole: req.user.role,
            actionType: 'order_cancelled',
            description: `Order ${targetOrder.order_number} was cancelled by ${isStaff ? 'staff' : 'customer'}`,
            entityType: 'order',
            entityId: orderId,
            outcome: 'failure'
        });

        res.json({ message: 'Order has been successfully cancelled' });
    } catch (error) {
        console.error('Error cancelling order:', error);
        res.status(500).json({ message: 'Error cancelling order', error: error.message });
    }
};

// Customer Request Delivery
const requestDelivery = async (req, res) => {
    try {
        const orderId = req.params.id;
        const customer_id = req.user.id;
        const { delivery_date, delivery_time, address_id, delivery_address_text } = req.body;

        const [orders] = await db.query('SELECT status, customer_id, order_number FROM laundry_orders WHERE id = ?', [orderId]);
        if (orders.length === 0) return res.status(404).json({ message: 'Order not found' });
        
        if (orders[0].customer_id !== customer_id) return res.status(403).json({ message: 'Access denied' });
        if (orders[0].status !== 'Ready for Delivery' && orders[0].status !== 'Ready') {
            return res.status(400).json({ message: 'Laundry must be Ready before scheduling delivery' });
        }

        const [existing] = await db.query('SELECT id FROM delivery_requests WHERE order_id = ?', [orderId]);
        if (existing.length > 0) {
            await db.query(
                'UPDATE delivery_requests SET status = "pending", delivery_date = ?, delivery_time = ?, address_id = ?, notes = ? WHERE order_id = ?',
                [delivery_date || new Date().toISOString().split('T')[0], delivery_time || 'Afternoon', address_id || null, delivery_address_text || '', orderId]
            );
        } else {
            await db.query(
                'INSERT INTO delivery_requests (order_id, customer_id, status, delivery_date, delivery_time, address_id, notes) VALUES (?, ?, "pending", ?, ?, ?, ?)',
                [orderId, customer_id, delivery_date || new Date().toISOString().split('T')[0], delivery_time || 'Afternoon', address_id || null, delivery_address_text || '']
            );
        }

        if (delivery_address_text) {
            await db.query('UPDATE laundry_orders SET delivery_address_text = ? WHERE id = ?', [delivery_address_text, orderId]);
        }

        res.json({ message: 'Delivery requested successfully. Our team will assign a driver shortly.' });
    } catch (error) {
        console.error('Error requesting delivery:', error);
        res.status(500).json({ message: 'Error requesting delivery', error: error.message });
    }
};

const updateOrder = async (req, res) => {
    try {
        const { service_type, service_name, estimated_weight, total_amount, preferred_date, preferred_time, special_instructions, status, payment_status, pickup_address_text, delivery_address_text } = req.body;
        let fields = [];
        let params = [];

        if (service_type) { fields.push('service_type = ?'); params.push(service_type); }
        if (service_name) { fields.push('service_name = ?'); params.push(service_name); }
        if (estimated_weight !== undefined) { fields.push('estimated_weight = ?'); params.push(estimated_weight); }
        if (total_amount !== undefined) { fields.push('total_amount = ?'); params.push(total_amount); }
        if (preferred_date) { fields.push('preferred_date = ?'); params.push(preferred_date); }
        if (preferred_time) { fields.push('preferred_time = ?'); params.push(preferred_time); }
        if (special_instructions !== undefined) { fields.push('special_instructions = ?'); params.push(special_instructions); }
        if (pickup_address_text !== undefined) { fields.push('pickup_address_text = ?'); params.push(pickup_address_text); }
        if (delivery_address_text !== undefined) { fields.push('delivery_address_text = ?'); params.push(delivery_address_text); }
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

const deleteOrder = async (req, res) => {
    try {
        const [result] = await db.query('DELETE FROM laundry_orders WHERE id = ?', [req.params.id]);
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Order not found' });
        res.json({ message: 'Order deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting order', error: error.message });
    }
};

// 13. WORKER: Add Walk-in / Drop-off Laundry Transaction
const createWalkInOrder = async (req, res) => {
    try {
        const {
            customer_id,
            customer_name,
            customer_phone,
            customer_email,
            weight,
            service_name,
            payment_status,
            payment_method,
            special_instructions
        } = req.body;
        const workerId = req.user.id;
        const workerName = req.user.name;

        // Weight validation strictly positive
        const numericWeight = parseFloat(weight);
        if (isNaN(numericWeight) || numericWeight <= 0) {
            return res.status(400).json({ message: 'Invalid laundry weight. Weight must be a positive number greater than zero.' });
        }
        if (numericWeight > 100) {
            return res.status(400).json({ message: 'Laundry weight cannot exceed 100 kg in a single transaction.' });
        }

        let targetCustomerId = customer_id ? parseInt(customer_id) : null;
        let finalCustomerName = customer_name ? customer_name.trim() : '';
        let finalCustomerPhone = customer_phone ? customer_phone.trim() : null;

        // If new customer registration
        if (!targetCustomerId) {
            if (!finalCustomerName) {
                return res.status(400).json({ message: "Customer's name is required when registering a new customer." });
            }

            // Check if customer with this email or phone already exists
            let existingUser = null;
            if (customer_email && customer_email.trim()) {
                const [byEmail] = await db.query('SELECT id, name, phone FROM users WHERE email = ?', [customer_email.trim().toLowerCase()]);
                if (byEmail.length > 0) existingUser = byEmail[0];
            }
            if (!existingUser && finalCustomerPhone) {
                const [byPhone] = await db.query('SELECT id, name, phone FROM users WHERE phone = ?', [finalCustomerPhone]);
                if (byPhone.length > 0) existingUser = byPhone[0];
            }

            if (existingUser) {
                targetCustomerId = existingUser.id;
                finalCustomerName = existingUser.name;
                finalCustomerPhone = existingUser.phone;
            } else {
                const generatedEmail = (customer_email && customer_email.trim()) 
                    ? customer_email.trim().toLowerCase() 
                    : `customer_${Date.now()}@laundrigo.local`;
                const bcrypt = require('bcrypt');
                const defaultHash = await bcrypt.hash('LaundriGo123!', 10);
                const [newUserResult] = await db.query(
                    'INSERT INTO users (name, email, password, phone, role, is_active, approval_status, created_by) VALUES (?, ?, ?, ?, "customer", 1, "approved", ?)',
                    [finalCustomerName, generatedEmail, defaultHash, finalCustomerPhone, workerId]
                );
                targetCustomerId = newUserResult.insertId;
            }
        } else {
            const [custRows] = await db.query('SELECT id, name, phone FROM users WHERE id = ?', [targetCustomerId]);
            if (custRows.length > 0) {
                finalCustomerName = custRows[0].name;
                finalCustomerPhone = custRows[0].phone;
            }
        }

        // Automatic price calculation using existing rules
        const pricing = calculateLaundryPricing(numericWeight);
        const calcAmount = pricing.totalAmount;
        const loadCount = pricing.loadCount;
        const loadDetails = JSON.stringify(pricing.loads);
        const sName = service_name || 'Wash & Fold';

        // Reference number generation LAU-YYYY-XXXXX
        const year = new Date().getFullYear();
        const [lastOrder] = await db.query('SELECT id FROM laundry_orders ORDER BY id DESC LIMIT 1');
        const nextId = (lastOrder.length > 0 ? lastOrder[0].id : 0) + 1;
        const order_number = `LAU-${year}-${String(nextId).padStart(5, '0')}`;

        const isPaid = (payment_status === 'paid' || payment_status === 'Paid');
        const initialPaymentStatus = isPaid ? 'paid' : 'unpaid';
        const finalPaymentMethod = payment_method || 'cash';
        const initialStatus = 'Processing';
        const initialStage = 'Washing';

        const [orderResult] = await db.query(
            `INSERT INTO laundry_orders 
            (order_number, customer_id, service_type, service_name, estimated_weight, actual_weight, total_amount, estimated_amount, final_amount, load_count, load_details, pricing_version, preferred_date, preferred_time, special_instructions, status, processing_stage, processing_started_at, weight_approved_by_customer, weight_approved_at, weight_recorded_by, weight_recorded_at, payment_status, payment_method, is_walkin, registered_by, payment_collected_by, payment_collected_at) 
            VALUES (?, ?, 'customer_dropoff', ?, ?, ?, ?, ?, ?, ?, ?, ?, CURDATE(), 'Drop-off', ?, ?, ?, NOW(), 1, NOW(), ?, NOW(), ?, ?, 1, ?, ?, ?)`,
            [
                order_number,
                targetCustomerId,
                sName,
                numericWeight,
                numericWeight,
                calcAmount,
                calcAmount,
                calcAmount,
                loadCount,
                loadDetails,
                pricing.pricingVersion,
                special_instructions || 'Walk-in / Drop-off Laundry at Shop',
                initialStatus,
                initialStage,
                workerId,
                initialPaymentStatus,
                finalPaymentMethod,
                workerId,
                isPaid ? workerId : null,
                isPaid ? new Date() : null
            ]
        );

        const orderId = orderResult.insertId;

        // If marked as Paid, record payment
        if (isPaid) {
            const refNum = `WALK-PAY-${Date.now()}`;
            await db.query(
                'INSERT INTO payments (order_id, amount, payment_method, payment_status, reference_number, collected_by, payment_date) VALUES (?, ?, ?, "paid", ?, ?, NOW())',
                [orderId, calcAmount, finalPaymentMethod, refNum, workerId]
            );

            // Payment received activity log
            await logActivity({
                req,
                actorId: workerId,
                actorName: workerName,
                actorRole: req.user.role,
                actionType: 'payment_received',
                description: `Payment received – ₱${calcAmount.toFixed(2)}`,
                entityType: 'payment',
                entityId: orderId,
                outcome: 'success',
                metadata: { order_number, amount: calcAmount, reference_number: refNum, customer_name: finalCustomerName }
            });
        }

        // Status history entry - records initial Processing status and Washing stage
        await db.query(
            'INSERT INTO laundry_status_history (order_id, status, notes, changed_by) VALUES (?, ?, ?, ?)',
            [orderId, initialStatus, `Walk-in laundry registered by worker ${workerName} (${numericWeight} kg, ₱${calcAmount.toFixed(2)}, ${initialPaymentStatus}). Processing started automatically in ${initialStage} stage.`, workerId]
        );

        // Activity log for walk-in registration
        await logActivity({
            req,
            actorId: workerId,
            actorName: workerName,
            actorRole: req.user.role,
            actionType: 'walk_in_registered',
            description: `Walk-in laundry registered and started processing – Worker: ${workerName}`,
            entityType: 'order',
            entityId: orderId,
            outcome: 'success',
            metadata: {
                order_number,
                customer_name: finalCustomerName,
                weight: numericWeight,
                total_amount: calcAmount,
                payment_status: initialPaymentStatus,
                status: initialStatus,
                processing_stage: initialStage,
                worker_name: workerName
            }
        });

        // Customer notification
        await createNotification({
            userId: targetCustomerId,
            orderId,
            title: 'Laundry Processing Started',
            message: `Walk-in laundry order ${order_number} (${numericWeight} kg) has started processing (${initialStage} stage).`,
            type: 'order',
            relatedUserId: workerId,
            targetUrl: `/customer/orders?orderId=${orderId}`
        });

        // Notify staff
        await notifyWorkersAndAdmin({
            orderId,
            title: 'New Walk-In Laundry In Processing',
            message: `Walk-in laundry ${order_number} registered by ${workerName} for ${finalCustomerName} is now in processing.`,
            type: 'order',
            relatedUserId: workerId,
            targetUrl: `/worker/orders?orderId=${orderId}`
        });

        res.status(201).json({
            success: true,
            message: 'Laundry transaction successfully added and set to Processing.',
            orderId,
            order: {
                id: orderId,
                order_number,
                customer_name: finalCustomerName,
                weight: numericWeight,
                total_amount: calcAmount,
                payment_status: initialPaymentStatus,
                status: initialStatus,
                processing_stage: initialStage
            },
            order_number,
            customer_name: finalCustomerName,
            weight: numericWeight,
            total_amount: calcAmount,
            load_count: loadCount,
            loads: pricing.loads,
            payment_status: initialPaymentStatus,
            status: initialStatus,
            processing_stage: initialStage
        });
    } catch (error) {
        console.error('Error creating walk-in order:', error);
        res.status(500).json({ message: 'Failed to save laundry transaction: ' + error.message });
    }
};

// 14. WORKER: Start Laundry Processing (Simplified Status: Processing)
const startLaundryProcessing = async (req, res) => {
    try {
        const orderId = req.params.id;
        const workerId = req.user.id;
        const workerName = req.user.name;

        const [orders] = await db.query('SELECT * FROM laundry_orders WHERE id = ?', [orderId]);
        if (orders.length === 0) return res.status(404).json({ message: 'Order not found' });
        const order = orders[0];

        const nextStatus = 'Processing';
        await db.query(
            'UPDATE laundry_orders SET status = ?, processing_started_at = NOW(), processing_stage = "Processing" WHERE id = ?',
            [nextStatus, orderId]
        );

        await db.query(
            'INSERT INTO laundry_status_history (order_id, status, notes, changed_by) VALUES (?, ?, ?, ?)',
            [orderId, nextStatus, 'Laundry processing started by worker ' + workerName + ' (allow approx. 2 hours)', workerId]
        );

        // Customer notification
        await createNotification({
            userId: order.customer_id,
            orderId,
            title: 'Processing Started',
            message: 'Your laundry is being processed. Please allow approximately 2 hours.',
            type: 'order',
            relatedUserId: workerId,
            targetUrl: `/customer/orders?orderId=${orderId}`
        });

        // Activity log
        await logActivity({
            req,
            actorId: workerId,
            actorName: workerName,
            actorRole: req.user.role,
            actionType: 'processing_started',
            description: `Laundry processing started – Order #${order.order_number}`,
            entityType: 'order',
            entityId: orderId,
            outcome: 'success',
            metadata: { order_number: order.order_number, worker_name: workerName }
        });

        res.json({
            success: true,
            message: 'Laundry successfully marked as processing.',
            status: nextStatus
        });
    } catch (error) {
        console.error('Error starting processing:', error);
        res.status(500).json({ message: 'Failed to update laundry status: ' + error.message });
    }
};

// 15. WORKER: Mark Laundry as Ready for Pickup/Delivery
const markLaundryReady = async (req, res) => {
    try {
        const orderId = req.params.id;
        const workerId = req.user.id;
        const workerName = req.user.name;

        const [orders] = await db.query('SELECT * FROM laundry_orders WHERE id = ?', [orderId]);
        if (orders.length === 0) return res.status(404).json({ message: 'Order not found' });
        const order = orders[0];

        const nextStatus = 'Ready for Pickup/Delivery';
        await db.query(
            'UPDATE laundry_orders SET status = ?, ready_at = NOW() WHERE id = ?',
            [nextStatus, orderId]
        );

        await db.query(
            'INSERT INTO laundry_status_history (order_id, status, notes, changed_by) VALUES (?, ?, ?, ?)',
            [orderId, nextStatus, 'Laundry completed and marked as ready by ' + workerName, workerId]
        );

        // Customer notification
        await createNotification({
            userId: order.customer_id,
            orderId,
            title: 'Laundry Ready',
            message: 'Your laundry is ready. Choose delivery or self-pickup.',
            type: 'order',
            relatedUserId: workerId,
            targetUrl: `/customer/orders?orderId=${orderId}`
        });

        // Activity log
        await logActivity({
            req,
            actorId: workerId,
            actorName: workerName,
            actorRole: req.user.role,
            actionType: 'order_ready',
            description: `Laundry marked as ready for pickup – Order #${order.order_number}`,
            entityType: 'order',
            entityId: orderId,
            outcome: 'success',
            metadata: { order_number: order.order_number, worker_name: workerName }
        });

        res.json({
            success: true,
            message: 'Laundry successfully marked as ready.',
            status: nextStatus
        });
    } catch (error) {
        console.error('Error marking laundry ready:', error);
        res.status(500).json({ message: 'Failed to update laundry status: ' + error.message });
    }
};

// 16. CUSTOMER: Select Delivery or Self-Pickup Option
const selectFulfillmentChoice = async (req, res) => {
    try {
        const orderId = req.params.id;
        const customerId = req.user.id;
        const { choice, delivery_address_text, delivery_latitude, delivery_longitude } = req.body;

        if (choice !== 'delivery' && choice !== 'self_pickup') {
            return res.status(400).json({ message: 'Invalid choice. Must be either delivery or self_pickup.' });
        }

        const [orders] = await db.query('SELECT * FROM laundry_orders WHERE id = ?', [orderId]);
        if (orders.length === 0) return res.status(404).json({ message: 'Order not found' });
        const order = orders[0];

        if (req.user.role === 'customer' && order.customer_id !== customerId) {
            return res.status(403).json({ message: 'Access denied.' });
        }

        let notifTitle = '';
        let notifMsg = '';
        let actType = '';
        let actDesc = '';
        let newOrderStatus = order.status;

        if (choice === 'delivery') {
            newOrderStatus = 'Ready for Delivery';
            const finalAddress = delivery_address_text || order.delivery_address_text || order.pickup_address_text || 'Customer Registered Address';
            
            await db.query(
                'UPDATE laundry_orders SET customer_choice = "delivery", status = ?, delivery_address_text = ? WHERE id = ?',
                [newOrderStatus, finalAddress, orderId]
            );

            // Ensure delivery_requests has pending record for driver assignment
            const [existingDelivery] = await db.query('SELECT id FROM delivery_requests WHERE order_id = ?', [orderId]);
            if (existingDelivery.length > 0) {
                await db.query('UPDATE delivery_requests SET status = "pending", notes = ? WHERE order_id = ?', [finalAddress, orderId]);
            } else {
                await db.query(
                    'INSERT INTO delivery_requests (order_id, customer_id, status, delivery_date, delivery_time, notes) VALUES (?, ?, "pending", CURDATE(), "Afternoon", ?)',
                    [orderId, order.customer_id, finalAddress]
                );
            }

            notifTitle = 'Delivery Selected';
            notifMsg = 'Your laundry will be delivered';
            actType = 'delivery_selected';
            actDesc = `Customer selected delivery – Order #${order.order_number}`;

            // Notify staff
            await notifyWorkersAndAdmin({
                orderId,
                title: 'Delivery Option Selected',
                message: `Customer selected delivery for order ${order.order_number}. Address: ${finalAddress}`,
                type: 'delivery',
                relatedUserId: customerId,
                targetUrl: `/worker/orders?orderId=${orderId}`
            });
        } else {
            // self_pickup
            newOrderStatus = 'Customer Pickup';
            await db.query(
                'UPDATE laundry_orders SET customer_choice = "self_pickup", status = ? WHERE id = ?',
                [newOrderStatus, orderId]
            );

            notifTitle = 'Pickup Selected';
            notifMsg = 'Your laundry is ready for pickup';
            actType = 'pickup_selected';
            actDesc = `Customer selected self-pickup – Order #${order.order_number}`;

            // Notify staff
            await notifyWorkersAndAdmin({
                orderId,
                title: 'Self-Pickup Selected',
                message: `Customer selected self-pickup for order ${order.order_number}. Awaiting customer collection at shop.`,
                type: 'order',
                relatedUserId: customerId,
                targetUrl: `/worker/orders?orderId=${orderId}`
            });
        }

        // Status history
        await db.query(
            'INSERT INTO laundry_status_history (order_id, status, notes, changed_by) VALUES (?, ?, ?, ?)',
            [orderId, newOrderStatus, actDesc, customerId]
        );

        // Customer notification
        await createNotification({
            userId: order.customer_id,
            orderId,
            title: notifTitle,
            message: notifMsg,
            type: choice === 'delivery' ? 'delivery' : 'order',
            targetUrl: `/customer/orders?orderId=${orderId}`
        });

        // Centralized activity log
        await logActivity({
            req,
            actorId: customerId,
            actorName: req.user.name,
            actorRole: req.user.role,
            actionType: actType,
            description: actDesc,
            entityType: 'order',
            entityId: orderId,
            outcome: 'success',
            metadata: { order_number: order.order_number, choice }
        });

        res.json({
            success: true,
            message: choice === 'delivery' ? 'Delivery option successfully selected. Your laundry will be delivered.' : 'Self-pickup option successfully selected. Your laundry is ready for pickup at our shop.',
            choice,
            customer_choice: choice,
            status: newOrderStatus
        });
    } catch (error) {
        console.error('Error selecting fulfillment choice:', error);
        res.status(500).json({ message: 'Failed to select option: ' + error.message });
    }
};

// 17. WORKER: Mark Order as Completed
const completeOrder = async (req, res) => {
    try {
        const orderId = req.params.id;
        const userId = req.user.id;
        const userName = req.user.name;

        const [orders] = await db.query('SELECT * FROM laundry_orders WHERE id = ?', [orderId]);
        if (orders.length === 0) return res.status(404).json({ message: 'Order not found' });
        const order = orders[0];

        const nextStatus = 'Completed';
        await db.query(
            'UPDATE laundry_orders SET status = ?, completed_at = NOW() WHERE id = ?',
            [nextStatus, orderId]
        );

        // If delivery request exists, mark as delivered
        await db.query('UPDATE delivery_requests SET status = "delivered", actual_time = NOW() WHERE order_id = ?', [orderId]);

        const isSelfPickup = (order.customer_choice === 'self_pickup' || order.status === 'Customer Pickup');
        const specificDesc = isSelfPickup 
            ? `Laundry picked up by the customer – Order #${order.order_number}`
            : `Laundry delivered – Order #${order.order_number}`;

        // Status history
        await db.query(
            'INSERT INTO laundry_status_history (order_id, status, notes, changed_by) VALUES (?, ?, ?, ?)',
            [orderId, nextStatus, `Transaction completed (${isSelfPickup ? 'Shop Self-Pickup' : 'Delivery Handover'}) by ${userName}`, userId]
        );

        // Customer notification
        await createNotification({
            userId: order.customer_id,
            orderId,
            title: 'Completed',
            message: 'Your laundry transaction is completed. Thank you for choosing LaundriGo!',
            type: 'order',
            relatedUserId: userId,
            targetUrl: `/customer/orders?orderId=${orderId}`
        });

        // Log specific action (picked up by customer vs delivered)
        await logActivity({
            req,
            actorId: userId,
            actorName: userName,
            actorRole: req.user.role,
            actionType: isSelfPickup ? 'customer_picked_up' : 'laundry_delivered',
            description: specificDesc,
            entityType: 'order',
            entityId: orderId,
            outcome: 'success',
            metadata: { order_number: order.order_number }
        });

        // Log overall completed
        await logActivity({
            req,
            actorId: userId,
            actorName: userName,
            actorRole: req.user.role,
            actionType: 'order_completed',
            description: `Laundry completed – Order #${order.order_number}`,
            entityType: 'order',
            entityId: orderId,
            outcome: 'success',
            metadata: { order_number: order.order_number, completed_by: userName }
        });

        res.json({
            success: true,
            message: 'Laundry successfully marked as completed.',
            status: nextStatus
        });
    } catch (error) {
        console.error('Error completing order:', error);
        res.status(500).json({ message: 'Failed to complete order: ' + error.message });
    }
};

// 18. WORKER: Update Payment Status (Unpaid <-> Paid)
const updateOrderPaymentStatus = async (req, res) => {
    try {
        const orderId = req.params.id;
        const { payment_status, payment_method } = req.body;
        const workerId = req.user.id;
        const workerName = req.user.name;

        if (!payment_status || (payment_status !== 'paid' && payment_status !== 'unpaid')) {
            return res.status(400).json({ message: 'Payment status must be either "paid" or "unpaid".' });
        }

        const [orders] = await db.query('SELECT * FROM laundry_orders WHERE id = ?', [orderId]);
        if (orders.length === 0) return res.status(404).json({ message: 'Order not found' });
        const order = orders[0];

        const isPaid = (payment_status === 'paid');
        const amount = parseFloat(order.final_amount || order.total_amount || 0);
        const pMethod = payment_method || order.payment_method || 'cash';

        if (isPaid) {
            await db.query(
                'UPDATE laundry_orders SET payment_status = "paid", payment_collected_by = ?, payment_collected_at = NOW() WHERE id = ?',
                [workerId, orderId]
            );

            // Record payment in payments table
            const refNum = `PAY-${Date.now()}`;
            await db.query(
                'INSERT INTO payments (order_id, amount, payment_method, payment_status, reference_number, collected_by, payment_date) VALUES (?, ?, ?, "paid", ?, ?, NOW())',
                [orderId, amount, pMethod, refNum, workerId]
            );

            // Log activity: Payment received & Payment status updated
            await logActivity({
                req,
                actorId: workerId,
                actorName: workerName,
                actorRole: req.user.role,
                actionType: 'payment_received',
                description: `Payment received – ₱${amount.toFixed(2)}`,
                entityType: 'payment',
                entityId: orderId,
                outcome: 'success',
                metadata: { order_number: order.order_number, amount, reference_number: refNum }
            });

            await logActivity({
                req,
                actorId: workerId,
                actorName: workerName,
                actorRole: req.user.role,
                actionType: 'payment_status_updated',
                description: `Payment status updated – Order #${order.order_number}`,
                entityType: 'order',
                entityId: orderId,
                outcome: 'success',
                metadata: { order_number: order.order_number, payment_status: 'paid', worker_name: workerName }
            });

            // Customer notification
            await createNotification({
                userId: order.customer_id,
                orderId,
                title: 'Payment Received',
                message: `Payment of ₱${amount.toFixed(2)} has been recorded for order ${order.order_number}.`,
                type: 'payment',
                relatedUserId: workerId,
                targetUrl: `/customer/payments`
            });
        } else {
            await db.query(
                'UPDATE laundry_orders SET payment_status = "unpaid", payment_collected_by = NULL, payment_collected_at = NULL WHERE id = ?',
                [orderId]
            );

            await db.query(
                'UPDATE payments SET payment_status = "unpaid" WHERE order_id = ?',
                [orderId]
            );

            await logActivity({
                req,
                actorId: workerId,
                actorName: workerName,
                actorRole: req.user.role,
                actionType: 'payment_status_updated',
                description: `Payment status updated – Order #${order.order_number}`,
                entityType: 'order',
                entityId: orderId,
                outcome: 'success',
                metadata: { order_number: order.order_number, payment_status: 'unpaid', worker_name: workerName }
            });
        }

        res.json({
            success: true,
            message: `Payment status successfully updated to ${isPaid ? 'Paid' : 'Unpaid'}.`,
            payment_status: isPaid ? 'paid' : 'unpaid'
        });
    } catch (error) {
        console.error('Error updating payment status:', error);
        res.status(500).json({ message: 'Failed to update payment status: ' + error.message });
    }
};

module.exports = { 
    createOrder,
    createWalkInOrder,
    getOrders, 
    getOrderById, 
    approveOrder,
    rejectOrder,
    assignDriver,
    confirmLaundryReceipt,
    recordLaundryWeight,
    sendPriceToCustomer,
    customerWeightDecision,
    updateProcessingStage,
    startLaundryProcessing,
    markLaundryReady,
    selectFulfillmentChoice,
    completeOrder,
    updateOrderPaymentStatus,
    getWorkflowCounts,
    getAvailableDrivers,
    updateOrderStatus, 
    cancelOrder, 
    requestDelivery, 
    updateOrder, 
    deleteOrder 
};
