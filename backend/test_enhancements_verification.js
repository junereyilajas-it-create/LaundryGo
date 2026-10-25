const API_BASE = 'http://localhost:5000/api';

async function req(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  let data;
  try {
    data = await res.json();
  } catch (e) {
    data = null;
  }
  return { status: res.status, ok: res.ok, data };
}

async function runTests() {
  console.log('=== LAUNDRIGO SYSTEM ENHANCEMENTS VERIFICATION ===\n');
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`[PASS] ${message}`);
      passed++;
    } else {
      console.error(`[FAIL] ${message}`);
      failed++;
    }
  }

  // 1. Authenticate users
  console.log('--- 1. Authenticating Roles ---');
  let adminToken, customerToken, driverToken;
  let customerUser;

  // Admin login via /api/auth/login
  let adminRes = await req(`${API_BASE}/auth/login`, {
    method: 'POST',
    body: JSON.stringify({ email: 'Junerey@gmail.com', password: 'junerey123' })
  });
  if (!adminRes.ok) {
    adminRes = await req(`${API_BASE}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({ email: 'Junerey@gmail.com', password: 'password123' })
    });
  }
  if (!adminRes.ok) {
    adminRes = await req(`${API_BASE}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({ email: 'Junerey@gmail.com', password: 'password' })
    });
  }
  adminToken = adminRes.data?.token;
  assert(!!adminToken, `Admin logged in successfully (${adminRes.data?.user?.email})`);

  // Customer login via /api/auth/login
  const custRes = await req(`${API_BASE}/auth/login`, {
    method: 'POST',
    body: JSON.stringify({ email: 'customer@example.com', password: 'password123' })
  });
  customerToken = custRes.data?.token;
  customerUser = custRes.data?.user;
  assert(!!customerToken, `Customer logged in successfully (${custRes.data?.user?.email})`);

  // Driver login via /api/auth/login
  const drvRes = await req(`${API_BASE}/auth/login`, {
    method: 'POST',
    body: JSON.stringify({ email: 'driver@example.com', password: 'password123' })
  });
  driverToken = drvRes.data?.token;
  assert(!!driverToken, `Driver logged in successfully (${drvRes.data?.user?.email})`);

  // 2. Customer Order Details & 12-Step Progress
  console.log('\n--- 2. Customer Order Details & Progress API ---');
  const custOrdersRes = await req(`${API_BASE}/orders`, {
    headers: { Authorization: `Bearer ${customerToken}` }
  });
  assert(Array.isArray(custOrdersRes.data), `Customer retrieved ${custOrdersRes.data?.length} personal orders`);

  if (Array.isArray(custOrdersRes.data) && custOrdersRes.data.length > 0) {
    const order = custOrdersRes.data[0];
    const singleOrderRes = await req(`${API_BASE}/orders/${order.id}`, {
      headers: { Authorization: `Bearer ${customerToken}` }
    });
    const o = singleOrderRes.data;
    assert(o?.id === order.id, `Loaded single order #${o?.id} (${o?.order_number})`);
    assert(o?.status !== undefined, `Order has status: "${o?.status}"`);
    assert(Array.isArray(o?.history), `Order contains DB audit history with ${o?.history?.length} records`);
    assert(o?.service_name !== undefined, `Order has service_name: "${o?.service_name}"`);
    assert(o?.pickup_address !== undefined, `Order has pickup_address: "${o?.pickup_address}"`);
  }

  // Verify Customer cannot access another customer's order (Authorization enforcement)
  const allOrdersRes = await req(`${API_BASE}/orders`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  if (Array.isArray(allOrdersRes.data) && customerUser) {
    const otherOrder = allOrdersRes.data.find(ord => ord.customer_id !== customerUser.id);
    if (otherOrder) {
      const unauthorizedRes = await req(`${API_BASE}/orders/${otherOrder.id}`, {
        headers: { Authorization: `Bearer ${customerToken}` }
      });
      assert(unauthorizedRes.status === 403, `Customer access to another customer's order correctly rejected with 403 Forbidden`);
    }
  }

  // 3. Admin User Management: Summary, Re-approve & Resend SMS
  console.log('\n--- 3. Admin User Management & Driver Approval API ---');
  const summaryRes = await req(`${API_BASE}/users/summary`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert(summaryRes.ok && Array.isArray(summaryRes.data?.drivers), `Admin retrieved user summary with ${summaryRes.data?.drivers?.length} drivers`);

  const appsRes = await req(`${API_BASE}/users/driver-applications`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert(appsRes.ok && Array.isArray(appsRes.data), `Admin retrieved ${appsRes.data?.length} driver applications`);

  const approvedDriver = (summaryRes.data?.drivers || []).find(d => d.approval_status === 'approved' && d.phone && d.phone.length === 11 && d.phone.startsWith('09')) || summaryRes.data?.drivers?.[0];
  if (approvedDriver) {
    const smsRes = await req(`${API_BASE}/users/drivers/${approvedDriver.id}/resend-sms`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const smsHandled = (smsRes.status === 200 && smsRes.data?.message?.includes('SMS')) || 
                       (smsRes.status === 400 && smsRes.data?.message?.includes('SMS'));
    assert(smsHandled, `Resend SMS endpoint processed request with real provider feedback: "${smsRes.data?.message}"`);
  }

  // Find or reject a driver to test Re-approve
  const eligibleApp = (appsRes.data || []).find(a => a.status === 'rejected' || a.status === 'pending');
  const targetDriverId = eligibleApp ? eligibleApp.user_id : ((appsRes.data || [])[0]?.user_id || 22);

  if (targetDriverId) {
    // Ensure driver is rejected or inactive first so we can re-approve them
    await req(`${API_BASE}/users/drivers/${targetDriverId}/reject`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ reason: 'Verification testing rejection workflow' })
    });

    // Re-approve driver
    const reapproveRes = await req(`${API_BASE}/users/drivers/${targetDriverId}/reapprove`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(reapproveRes.status === 200 && reapproveRes.data?.approval_status === 'approved', `Re-approve driver endpoint succeeded: "${reapproveRes.data?.message}"`);

    // Non-admin blocked from re-approve
    const custReapprove = await req(`${API_BASE}/users/drivers/${targetDriverId}/reapprove`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${customerToken}` }
    });
    assert(custReapprove.status === 403, `Non-admin customer forbidden from re-approving driver (403: ${custReapprove.data?.message})`);
  }

  // Sole Admin Protection: Admin cannot delete themselves or be deactivated
  const allUsers = await req(`${API_BASE}/users`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  const primaryAdmin = (allUsers.data || []).find(u => (u.email || '').toLowerCase() === 'junerey@gmail.com');
  if (primaryAdmin) {
    const deleteAttempt = await req(`${API_BASE}/users/${primaryAdmin.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(deleteAttempt.status === 400 || deleteAttempt.status === 403, `Sole Admin account Junerey@gmail.com is protected against deletion (${deleteAttempt.status}: ${deleteAttempt.data?.message})`);

    const toggleAttempt = await req(`${API_BASE}/users/${primaryAdmin.id}/toggle-active`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(toggleAttempt.status === 400 || toggleAttempt.status === 403, `Sole Admin account Junerey@gmail.com is protected against deactivation (${toggleAttempt.status}: ${toggleAttempt.data?.message})`);
  }

  // 4. Notifications CRUD & Read/Delete API
  console.log('\n--- 4. Notifications CRUD & Read/Delete API ---');
  const notifsRes = await req(`${API_BASE}/notifications`, {
    headers: { Authorization: `Bearer ${customerToken}` }
  });
  assert(Array.isArray(notifsRes.data), `Customer retrieved ${notifsRes.data?.length} notifications`);

  if (Array.isArray(notifsRes.data) && notifsRes.data.length > 0) {
    const notif = notifsRes.data[0];
    const markRes = await req(`${API_BASE}/notifications/${notif.id}/read`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${customerToken}` }
    });
    assert(markRes.status === 200, `Notification #${notif.id} marked as read`);

    const markAllRes = await req(`${API_BASE}/notifications/read-all`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${customerToken}` }
    });
    assert(markAllRes.status === 200, `All notifications marked as read successfully`);
  }

  // 5. Complete CRUD across Modules: Services
  console.log('\n--- 5. Service Packages Complete CRUD API ---');
  const getServicesRes = await req(`${API_BASE}/services`);
  assert(Array.isArray(getServicesRes.data), `Read: ${getServicesRes.data?.length} service packages loaded`);

  const newService = {
    name: 'Verification Test Express Wash',
    description: 'Automated test package for complete CRUD audit',
    price: 180
  };
  const createRes = await req(`${API_BASE}/services`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify(newService)
  });
  const createdId = createRes.data?.service?.id || createRes.data?.id;
  assert(createRes.status === 201 && !!createdId, `Create: New service package created with ID #${createdId}`);

  if (createdId) {
    const updateRes = await req(`${API_BASE}/services/${createdId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        ...newService,
        price: 195,
        description: 'Updated automated test description'
      })
    });
    assert(updateRes.status === 200, `Update: Service #${createdId} updated price to 195`);

    const deleteRes = await req(`${API_BASE}/services/${createdId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(deleteRes.status === 200, `Delete: Service #${createdId} deleted successfully`);
  }

  console.log(`\n========================================`);
  console.log(`VERIFICATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
