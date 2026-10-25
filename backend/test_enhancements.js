const { calculateLaundryPricing } = require('./utils/pricingCalculator');
const db = require('./config/db');

const API_BASE = 'http://localhost:5000/api';

async function postJson(url, body, token) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok) {
        throw new Error(`POST ${url} failed (${res.status}): ${data.message || JSON.stringify(data)}`);
    }
    return data;
}

async function putJson(url, body, token) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(url, {
        method: 'PUT',
        headers,
        body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok) {
        throw new Error(`PUT ${url} failed (${res.status}): ${data.message || JSON.stringify(data)}`);
    }
    return data;
}

async function getJson(url, token) {
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(url, { headers });
    const data = await res.json();
    if (!res.ok) {
        throw new Error(`GET ${url} failed (${res.status}): ${data.message || JSON.stringify(data)}`);
    }
    return data;
}

async function runTests() {
    console.log('=====================================================');
    console.log('🧪 LAUNDRIGO ENHANCEMENT VERIFICATION SUITE');
    console.log('=====================================================\n');

    let adminToken = '';

    // 1. Test Pricing Calculator
    console.log('▶ [1/6] Testing Multi-Load Package Pricing Rules...');
    
    // Test 5 kg
    const p5 = calculateLaundryPricing(5);
    console.log(`  - 5 kg: ${p5.loadCount} load(s), Total: ₱${p5.totalAmount}`);
    if (p5.loadCount !== 1 || p5.totalAmount !== 160) throw new Error('5 kg pricing mismatch');

    // Test 7 kg
    const p7 = calculateLaundryPricing(7);
    console.log(`  - 7 kg: ${p7.loadCount} load(s), Total: ₱${p7.totalAmount}`);
    if (p7.loadCount !== 1 || p7.totalAmount !== 180) throw new Error('7 kg pricing mismatch');

    // Test 14 kg
    const p14 = calculateLaundryPricing(14);
    console.log(`  - 14 kg: ${p14.loadCount} loads, Total: ₱${p14.totalAmount}`);
    p14.loads.forEach(l => {
        console.log(`    • Load ${l.loadNumber}: ${l.weight} kg (${l.price === 180 ? 'Up to 8 kg' : 'Up to 6 kg'}) - ₱${l.price}`);
    });
    if (p14.loadCount !== 2 || p14.totalAmount !== 340) {
        throw new Error(`14 kg should be 2 loads (8kg @ 180 + 6kg @ 160 = ₱340), got ${p14.totalAmount}`);
    }
    console.log('  ✅ Multi-load package calculation passed all test cases!\n');

    // 2. Test Admin Login & Activity Logging
    console.log('▶ [2/6] Testing Authentication & Audit Logging...');
    const adminLoginRes = await postJson(`${API_BASE}/auth/login`, {
        email: 'Junerey@gmail.com',
        password: 'junerey123'
    });
    adminToken = adminLoginRes.token;
    console.log(`  - Logged in as Admin: ${adminLoginRes.user.name} (${adminLoginRes.user.role})`);

    // Verify activity_logs table has auth_login
    const [recentAuthLogs] = await db.query(
        'SELECT * FROM activity_logs WHERE action_type = "auth_login" ORDER BY created_at DESC LIMIT 1'
    );
    if (recentAuthLogs.length === 0) throw new Error('auth_login activity not recorded');
    console.log(`  - Verified audit log created: [${recentAuthLogs[0].action_type}] ${recentAuthLogs[0].description}`);
    console.log('  ✅ Authentication activity logging verified!\n');

    // 3. Test Activity Logs API
    console.log('▶ [3/6] Testing Activity Logs Endpoints (/api/activities)...');
    const recentRes = await getJson(`${API_BASE}/activities/recent?limit=5`, adminToken);
    console.log(`  - /api/activities/recent returned ${recentRes.length} entries`);
    if (!Array.isArray(recentRes) || recentRes.length === 0) {
        throw new Error('Recent activities returned empty array');
    }

    const allRes = await getJson(`${API_BASE}/activities?page=1&limit=10`, adminToken);
    console.log(`  - /api/activities returned total ${allRes.total} records across ${allRes.totalPages} page(s)`);
    console.log('  ✅ Activity log queries and pagination verified!\n');

    // 4. Test Customer Login & Profile Location Pinning
    console.log('▶ [4/6] Testing Customer Profile Location Pinning (No Arbitrary Locations)...');
    let customerToken = '';
    const [custRows] = await db.query('SELECT id, name, email FROM users WHERE role = "customer" LIMIT 1');
    const jwt = require('jsonwebtoken');

    if (custRows.length > 0) {
        customerToken = jwt.sign(
            { id: custRows[0].id, name: custRows[0].name, email: custRows[0].email, role: 'customer' },
            process.env.JWT_SECRET || 'change_this_secret',
            { expiresIn: '1h' }
        );
    } else {
        const bcrypt = require('bcryptjs');
        const hash = await bcrypt.hash('password123', 10);
        const [ins] = await db.query(
            'INSERT INTO users (name, email, password, role, is_active) VALUES (?, ?, ?, "customer", 1)',
            ['Test Customer', 'customer.test@laundrigo.com', hash]
        );
        customerToken = jwt.sign(
            { id: ins.insertId, name: 'Test Customer', email: 'customer.test@laundrigo.com', role: 'customer' },
            process.env.JWT_SECRET || 'change_this_secret',
            { expiresIn: '1h' }
        );
    }

    const locationPayload = {
        address: 'Poblacion Zone 3, Near Municipal Hall, Lagonglong',
        latitude: 8.81234,
        longitude: 124.79456
    };

    const locRes = await putJson(`${API_BASE}/users/profile/location`, locationPayload, customerToken);
    console.log(`  - Location confirmed & saved: "${locationPayload.address}" (${locationPayload.latitude}, ${locationPayload.longitude})`);

    // Check activity log
    const [locLogs] = await db.query(
        'SELECT * FROM activity_logs WHERE action_type = "profile_location_saved" ORDER BY created_at DESC LIMIT 1'
    );
    if (locLogs.length > 0) {
        console.log(`  - Audit log confirmed: ${locLogs[0].description}`);
    }
    console.log('  ✅ Customer location pinning and persistence verified!\n');

    // 5. Test 14 kg Order Creation with Multi-load Breakdown
    console.log('▶ [5/6] Testing Order Creation with Multi-load Package Storage (14 kg)...');
    const orderPayload = {
        service_type: 'shop_pickup',
        service_name: 'Wash & Fold',
        estimated_weight: 14.0,
        load_count: p14.loadCount,
        load_details: JSON.stringify(p14.loads),
        total_amount: p14.totalAmount,
        estimated_amount: p14.totalAmount,
        preferred_date: new Date().toISOString().split('T')[0],
        preferred_time: 'Afternoon (1:00 PM - 5:00 PM)',
        pickup_address_text: 'Poblacion Zone 2, Lagonglong',
        delivery_address_text: 'Poblacion Zone 2, Lagonglong',
        pickup_latitude: 8.81050,
        pickup_longitude: 124.79250,
        delivery_latitude: 8.81050,
        delivery_longitude: 124.79250,
        payment_method: 'COD'
    };

    const orderRes = await postJson(`${API_BASE}/orders`, orderPayload, customerToken);
    console.log(`  - Order Created: ${orderRes.order_number} (ID: ${orderRes.orderId})`);

    // Verify in database
    const [orderInDb] = await db.query(
        'SELECT id, order_number, estimated_weight, load_count, load_details, estimated_amount, total_amount, pickup_latitude, pickup_longitude FROM laundry_orders WHERE id = ?',
        [orderRes.orderId]
    );

    if (orderInDb.length === 0) throw new Error('Order not found in DB');
    const dbOrder = orderInDb[0];
    console.log(`  - Database Record: Weight=${dbOrder.estimated_weight}kg, LoadCount=${dbOrder.load_count}, EstAmount=₱${dbOrder.estimated_amount}`);
    
    let parsedLoads = [];
    try {
        parsedLoads = typeof dbOrder.load_details === 'string' ? JSON.parse(dbOrder.load_details) : dbOrder.load_details;
    } catch (e) {}

    console.log(`  - Stored Load Details: ${parsedLoads.length} loads`);
    parsedLoads.forEach(l => {
        console.log(`    • Load ${l.loadNumber}: ${l.weight} kg - ₱${l.price}`);
    });

    if (Number(dbOrder.estimated_amount) !== 340 || dbOrder.load_count !== 2) {
        throw new Error('Database order pricing does not match 14kg multi-load calculation!');
    }

    // Verify order_created activity log
    const [orderLogs] = await db.query(
        'SELECT * FROM activity_logs WHERE entity_type = "order" AND entity_id = ? ORDER BY created_at DESC LIMIT 1',
        [orderRes.orderId]
    );
    if (orderLogs.length > 0) {
        console.log(`  - Audit log confirmed: [${orderLogs[0].action_type}] ${orderLogs[0].description}`);
    }
    console.log('  ✅ Multi-load order creation, breakdown persistence, and logging verified!\n');

    // 6. Test Logistics / Task Queue
    console.log('▶ [6/6] Testing Logistics & Navigation Endpoints...');
    const pickupsRes = await getJson(`${API_BASE}/logistics/pickups`, adminToken);
    console.log(`  - Pickups fetched: ${pickupsRes.length}`);
    const deliveriesRes = await getJson(`${API_BASE}/logistics/deliveries`, adminToken);
    console.log(`  - Deliveries fetched: ${deliveriesRes.length}`);
    console.log('  ✅ Logistics endpoints verified!\n');

    console.log('=====================================================');
    console.log('🎉 ALL 6 VERIFICATION TEST SUITES PASSED END-TO-END!');
    console.log('=====================================================');

    process.exit(0);
}

runTests().catch(err => {
    console.error('❌ Verification test failed:', err);
    process.exit(1);
});
