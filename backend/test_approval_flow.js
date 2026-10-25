const apiBase = 'http://localhost:5000/api';

async function request(endpoint, options = {}) {
    const res = await fetch(`${apiBase}${endpoint}`, {
        headers: {
            'Content-Type': 'application/json',
            ...(options.headers || {})
        },
        ...options,
        body: options.body ? JSON.stringify(options.body) : undefined
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, ok: res.ok, data };
}

async function runBackendTests() {
    console.log('--- STARTING BACKEND VERIFICATION SUITE ---');

    // 1. Test Admin Login with Junerey@gmail.com / junerey123
    console.log('\n1. Testing Single Admin Account Login:');
    const adminLogin = await request('/auth/login', {
        method: 'POST',
        body: { email: 'Junerey@gmail.com', password: 'junerey123' }
    });
    console.log(`Status: ${adminLogin.status}`, adminLogin.data.message || adminLogin.data);
    if (adminLogin.status !== 200 || adminLogin.data.user?.role !== 'admin') {
        throw new Error('Admin login failed!');
    }
    const adminToken = adminLogin.data.token;
    const adminHeaders = { Authorization: `Bearer ${adminToken}` };

    // 2. Test Duplicate Email Registration
    console.log('\n2. Testing Duplicate Email Registration:');
    const dupReg = await request('/auth/register', {
        method: 'POST',
        body: {
            name: 'Duplicate Test',
            email: 'junerey@gmail.com',
            password: 'password123',
            role: 'customer'
        }
    });
    console.log(`Status: ${dupReg.status} (Expected 409)`, dupReg.data.message);
    if (dupReg.status !== 409) {
        throw new Error(`Expected 409 Conflict, got ${dupReg.status}`);
    }

    // 3. Test Unauthorized Role Registration (Admin / Worker)
    console.log('\n3. Testing Disallowed Role Registration (Admin):');
    const adminReg = await request('/auth/register', {
        method: 'POST',
        body: {
            name: 'Hacker Admin',
            email: 'hacker@example.com',
            password: 'password123',
            role: 'admin'
        }
    });
    console.log(`Status: ${adminReg.status} (Expected 403)`, adminReg.data.message);
    if (adminReg.status !== 403) {
        throw new Error(`Expected 403 Forbidden, got ${adminReg.status}`);
    }

    // 4. Test Driver Registration (Pending Approval)
    console.log('\n4. Testing Driver Registration (Pending Status):');
    const driverEmail = `testdriver_${Date.now()}@example.com`;
    const randomDigits = Math.floor(10000000 + Math.random() * 90000000);
    const testPhone = `09${randomDigits}`;
    const driverReg = await request('/auth/register', {
        method: 'POST',
        body: {
            name: `Juan Pending Driver ${Date.now()}`,
            email: driverEmail,
            password: 'driverpassword123',
            phone: testPhone,
            role: 'driver'
        }
    });
    console.log(`Status: ${driverReg.status} (Expected 201)`, driverReg.data);
    if (driverReg.status !== 201 || driverReg.data.approval_status !== 'pending') {
        throw new Error('Driver registration did not set pending status');
    }
    const driverUserId = driverReg.data.userId;

    // 5. Test Pending Driver Login Attempt (Must be blocked with 403)
    console.log('\n5. Testing Pending Driver Login Attempt (Must be rejected with 403):');
    const pendingLogin = await request('/auth/login', {
        method: 'POST',
        body: { email: driverEmail, password: 'driverpassword123' }
    });
    console.log(`Status: ${pendingLogin.status} (Expected 403)`, pendingLogin.data.message);
    if (pendingLogin.status !== 403) {
        throw new Error(`Expected 403 for pending driver, got ${pendingLogin.status}`);
    }

    // 6. Test Worker Access to User Management Summary (Must be 403 Forbidden)
    console.log('\n6. Testing Worker Access to User Management (Must be rejected with 403):');
    // Login as worker (id 2 or 9 or 11)
    const workerLogin = await request('/auth/login', {
        method: 'POST',
        body: { email: 'admin@example.com', password: 'password123' } // This is 'Admin Worker' with role 'worker'
    });
    if (workerLogin.status === 200) {
        const workerHeaders = { Authorization: `Bearer ${workerLogin.data.token}` };
        const workerSummary = await request('/users/summary', { headers: workerHeaders });
        console.log(`Status: ${workerSummary.status} (Expected 403)`, workerSummary.data.message);
        if (workerSummary.status !== 403) {
            throw new Error(`Expected 403 for worker accessing user management, got ${workerSummary.status}`);
        }
    }

    // 7. Test Admin View Driver Applications
    console.log('\n7. Testing Admin View Driver Applications:');
    const appsRes = await request('/users/driver-applications', { headers: adminHeaders });
    console.log(`Status: ${appsRes.status}`, `Found ${appsRes.data.length} application(s)`);
    const myApp = appsRes.data.find(a => a.user_id === driverUserId);
    if (!myApp) {
        throw new Error('Driver application record not found for registered driver');
    }
    console.log('Driver application verified:', myApp.applicant_name, myApp.status);

    // 8. Test Admin Approving Driver
    console.log('\n8. Testing Admin Approving Driver:');
    const approveRes = await request(`/users/drivers/${driverUserId}/approve`, {
        method: 'POST',
        headers: adminHeaders
    });
    console.log(`Status: ${approveRes.status}`, approveRes.data);
    if (approveRes.status !== 200 || approveRes.data.approval_status !== 'approved') {
        throw new Error('Driver approval failed');
    }

    // 9. Test Re-Approving Driver (Must be prevented - Idempotency)
    console.log('\n9. Testing Re-Approving Driver (Must prevent duplicate approval):');
    const reApproveRes = await request(`/users/drivers/${driverUserId}/approve`, {
        method: 'POST',
        headers: adminHeaders
    });
    console.log(`Status: ${reApproveRes.status} (Expected 400)`, reApproveRes.data.message);
    if (reApproveRes.status !== 400) {
        throw new Error('Duplicate approval was not prevented');
    }

    // 10. Test Approved Driver Login (Must now succeed)
    console.log('\n10. Testing Approved Driver Login:');
    const approvedLogin = await request('/auth/login', {
        method: 'POST',
        body: { email: driverEmail, password: 'driverpassword123' }
    });
    console.log(`Status: ${approvedLogin.status} (Expected 200)`, approvedLogin.data.message);
    if (approvedLogin.status !== 200 || approvedLogin.data.user?.approval_status !== 'approved') {
        throw new Error('Approved driver login failed');
    }

    // 11. Test Admin Rejecting a Driver
    console.log('\n11. Testing Driver Rejection:');
    // Register another driver to test rejection
    const driver2Email = `testdriver_reject_${Date.now()}@example.com`;
    const randomDigits2 = Math.floor(10000000 + Math.random() * 90000000);
    const testPhone2 = `09${randomDigits2}`;
    const driver2Reg = await request('/auth/register', {
        method: 'POST',
        body: {
            name: `Juan Rejected Driver ${Date.now()}`,
            email: driver2Email,
            password: 'driverpassword123',
            phone: testPhone2,
            role: 'driver'
        }
    });
    const driver2Id = driver2Reg.data.userId;

    const rejectRes = await request(`/users/drivers/${driver2Id}/reject`, {
        method: 'POST',
        headers: adminHeaders,
        body: { reason: 'Incomplete vehicle registration documents' }
    });
    console.log(`Status: ${rejectRes.status}`, rejectRes.data);
    if (rejectRes.status !== 200 || rejectRes.data.approval_status !== 'rejected') {
        throw new Error('Driver rejection failed');
    }

    // Test Rejected Driver Login Attempt (Must be rejected)
    const rejectedLogin = await request('/auth/login', {
        method: 'POST',
        body: { email: driver2Email, password: 'driverpassword123' }
    });
    console.log(`Status: ${rejectedLogin.status} (Expected 403)`, rejectedLogin.data.message);
    if (rejectedLogin.status !== 403) {
        throw new Error('Rejected driver was able to log in');
    }

    console.log('\n🎉 ALL BACKEND CHECKS PASSED 100% SUCCESSFULLY!\n');
}

runBackendTests().catch(err => {
    console.error('❌ BACKEND TEST ERROR:', err.message);
    process.exit(1);
});
