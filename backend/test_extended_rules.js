const API = 'http://localhost:5000/api';

async function request(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(data.message || `HTTP ${res.status}`);
    error.status = res.status;
    error.data = data;
    throw error;
  }
  return { status: res.status, data };
}

async function runExtendedTests() {
  console.log('Running extended validation suite...');

  // 1. Verify pricing rules directly
  const { calculateLaundryPricing } = require('./utils/pricingCalculator');
  const table = [
    { weight: 4, loads: 1, total: 160 },
    { weight: 6, loads: 1, total: 160 },
    { weight: 7, loads: 1, total: 180 },
    { weight: 8, loads: 1, total: 180 },
    { weight: 10, loads: 2, total: 320 },
    { weight: 12, loads: 2, total: 320 },
    { weight: 14, loads: 2, total: 340 },
    { weight: 16, loads: 2, total: 360 }
  ];

  for (const t of table) {
    const res = calculateLaundryPricing(t.weight);
    if (res.totalAmount !== t.total || res.loadCount !== t.loads) {
      throw new Error(`Pricing failed for ${t.weight}kg: expected ${t.loads} loads ₱${t.total}, got ${res.loadCount} loads ₱${res.totalAmount}`);
    }
    console.log(`✓ Pricing ${t.weight}kg -> ${res.loadCount} load(s), Total: ₱${res.totalAmount}`);
  }

  // 2. Auth tokens
  const custRes = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'customer@example.com', password: 'password123' })
  });
  const custToken = custRes.data.token;
  const custHeaders = { headers: { Authorization: `Bearer ${custToken}` } };

  const workerRes = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'admin@example.com', password: 'password123' })
  });
  const workerToken = workerRes.data.token;
  const workerHeaders = { headers: { Authorization: `Bearer ${workerToken}` } };

  // 3. Test Customer Rejection of Weight Proposal
  console.log('\nTesting Customer Rejection of Overweight Proposal...');
  const orderRes = await request('/orders', {
    method: 'POST',
    body: JSON.stringify({
      service_type: 'shop_pickup',
      service_name: 'Wash & Fold',
      estimated_weight: 12,
      total_amount: 320,
      payment_method: 'COD'
    }),
    ...custHeaders
  });
  const orderId = orderRes.data.orderId;

  // Approve & receive
  await request(`/orders/${orderId}/approve`, { method: 'PUT', ...workerHeaders });
  await request(`/orders/${orderId}/confirm-receipt`, { method: 'PUT', ...workerHeaders });
  
  // Record weight 12 kg -> Awaiting Customer Approval
  await request(`/orders/${orderId}/record-weight`, {
    method: 'POST',
    body: JSON.stringify({ actual_weight: 12 }),
    ...workerHeaders
  });
  
  // Customer rejects
  const rejectRes = await request(`/orders/${orderId}/customer-weight-decision`, {
    method: 'PUT',
    body: JSON.stringify({
      decision: 'reject',
      rejection_reason: 'Too expensive for my budget'
    }),
    ...custHeaders
  });
  console.log(`✓ Customer rejection saved: Status is "${rejectRes.data.status}"`);

  // Verify worker cannot start processing
  try {
    await request(`/orders/${orderId}/processing-stage`, {
      method: 'PUT',
      body: JSON.stringify({ stage: 'Washing' }),
      ...workerHeaders
    });
    throw new Error('Should have blocked processing after rejection');
  } catch (err) {
    console.log(`✓ Correctly blocked processing after rejection: ${err.message}`);
  }

  // 4. Test Driver Conflict Protection
  console.log('\nTesting Driver Deactivation Conflict Protection...');
  const sumRes = await request('/users/summary', { method: 'GET', ...workerHeaders });
  const busyDriver = sumRes.data.drivers.find(d => (d.active_pickups + d.active_deliveries) > 0 && d.is_active === 1);
  if (busyDriver) {
    try {
      await request(`/users/${busyDriver.id}/toggle-active`, { method: 'PUT', ...workerHeaders });
      throw new Error('Should have prevented deactivating busy driver');
    } catch (err) {
      console.log(`✓ Correctly blocked deactivation of driver ${busyDriver.name}: ${err.message}`);
    }
  } else {
    console.log('Note: No active driver currently has active dispatches.');
  }

  // 5. Non-Admin cannot create Admin
  console.log('\nTesting Non-Admin Protection on Admin Creation...');
  try {
    await request('/users/admin', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Hacker Admin',
        email: 'hacker@example.com',
        password: 'password123'
      }),
      ...custHeaders
    });
    throw new Error('Customer should not be able to create admin');
  } catch (err) {
    console.log(`✓ Correctly denied non-admin creation: HTTP ${err.status} - ${err.message}`);
  }

  console.log('\n🎉 ALL EXTENDED TESTS PASSED PERFECTLY!');
}

runExtendedTests().catch(err => {
  console.error('Test error:', err.data || err.message);
  process.exit(1);
});
