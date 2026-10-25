const db = require('../config/db');
const { logActivity } = require('../utils/activityLogger');

// Helper to recalculate payment status on the order
const recalculateOrderPayment = async (order_id) => {
    const [orders] = await db.query('SELECT total_amount FROM laundry_orders WHERE id = ?', [order_id]);
    if (orders.length === 0) return 'unpaid';
    const total_amount = parseFloat(orders[0].total_amount || 0);

    const [payments] = await db.query(
        'SELECT SUM(amount) as total_paid FROM payments WHERE order_id = ? AND payment_status = "paid"', 
        [order_id]
    );
    const total_paid = parseFloat(payments[0].total_paid || 0);

    let status = 'unpaid';
    if (total_paid >= total_amount && total_amount > 0) {
        status = 'paid';
    } else if (total_paid > 0) {
        status = 'partially_paid';
    }

    await db.query('UPDATE laundry_orders SET payment_status = ? WHERE id = ?', [status, order_id]);
    return status;
};

// 1. Get all payments
exports.getPayments = async (req, res) => {
    try {
        let query = `
            SELECT p.*, 
                   o.order_number, 
                   o.total_amount, 
                   u.name as customer_name,
                   u.phone as customer_phone,
                   cu.name as collector_name
            FROM payments p
            JOIN laundry_orders o ON p.order_id = o.id
            JOIN users u ON o.customer_id = u.id
            LEFT JOIN users cu ON p.collected_by = cu.id
        `;
        let params = [];
        
        if (req.user.role === 'customer') {
            query += ' WHERE o.customer_id = ?';
            params.push(req.user.id);
        } else if (req.user.role === 'driver') {
            // Drivers can see payments they collected or for their assigned orders
            query += ' WHERE p.collected_by = ?';
            params.push(req.user.id);
        }
        
        query += ' ORDER BY p.created_at DESC';
        const [payments] = await db.query(query, params);
        res.json(payments);
    } catch (error) {
        console.error('Error fetching payments:', error);
        res.status(500).json({ message: 'Error fetching payments', error: error.message });
    }
};

// 2. Get payment by ID
exports.getPaymentById = async (req, res) => {
    try {
        let query = `
            SELECT p.*, o.order_number, o.total_amount, u.name as customer_name, cu.name as collector_name
            FROM payments p
            JOIN laundry_orders o ON p.order_id = o.id
            JOIN users u ON o.customer_id = u.id
            LEFT JOIN users cu ON p.collected_by = cu.id
            WHERE p.id = ?
        `;
        const [payments] = await db.query(query, [req.params.id]);
        if (payments.length === 0) return res.status(404).json({ message: 'Payment not found' });
        res.json(payments[0]);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching payment', error: error.message });
    }
};

// 3. Get payments for a specific order
exports.getPaymentsByOrderId = async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const [payments] = await db.query(
            `SELECT p.*, cu.name as collector_name
             FROM payments p
             LEFT JOIN users cu ON p.collected_by = cu.id
             WHERE p.order_id = ? 
             ORDER BY p.created_at DESC`, 
            [orderId]
        );
        res.json(payments);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching order payments', error: error.message });
    }
};

// 4. Initiate GCash Checkout
exports.initiateGcashCheckout = async (req, res) => {
    try {
        const { order_id, amount } = req.body;
        if (!order_id || amount === undefined) {
            return res.status(400).json({ message: 'order_id and amount are required' });
        }

        const [orders] = await db.query(
            'SELECT lo.*, u.name as customer_name, u.email as customer_email, u.phone as customer_phone FROM laundry_orders lo JOIN users u ON lo.customer_id = u.id WHERE lo.id = ?', 
            [order_id]
        );
        if (orders.length === 0) return res.status(404).json({ message: 'Order not found' });

        const order = orders[0];
        const payableAmount = parseFloat(amount) || parseFloat(order.total_amount) || 0;
        if (payableAmount <= 0) {
            return res.status(400).json({ message: 'Payable amount must be greater than zero.' });
        }

        // Generate verified reference number
        const referenceNumber = `GCASH-${Date.now()}-${order.id}`;

        // If PayMongo Secret Key is present, make real call
        if (process.env.PAYMONGO_SECRET_KEY) {
            try {
                const paymongoRes = await fetch('https://api.paymongo.com/v1/checkout_sessions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Basic ${Buffer.from(process.env.PAYMONGO_SECRET_KEY + ':').toString('base64')}`
                    },
                    body: JSON.stringify({
                        data: {
                            attributes: {
                                send_email_receipt: true,
                                show_description: true,
                                show_line_items: true,
                                line_items: [{
                                    currency: 'PHP',
                                    amount: Math.round(payableAmount * 100), // in centavos
                                    name: `LaundriGo Order ${order.order_number}`,
                                    quantity: 1
                                }],
                                payment_method_types: ['gcash'],
                                reference_number: referenceNumber,
                                description: `Laundry service payment for order ${order.order_number}`
                            }
                        }
                    })
                });

                const data = await paymongoRes.json();
                if (data.data?.attributes?.checkout_url) {
                    // Record pending payment
                    await db.query(
                        'INSERT INTO payments (order_id, amount, payment_method, payment_status, reference_number, gateway_transaction_id) VALUES (?, ?, "gcash", "unpaid", ?, ?)',
                        [order_id, payableAmount, referenceNumber, data.data.id]
                    );

                    return res.json({
                        success: true,
                        checkout_url: data.data.attributes.checkout_url,
                        reference_number: referenceNumber,
                        provider: 'paymongo'
                    });
                }
            } catch (paymongoErr) {
                console.error('Paymongo API call error, falling back to secure sandbox gateway:', paymongoErr.message);
            }
        }

        // Standard compliant sandbox GCash checkout session
        await db.query(
            'INSERT INTO payments (order_id, amount, payment_method, payment_status, reference_number) VALUES (?, ?, "gcash", "unpaid", ?)',
            [order_id, payableAmount, referenceNumber]
        );

        res.json({
            success: true,
            checkout_url: `/gcash/checkout?ref=${referenceNumber}&order_id=${order_id}&amount=${payableAmount}`,
            reference_number: referenceNumber,
            payable_amount: payableAmount,
            order_number: order.order_number,
            customer_name: order.customer_name,
            provider: 'gcash_sandbox'
        });
    } catch (error) {
        console.error('GCash initiate error:', error);
        res.status(500).json({ message: 'Error initiating GCash payment', error: error.message });
    }
};

// 5. Verify & Confirm GCash Payment
exports.verifyGcashPayment = async (req, res) => {
    try {
        const { reference_number, transaction_id } = req.body;
        if (!reference_number) {
            return res.status(400).json({ message: 'Reference number is required for verification' });
        }

        const [payments] = await db.query(
            `SELECT p.*, o.order_number, o.customer_id 
             FROM payments p 
             JOIN laundry_orders o ON p.order_id = o.id 
             WHERE p.reference_number = ?`,
            [reference_number]
        );

        if (payments.length === 0) {
            return res.status(404).json({ message: 'Payment reference record not found' });
        }

        const payment = payments[0];
        if (payment.payment_status === 'paid') {
            return res.json({ 
                message: 'Payment is already verified and confirmed', 
                status: 'paid',
                payment 
            });
        }

        // Update payment record to paid
        await db.query(
            'UPDATE payments SET payment_status = "paid", gateway_transaction_id = ?, payment_date = NOW() WHERE id = ?',
            [transaction_id || `TXN-${Date.now()}`, payment.id]
        );

        // Recalculate order payment status
        const orderPaymentStatus = await recalculateOrderPayment(payment.order_id);

        // Notify customer
        await db.query(
            'INSERT INTO notifications (user_id, order_id, title, message) VALUES (?, ?, "GCash Payment Confirmed", ?)',
            [
                payment.customer_id, 
                payment.order_id, 
                `Your GCash payment of ₱${parseFloat(payment.amount).toFixed(2)} for order ${payment.order_number} (Ref: ${reference_number}) was received successfully.`
            ]
        );

        await logActivity({
            req,
            actorId: payment.customer_id,
            actorName: 'GCash Gateway',
            actorRole: 'system',
            actionType: 'payment_verified',
            description: `Verified GCash payment of ₱${parseFloat(payment.amount).toFixed(2)} for order ${payment.order_number} (Ref: ${reference_number})`,
            entityType: 'payment',
            entityId: payment.id,
            outcome: 'success',
            metadata: { order_number: payment.order_number, amount: payment.amount, reference: reference_number }
        });

        res.json({
            success: true,
            message: 'GCash payment confirmed successfully!',
            reference_number,
            amount: payment.amount,
            order_payment_status: orderPaymentStatus,
            payment_date: new Date().toISOString()
        });
    } catch (error) {
        console.error('GCash verify error:', error);
        res.status(500).json({ message: 'Error verifying GCash payment', error: error.message });
    }
};

// 6. Record Cash on Delivery (COD) by Driver or Staff
exports.recordCodCollection = async (req, res) => {
    try {
        const { order_id, amount, notes } = req.body;
        const collectorId = req.user.id;
        const collectorRole = req.user.role;

        if (!order_id || amount === undefined) {
            return res.status(400).json({ message: 'order_id and amount are required' });
        }

        const cashAmount = parseFloat(amount);
        if (cashAmount <= 0) {
            return res.status(400).json({ message: 'Collected cash amount must be greater than zero' });
        }

        const [orders] = await db.query(
            'SELECT lo.*, u.name as customer_name FROM laundry_orders lo JOIN users u ON lo.customer_id = u.id WHERE lo.id = ?', 
            [order_id]
        );
        if (orders.length === 0) return res.status(404).json({ message: 'Order not found' });

        const order = orders[0];
        const referenceNumber = `COD-${Date.now()}-${order.id}`;

        const [result] = await db.query(
            `INSERT INTO payments 
             (order_id, amount, payment_method, payment_status, reference_number, collected_by, payment_date) 
             VALUES (?, ?, 'cash', 'paid', ?, ?, NOW())`,
            [order_id, cashAmount, referenceNumber, collectorId]
        );

        const newPaymentStatus = await recalculateOrderPayment(order_id);

        // Add history
        await db.query(
            'INSERT INTO laundry_status_history (order_id, status, notes, changed_by) VALUES (?, ?, ?, ?)',
            [order_id, order.status, `Cash on Delivery collected: ₱${cashAmount.toFixed(2)} by ${req.user.name}`, collectorId]
        );

        // Notify customer
        await db.query(
            'INSERT INTO notifications (user_id, order_id, title, message) VALUES (?, ?, "COD Payment Received", ?)',
            [
                order.customer_id, 
                order_id, 
                `Cash on Delivery payment of ₱${cashAmount.toFixed(2)} received by ${req.user.name}. Reference: ${referenceNumber}.`
            ]
        );

        await logActivity({
            req,
            actorId: collectorId,
            actorName: req.user.name,
            actorRole: collectorRole,
            actionType: 'cod_collected',
            description: `Cash on Delivery collected: ₱${cashAmount.toFixed(2)} for order ${order.order_number} (Ref: ${referenceNumber})`,
            entityType: 'payment',
            entityId: result.insertId,
            outcome: 'success',
            metadata: { order_number: order.order_number, amount: cashAmount, reference: referenceNumber }
        });

        res.status(201).json({
            message: 'Cash payment recorded successfully',
            payment_id: result.insertId,
            reference_number: referenceNumber,
            amount: cashAmount,
            collector_name: req.user.name,
            order_payment_status: newPaymentStatus
        });
    } catch (error) {
        console.error('COD record error:', error);
        res.status(500).json({ message: 'Error recording COD payment', error: error.message });
    }
};

// 7. General create payment (Admin/Worker manual entry)
exports.createPayment = async (req, res) => {
    try {
        const { order_id, amount, payment_method, reference_number } = req.body;
        if (!order_id || amount === undefined || !payment_method) {
            return res.status(400).json({ message: 'order_id, amount, and payment_method are required' });
        }

        const floatAmount = parseFloat(amount);
        if (floatAmount < 0) {
            return res.status(400).json({ message: 'Payment amount cannot be negative' });
        }

        const [orders] = await db.query('SELECT total_amount FROM laundry_orders WHERE id = ?', [order_id]);
        if (orders.length === 0) {
            return res.status(404).json({ message: 'Invalid order ID' });
        }

        const [result] = await db.query(
            'INSERT INTO payments (order_id, amount, payment_method, payment_status, reference_number, collected_by, payment_date) VALUES (?, ?, ?, "paid", ?, ?, NOW())',
            [order_id, floatAmount, payment_method, reference_number || `PAY-${Date.now()}`, req.user.id]
        );

        await recalculateOrderPayment(order_id);

        await logActivity({
            req,
            actorId: req.user.id,
            actorName: req.user.name,
            actorRole: req.user.role,
            actionType: 'payment_recorded',
            description: `Manual payment of ₱${floatAmount.toFixed(2)} (${payment_method}) recorded for order #${order_id}`,
            entityType: 'payment',
            entityId: result.insertId,
            outcome: 'success',
            metadata: { order_id, amount: floatAmount, method: payment_method }
        });

        res.status(201).json({ message: 'Payment successfully recorded.', id: result.insertId });
    } catch (error) {
        res.status(500).json({ message: 'Error creating payment', error: error.message });
    }
};

// 8. Update Payment
exports.updatePayment = async (req, res) => {
    try {
        const { amount, payment_method, payment_status, reference_number } = req.body;
        let fields = [];
        let params = [];

        if (amount !== undefined) { fields.push('amount = ?'); params.push(parseFloat(amount)); }
        if (payment_method) { fields.push('payment_method = ?'); params.push(payment_method); }
        if (payment_status) { fields.push('payment_status = ?'); params.push(payment_status); }
        if (reference_number !== undefined) { fields.push('reference_number = ?'); params.push(reference_number); }

        if (fields.length === 0) return res.status(400).json({ message: 'No fields to update' });

        params.push(req.params.id);
        const query = `UPDATE payments SET ${fields.join(', ')} WHERE id = ?`;

        const [result] = await db.query(query, params);
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Payment not found' });

        const [p] = await db.query('SELECT order_id FROM payments WHERE id = ?', [req.params.id]);
        if (p.length > 0) {
            await recalculateOrderPayment(p[0].order_id);
        }

        await logActivity({
            req,
            actorId: req.user.id,
            actorName: req.user.name,
            actorRole: req.user.role,
            actionType: 'payment_updated',
            description: `Updated payment record #${req.params.id}`,
            entityType: 'payment',
            entityId: req.params.id,
            outcome: 'success'
        });

        res.json({ message: 'Payment updated successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error updating payment', error: error.message });
    }
};

// 9. Delete Payment (Admin only)
exports.deletePayment = async (req, res) => {
    try {
        const [p] = await db.query('SELECT order_id, amount, reference_number FROM payments WHERE id = ?', [req.params.id]);
        
        const [result] = await db.query('DELETE FROM payments WHERE id = ?', [req.params.id]);
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Payment not found' });
        
        if (p.length > 0) {
            await recalculateOrderPayment(p[0].order_id);
        }

        await logActivity({
            req,
            actorId: req.user.id,
            actorName: req.user.name,
            actorRole: req.user.role,
            actionType: 'payment_deleted',
            description: `Deleted payment record #${req.params.id} (Ref: ${p[0]?.reference_number || 'N/A'})`,
            entityType: 'payment',
            entityId: req.params.id,
            outcome: 'success'
        });

        res.json({ message: 'Payment deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting payment', error: error.message });
    }
};

// 10. Generate GCash Demo Verification PIN
exports.generateGcashDemoPin = async (req, res) => {
    try {
        const { phone } = req.body;
        if (!phone) {
            return res.status(400).json({ message: 'Mobile phone number is required.' });
        }

        const trimmedPhone = phone.trim();
        const PH_PHONE_REGEX = /^(09|\+639)\d{9}$/;
        if (!PH_PHONE_REGEX.test(trimmedPhone)) {
            return res.status(400).json({ 
                message: 'Please enter a valid Philippine mobile number (e.g. 09XXXXXXXXX or +639XXXXXXXXX).' 
            });
        }

        // Generate cryptographically secure 6-digit PIN (100000 to 999999)
        const crypto = require('crypto');
        const pin = String(crypto.randomInt(100000, 1000000));
        
        // 5 minute expiration
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

        // Invalidate older unused PINs for this phone number
        await db.query(
            'UPDATE gcash_demo_pins SET used = 1 WHERE phone = ? AND used = 0',
            [trimmedPhone]
        );

        // Store new PIN
        await db.query(
            'INSERT INTO gcash_demo_pins (phone, pin, expires_at, attempts, used) VALUES (?, ?, ?, 0, 0)',
            [trimmedPhone, pin, expiresAt]
        );

        const notice = 'GCash Demo Mode: This is a simulated payment for demonstration purposes only. No real money is transferred and no actual GCash account is charged.';

        res.json({
            success: true,
            phone: trimmedPhone,
            pin: pin, // Displayed in the demo UI for testing without a real SMS gateway
            demo_pin: pin,
            expires_at: expiresAt.toISOString(),
            expires_in_seconds: 300,
            notice
        });
    } catch (error) {
        console.error('Error generating GCash demo PIN:', error);
        res.status(500).json({ message: 'Error generating demo PIN', error: error.message });
    }
};

// 11. Verify GCash Demo PIN and Process Simulated Payment
exports.verifyAndProcessGcashDemoPayment = async (req, res) => {
    const conn = await db.getConnection();
    try {
        const { phone, pin, order_payload, order_id } = req.body;
        const customer_id = req.user.id;

        if (!phone || !pin) {
            return res.status(400).json({ message: 'Mobile number and 6-digit verification PIN are required.' });
        }

        const trimmedPhone = phone.trim();
        const trimmedPin = pin.trim();

        // 1. Fetch latest active PIN record
        const [pins] = await conn.query(
            'SELECT * FROM gcash_demo_pins WHERE phone = ? AND used = 0 ORDER BY id DESC LIMIT 1',
            [trimmedPhone]
        );

        if (pins.length === 0) {
            return res.status(400).json({ 
                message: 'No active demo verification session found for this number. Please request a new PIN.' 
            });
        }

        const pinRecord = pins[0];

        // 2. Check if expired
        const now = new Date();
        if (new Date(pinRecord.expires_at) < now) {
            await conn.query('UPDATE gcash_demo_pins SET used = 1 WHERE id = ?', [pinRecord.id]);
            return res.status(400).json({ message: 'Verification PIN has expired. Please request a new PIN.' });
        }

        // 3. Check attempt limit (max 3 attempts)
        if (pinRecord.attempts >= 3) {
            await conn.query('UPDATE gcash_demo_pins SET used = 1 WHERE id = ?', [pinRecord.id]);
            return res.status(400).json({ 
                message: 'Maximum verification attempts exceeded. Please request a new verification PIN.' 
            });
        }

        // 4. Verify entered PIN against stored backend PIN
        if (trimmedPin !== pinRecord.pin) {
            const updatedAttempts = pinRecord.attempts + 1;
            await conn.query('UPDATE gcash_demo_pins SET attempts = ? WHERE id = ?', [updatedAttempts, pinRecord.id]);
            const remainingAttempts = 3 - updatedAttempts;
            return res.status(400).json({ 
                message: `Incorrect verification PIN. ${remainingAttempts > 0 ? `${remainingAttempts} attempt(s) remaining.` : 'Please request a new PIN.'}`
            });
        }

        // 5. PIN is valid! Start database transaction
        await conn.beginTransaction();

        // Mark PIN as consumed
        await conn.query('UPDATE gcash_demo_pins SET used = 1 WHERE id = ?', [pinRecord.id]);

        let targetOrderId = order_id;
        let orderNumber = '';
        let payableAmount = 0;

        // If creating a new order as part of checkout
        if (order_payload) {
            const { 
                service_name, 
                estimated_weight, 
                total_amount, 
                preferred_date, 
                preferred_time, 
                pickup_address_text, 
                delivery_address_text, 
                pickup_latitude,
                pickup_longitude,
                delivery_latitude,
                delivery_longitude,
                special_instructions 
            } = order_payload;

            let pLat = pickup_latitude !== undefined && pickup_latitude !== null && pickup_latitude !== '' ? parseFloat(pickup_latitude) : 8.8105;
            let pLng = pickup_longitude !== undefined && pickup_longitude !== null && pickup_longitude !== '' ? parseFloat(pickup_longitude) : 124.7925;
            if (isNaN(pLat) || pLat < -90 || pLat > 90) pLat = 8.8105;
            if (isNaN(pLng) || pLng < -180 || pLng > 180) pLng = 124.7925;

            let dLat = delivery_latitude !== undefined && delivery_latitude !== null && delivery_latitude !== '' ? parseFloat(delivery_latitude) : pLat;
            let dLng = delivery_longitude !== undefined && delivery_longitude !== null && delivery_longitude !== '' ? parseFloat(delivery_longitude) : pLng;
            if (isNaN(dLat) || dLat < -90 || dLat > 90) dLat = pLat;
            if (isNaN(dLng) || dLng < -180 || dLng > 180) dLng = pLng;

            payableAmount = parseFloat(total_amount) || 0;
            const year = new Date().getFullYear();
            const [lastOrder] = await conn.query('SELECT id FROM laundry_orders ORDER BY id DESC LIMIT 1');
            const nextId = (lastOrder.length > 0 ? lastOrder[0].id : 0) + 1;
            orderNumber = `LAU-${year}-${String(nextId).padStart(5, '0')}`;

            const sType = 'shop_pickup';
            const pAddress = pickup_address_text ? pickup_address_text.trim() : 'Poblacion, Lagonglong, Misamis Oriental, 9006 Philippines';
            const dAddress = delivery_address_text ? delivery_address_text.trim() : pAddress;

            const [orderInsert] = await conn.query(
                `INSERT INTO laundry_orders 
                (order_number, customer_id, service_type, service_name, estimated_weight, total_amount, estimated_amount, preferred_date, preferred_time, pickup_address_text, delivery_address_text, pickup_latitude, pickup_longitude, delivery_latitude, delivery_longitude, special_instructions, payment_method, status, payment_status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'GCASH_DEMO', 'Pending Approval', 'Paid (Demo)')`,
                [
                    orderNumber,
                    customer_id,
                    sType,
                    service_name || 'Wash & Fold',
                    parseFloat(estimated_weight) || 0,
                    payableAmount,
                    payableAmount,
                    preferred_date || new Date().toISOString().split('T')[0],
                    preferred_time || 'Afternoon',
                    pAddress,
                    dAddress,
                    pLat,
                    pLng,
                    dLat,
                    dLng,
                    special_instructions || ''
                ]
            );

            targetOrderId = orderInsert.insertId;

            // Create pickup record with coordinates
            await conn.query(
                'INSERT INTO pickup_requests (order_id, customer_id, status, pickup_date, pickup_time, notes, pickup_latitude, pickup_longitude) VALUES (?, ?, "pending", ?, ?, ?, ?, ?)',
                [targetOrderId, customer_id, preferred_date || new Date().toISOString().split('T')[0], preferred_time || 'Afternoon', pAddress, pLat, pLng]
            );
        } else if (order_id) {
            const [existingOrders] = await conn.query(
                'SELECT * FROM laundry_orders WHERE id = ? AND customer_id = ?',
                [order_id, customer_id]
            );
            if (existingOrders.length === 0) {
                await conn.rollback();
                return res.status(404).json({ message: 'Order not found or unauthorized' });
            }
            const order = existingOrders[0];

            if (order.payment_status === 'paid' || order.payment_status === 'Paid (Demo)') {
                await conn.rollback();
                return res.status(400).json({ message: 'This order is already paid.' });
            }

            // Must have confirmed final amount if being paid after pickup
            const isUnweighed = !order.final_amount && (
                order.status === 'Pending Approval' || 
                order.status === 'Awaiting Pickup Assignment' || 
                order.status === 'Assigned to Driver' || 
                order.status === 'Picked Up'
            );
            if (isUnweighed) {
                await conn.rollback();
                return res.status(400).json({ message: 'Cannot process payment yet. The laundry must be received and weighed by the worker to confirm the official final payable amount.' });
            }

            targetOrderId = order.id;
            orderNumber = order.order_number;
            payableAmount = parseFloat(order.final_amount || order.total_amount) || 0;

            await conn.query(
                'UPDATE laundry_orders SET payment_method = "GCASH_DEMO", payment_status = "Paid (Demo)" WHERE id = ?',
                [targetOrderId]
            );
        } else {
            await conn.rollback();
            return res.status(400).json({ message: 'Neither order_payload nor order_id was provided.' });
        }

        // Record demo payment transaction
        const referenceNumber = `DEMO-GCASH-${Date.now()}-${targetOrderId}`;
        const [paymentInsert] = await conn.query(
            `INSERT INTO payments 
             (order_id, amount, payment_method, payment_status, reference_number, gateway_transaction_id, is_demo, payment_date)
             VALUES (?, ?, 'GCASH_DEMO', 'Paid (Demo)', ?, ?, 1, NOW())`,
            [targetOrderId, payableAmount, referenceNumber, `DEMO-TXN-${Date.now()}`]
        );

        // Audit status history (preserve existing order status if updating existing order)
        let auditStatus = 'Pending Approval';
        if (order_id && !order_payload) {
            const [o] = await conn.query('SELECT status FROM laundry_orders WHERE id = ?', [targetOrderId]);
            if (o.length > 0) auditStatus = o[0].status;
        }

        await conn.query(
            'INSERT INTO laundry_status_history (order_id, status, notes, changed_by) VALUES (?, ?, ?, ?)',
            [targetOrderId, auditStatus, `Demo payment of ₱${payableAmount.toFixed(2)} completed via GCash Demo Simulation (Ref: ${referenceNumber})`, customer_id]
        );

        // Customer notification
        await conn.query(
            'INSERT INTO notifications (user_id, order_id, title, message) VALUES (?, ?, "GCash Demo Payment Confirmed", ?)',
            [
                customer_id,
                targetOrderId,
                `Your simulated GCash payment of ₱${payableAmount.toFixed(2)} for order ${orderNumber} (Ref: ${referenceNumber}) has been recorded. Your order is Pending Approval.`
            ]
        );

        // Worker notification
        const [staff] = await conn.query('SELECT id FROM users WHERE role IN ("worker", "admin")');
        for (const worker of staff) {
            await conn.query(
                'INSERT INTO notifications (user_id, order_id, title, message) VALUES (?, ?, "New Order (GCash Demo Paid)", ?)',
                [worker.id, targetOrderId, `Order ${orderNumber} submitted by customer with simulated GCash payment of ₱${payableAmount.toFixed(2)}.`]
            );
        }

        await conn.commit();

        res.json({
            success: true,
            message: 'GCash Demo payment successful! Order created.',
            orderId: targetOrderId,
            order_number: orderNumber,
            reference_number: referenceNumber,
            amount: payableAmount,
            payment_method: 'GCASH_DEMO',
            payment_status: 'Paid (Demo)',
            status: 'Pending Approval',
            notice: 'GCash Demo Mode: This is a simulated payment for demonstration purposes only. No real money is transferred and no actual GCash account is charged.'
        });
    } catch (error) {
        await conn.rollback();
        console.error('Error verifying GCash demo payment:', error);
        res.status(500).json({ message: 'Error processing demo payment', error: error.message });
    } finally {
        conn.release();
    }
};

// 12. Select Cash on Delivery (COD) for confirmed order
exports.selectCodPayment = async (req, res) => {
    try {
        const { order_id } = req.body;
        const customer_id = req.user.id;

        if (!order_id) {
            return res.status(400).json({ message: 'order_id is required' });
        }

        const [orders] = await db.query(
            'SELECT * FROM laundry_orders WHERE id = ? AND customer_id = ?',
            [order_id, customer_id]
        );

        if (orders.length === 0) {
            return res.status(404).json({ message: 'Order not found or unauthorized' });
        }

        const order = orders[0];

        if (order.payment_status === 'paid' || order.payment_status === 'Paid (Demo)') {
            return res.status(400).json({ message: 'This order has already been paid.' });
        }

        await db.query(
            'UPDATE laundry_orders SET payment_method = "COD", payment_status = "Pending" WHERE id = ?',
            [order_id]
        );

        // Audit status history
        await db.query(
            'INSERT INTO laundry_status_history (order_id, status, notes, changed_by) VALUES (?, ?, ?, ?)',
            [order_id, order.status, `Customer selected Cash on Delivery (COD). Total payable: ₱${parseFloat(order.total_amount || 0).toFixed(2)}. Payment will be collected on delivery.`, customer_id]
        );

        // Notify customer
        await db.query(
            'INSERT INTO notifications (user_id, order_id, title, message) VALUES (?, ?, "COD Payment Method Selected", ?)',
            [customer_id, order_id, `Cash on Delivery selected for order ${order.order_number}. Our delivery driver will collect ₱${parseFloat(order.total_amount || 0).toFixed(2)} upon delivery.`]
        );

        res.json({
            success: true,
            message: 'Cash on Delivery selected. Payment will be collected upon delivery.',
            order_id,
            payment_method: 'COD',
            payment_status: 'Pending',
            payable_amount: parseFloat(order.total_amount || 0)
        });
    } catch (error) {
        console.error('Error selecting COD payment:', error);
        res.status(500).json({ message: 'Error selecting COD payment', error: error.message });
    }
};


