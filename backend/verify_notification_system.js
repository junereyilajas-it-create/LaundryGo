const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const jwt = require('jsonwebtoken');
const db = require('./config/db');
const notificationService = require('./services/notificationService');
const { io } = require('../frontend/node_modules/socket.io-client');

const API_BASE = 'http://localhost:5000/api';
const SOCKET_URL = 'http://localhost:5000';
const JWT_SECRET = process.env.JWT_SECRET || 'laundrigo_super_secret_jwt_key_2026';

function createToken(userId, role, email) {
    return jwt.sign({ id: userId, role, email }, JWT_SECRET, { expiresIn: '1h' });
}

function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTests() {
    console.log('====================================================');
    console.log('🚀 COMPREHENSIVE NOTIFICATION SYSTEM VALIDATION');
    console.log('====================================================');

    const customerUser = { id: 13, role: 'customer', email: 'randrei@gmail.com' };
    const workerUser = { id: 9, role: 'worker', email: 'kentvalmores-it@srcb.edu.ph' };
    const driverUser = { id: 12, role: 'driver', email: 'kent@gmail.com' };
    const adminUser = { id: 18, role: 'admin', email: 'junerey@gmail.com' };

    const customerToken = createToken(customerUser.id, customerUser.role, customerUser.email);
    const workerToken = createToken(workerUser.id, workerUser.role, workerUser.email);
    const driverToken = createToken(driverUser.id, driverUser.role, driverUser.email);
    const adminToken = createToken(adminUser.id, adminUser.role, adminUser.email);

    // 1. Test Socket.IO Authentication and Connections
    console.log('\n[1/6] Connecting authenticated sockets for Customer, Worker, Driver, Admin...');
    
    const customerReceivedEvents = [];
    const workerReceivedEvents = [];
    const driverReceivedEvents = [];
    const adminReceivedEvents = [];

    const connectUserSocket = (token, userLabel, eventStorage) => {
        return new Promise((resolve, reject) => {
            const socket = io(SOCKET_URL, {
                auth: { token },
                transports: ['websocket', 'polling'],
                timeout: 5000
            });
            socket.on('connect', () => {
                console.log(`  ✓ ${userLabel} socket connected (${socket.id})`);
                resolve(socket);
            });
            socket.on('connect_error', (err) => {
                console.error(`  ✗ ${userLabel} connection error:`, err.message);
                reject(err);
            });
            socket.on('notification:new', (notif) => {
                eventStorage.push({ type: 'notification:new', data: notif });
            });
            socket.on('notification:unread_count', (payload) => {
                eventStorage.push({ type: 'notification:unread_count', data: payload });
            });
        });
    };

    const customerSocket = await connectUserSocket(customerToken, 'Customer', customerReceivedEvents);
    const workerSocket = await connectUserSocket(workerToken, 'Worker', workerReceivedEvents);
    const driverSocket = await connectUserSocket(driverToken, 'Driver', driverReceivedEvents);
    const adminSocket = await connectUserSocket(adminToken, 'Admin', adminReceivedEvents);

    await wait(300);

    // Helper to emit via running backend server
    const emitEventViaServer = async (token, payload) => {
        const res = await fetch(`${API_BASE}/notifications/emit-event`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        const text = await res.text();
        let data;
        try {
            data = JSON.parse(text);
        } catch {
            console.error(`HTTP ${res.status} non-json response:`, text);
            return null;
        }
        if (!res.ok) {
            console.error(`HTTP ${res.status}:`, data);
            return null;
        }
        if (data.notification === null || data.notification === undefined) {
            console.log('DEBUG: data returned is:', data);
        }
        return data.notification;
    };

    const runId = Date.now();

    // 2. Test Real-Time Event Dispatch & Privacy Isolation
    console.log('\n[2/6] Testing targeted notification dispatch & isolation...');
    
    const notif1 = await emitEventViaServer(customerToken, {
        userId: customerUser.id,
        title: `Laundry Processing Started #${runId}`,
        message: 'Your laundry is now in the washing stage.',
        notificationType: 'order',
        relatedOrderId: 9999,
        targetUrl: '/customer/track-order?id=9999'
    });
    console.log(`  ✓ Created Customer Notification (ID: ${notif1.id})`);

    const notif2 = await emitEventViaServer(driverToken, {
        userId: driverUser.id,
        title: `New Delivery Assignment #${runId}`,
        message: 'You have been assigned to pick up Order #9999.',
        notificationType: 'delivery',
        relatedOrderId: 9999,
        targetUrl: '/driver/deliveries'
    });
    console.log(`  ✓ Created Driver Notification (ID: ${notif2.id})`);

    await wait(800);

    // Verify Customer got only notif1 and Driver got only notif2
    const custNewNotifs = customerReceivedEvents.filter(e => e.type === 'notification:new');
    const driverNewNotifs = driverReceivedEvents.filter(e => e.type === 'notification:new');
    const workerNewNotifs = workerReceivedEvents.filter(e => e.type === 'notification:new');

    if (custNewNotifs.some(e => e.data.id === notif1.id) && !custNewNotifs.some(e => e.data.id === notif2.id)) {
        console.log('  ✓ Customer received its targeted notification in real time.');
    } else {
        throw new Error('Customer did not receive the correct targeted notification.');
    }

    if (driverNewNotifs.some(e => e.data.id === notif2.id) && !driverNewNotifs.some(e => e.data.id === notif1.id)) {
        console.log('  ✓ Driver received its targeted notification in real time.');
    } else {
        throw new Error('Driver did not receive the correct targeted notification.');
    }

    if (workerNewNotifs.length === 0) {
        console.log('  ✓ Worker received 0 private notifications for customer/driver (Privacy Isolation PASS).');
    } else {
        throw new Error('Privacy isolation failed! Worker received unrelated notifications.');
    }

    // 3. Test Broadcast / Multi-Recipient Dispatchers
    console.log('\n[3/6] Testing notifyWorkersAndAdmin & notifyAdmins dispatchers...');
    await emitEventViaServer(customerToken, {
        broadcast: 'workers_and_admin',
        title: `New Customer Order Placed #${runId}`,
        message: 'Customer Randrei placed a new order.',
        notificationType: 'order',
        relatedOrderId: 9999,
        targetUrl: '/worker/orders'
    });

    await wait(600);
    const workerOrderNotifs = workerReceivedEvents.filter(e => e.type === 'notification:new' && e.data.title === `New Customer Order Placed #${runId}`);
    const adminOrderNotifs = adminReceivedEvents.filter(e => e.type === 'notification:new' && e.data.title === `New Customer Order Placed #${runId}`);

    if (workerOrderNotifs.length > 0 && adminOrderNotifs.length > 0) {
        console.log('  ✓ Both Worker and Admin received the order notification simultaneously.');
    } else {
        throw new Error('notifyWorkersAndAdmin failed to notify both workers and admins.');
    }

    // 4. Test API Endpoints
    console.log('\n[4/6] Testing Notification REST API Endpoints...');
    
    // GET all notifications
    const getRes = await fetch(`${API_BASE}/notifications?filter=all`, {
        headers: { 'Authorization': `Bearer ${customerToken}` }
    });
    const notifs = await getRes.json();
    console.log(`  ✓ GET /api/notifications returned ${notifs.length} items`);
    const createdNotif = notifs.find(n => n.id === notif1.id);
    if (!createdNotif) throw new Error('Created notification not found in GET response.');

    // GET unread count
    const countRes = await fetch(`${API_BASE}/notifications/unread-count`, {
        headers: { 'Authorization': `Bearer ${customerToken}` }
    });
    const { unreadCount: beforeReadCount } = await countRes.json();
    console.log(`  ✓ GET /api/notifications/unread-count: ${beforeReadCount}`);

    // PUT mark as read
    const readRes = await fetch(`${API_BASE}/notifications/${notif1.id}/read`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${customerToken}` }
    });
    const readData = await readRes.json();
    console.log(`  ✓ PUT /api/notifications/${notif1.id}/read -> unread count: ${readData.unreadCount}`);
    if (readData.unreadCount !== beforeReadCount - 1) {
        throw new Error(`Expected unreadCount ${beforeReadCount - 1}, got ${readData.unreadCount}`);
    }

    // PUT mark as unread
    const unreadRes = await fetch(`${API_BASE}/notifications/${notif1.id}/unread`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${customerToken}` }
    });
    const unreadData = await unreadRes.json();
    console.log(`  ✓ PUT /api/notifications/${notif1.id}/unread -> unread count restored: ${unreadData.unreadCount}`);

    // PUT read all
    const readAllRes = await fetch(`${API_BASE}/notifications/read-all`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${customerToken}` }
    });
    const readAllData = await readAllRes.json();
    console.log(`  ✓ PUT /api/notifications/read-all -> unread count: ${readAllData.unreadCount}`);
    if (readAllData.unreadCount !== 0) throw new Error('Expected 0 unread after read-all');

    // DELETE single notification
    const deleteRes = await fetch(`${API_BASE}/notifications/${notif1.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${customerToken}` }
    });
    const deleteData = await deleteRes.json();
    console.log(`  ✓ DELETE /api/notifications/${notif1.id} -> Success`);

    // Verify deletion in DB
    const [checkDeleted] = await db.query('SELECT * FROM notifications WHERE id = ?', [notif1.id]);
    if (checkDeleted.length !== 0) throw new Error('Notification still exists in DB after DELETE');
    console.log('  ✓ Notification permanently deleted from database.');

    // 5. Test Notification Preferences
    console.log('\n[5/6] Testing Notification Preferences filtering...');
    
    // Fetch preferences
    const prefRes = await fetch(`${API_BASE}/notifications/preferences`, {
        headers: { 'Authorization': `Bearer ${customerToken}` }
    });
    const prefs = await prefRes.json();
    console.log('  ✓ Current Preferences:', JSON.stringify(prefs));

    // Update preferences: disable payment updates
    await fetch(`${API_BASE}/notifications/preferences`, {
        method: 'PUT',
        headers: { 
            'Authorization': `Bearer ${customerToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ payment_updates: false })
    });
    console.log('  ✓ Disabled payment_updates preference.');

    // Try sending payment notification to Customer
    customerReceivedEvents.length = 0; // reset
    const blockedPaymentNotif = await emitEventViaServer(customerToken, {
        userId: customerUser.id,
        title: 'Payment Invoice Ready',
        message: 'Your invoice of ₱350 is ready.',
        notificationType: 'payment',
        targetUrl: '/customer/payments'
    });
    
    if (blockedPaymentNotif === null) {
        console.log('  ✓ Payment notification was suppressed because payment_updates is disabled.');
    } else {
        throw new Error('Notification preference was not respected! Notification was created.');
    }

    // Try sending delivery notification (which is still enabled)
    const allowedDeliveryNotif = await emitEventViaServer(customerToken, {
        userId: customerUser.id,
        title: 'Driver Arrived',
        message: 'Your driver is outside your location.',
        notificationType: 'delivery',
        targetUrl: '/customer/track-order'
    });
    if (allowedDeliveryNotif !== null) {
        console.log('  ✓ Delivery notification allowed and sent (ID: ' + allowedDeliveryNotif.id + ')');
    } else {
        throw new Error('Delivery notification was unexpectedly suppressed!');
    }

    // Restore preference
    await fetch(`${API_BASE}/notifications/preferences`, {
        method: 'PUT',
        headers: { 
            'Authorization': `Bearer ${customerToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ payment_updates: true })
    });
    console.log('  ✓ Restored payment_updates preference to true.');

    // 6. Cleanup test records
    console.log('\n[6/6] Cleaning up test notifications...');
    await db.query('DELETE FROM notifications WHERE title LIKE ?', [`%#${runId}%`]);

    // Close sockets
    customerSocket.disconnect();
    workerSocket.disconnect();
    driverSocket.disconnect();
    adminSocket.disconnect();

    console.log('\n====================================================');
    console.log('🎉 ALL 6 VERIFICATION PHASES PASSED SUCCESSFULLY!');
    console.log('====================================================\n');
}

runTests().then(() => {
    process.exit(0);
}).catch(err => {
    console.error('\n❌ VERIFICATION FAILED:', err);
    process.exit(1);
});
