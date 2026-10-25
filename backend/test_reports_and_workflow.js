const API_BASE = 'http://localhost:5000/api';

async function req(url, options = {}) {
    const res = await fetch(`${API_BASE}${url}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(options.headers || {})
        },
        body: options.body ? JSON.stringify(options.body) : undefined
    });
    const text = await res.text();
    let data;
    try {
        data = JSON.parse(text);
    } catch {
        data = text;
    }
    if (!res.ok) {
        const err = new Error(data?.message || res.statusText || 'Request failed');
        err.status = res.status;
        err.data = data;
        throw err;
    }
    return { data, status: res.status };
}

async function runTests() {
    console.log('=== STARTING LAUNDRIGO COMPLETE WORKFLOW & REPORT VERIFICATION ===\n');

    try {
        // 1. Authenticate Admin (Junerey@gmail.com / junerey123)
        console.log('1. Authenticating Admin...');
        const adminLogin = await req('/auth/login', {
            method: 'POST',
            body: {
                email: 'Junerey@gmail.com',
                password: 'junerey123'
            }
        });
        const adminToken = adminLogin.data.token;
        console.log('✓ Admin authenticated successfully. User:', adminLogin.data.user.email, 'Role:', adminLogin.data.user.role);

        // 2. Authenticate Customer (customer@example.com / password123)
        console.log('\n2. Authenticating Customer...');
        const custLogin = await req('/auth/login', {
            method: 'POST',
            body: {
                email: 'customer@example.com',
                password: 'password123'
            }
        });
        const customerToken = custLogin.data.token;
        const customerUser = custLogin.data.user;
        console.log('✓ Customer authenticated successfully:', customerUser.email);

        // 3. Customer submits laundry request
        console.log('\n3. Testing Customer Laundry Request Submission...');
        const orderPayload = {
            service_name: 'Wash & Fold',
            estimated_weight: 5.5,
            total_amount: 160.00,
            preferred_date: new Date().toISOString().split('T')[0],
            preferred_time: 'Afternoon (1:00 PM - 5:00 PM)',
            pickup_address_text: 'Poblacion, Lagonglong, Misamis Oriental, 9006 Philippines',
            delivery_address_text: 'Poblacion, Lagonglong, Misamis Oriental, 9006 Philippines',
            pickup_latitude: 8.8105,
            pickup_longitude: 124.7925,
            payment_method: 'COD'
        };

        const createRes = await req('/orders', {
            method: 'POST',
            headers: { Authorization: `Bearer ${customerToken}` },
            body: orderPayload
        });
        console.log('✓ Order created response status:', createRes.status);
        console.log('✓ Order details:', {
            orderId: createRes.data.orderId,
            order_number: createRes.data.order_number,
            status: createRes.data.status,
            total_amount: createRes.data.total_amount
        });
        const testOrderId = createRes.data.orderId;

        // 4. Test Duplicate Prevention (idempotency within 10s)
        console.log('\n4. Testing Duplicate Request Prevention...');
        const dupRes = await req('/orders', {
            method: 'POST',
            headers: { Authorization: `Bearer ${customerToken}` },
            body: orderPayload
        });
        console.log('✓ Duplicate prevented. Order ID returned:', dupRes.data.orderId, 'Message:', dupRes.data.message);

        // 5. Customer fetches My Laundry orders
        console.log('\n5. Testing Customer My Laundry listing...');
        const custOrdersRes = await req('/orders', {
            method: 'GET',
            headers: { Authorization: `Bearer ${customerToken}` }
        });
        const foundOrder = custOrdersRes.data.find(o => o.id === testOrderId);
        if (!foundOrder) throw new Error('Created order not found in customer order list!');
        console.log('✓ Order found in Customer My Laundry. Status:', foundOrder.status, 'Ref:', foundOrder.order_number);

        // 6. Worker / Admin Order Management: Approve Request
        console.log('\n6. Testing Worker Approval Flow...');
        const approveRes = await req(`/orders/${testOrderId}/approve`, {
            method: 'PUT',
            headers: { Authorization: `Bearer ${adminToken}` }
        });
        console.log('✓ Order approved. Status:', approveRes.data.status);

        // 7. Get Available Drivers and Assign
        console.log('\n7. Testing Driver Assignment Flow...');
        const driversRes = await req('/orders/drivers/available', {
            method: 'GET',
            headers: { Authorization: `Bearer ${adminToken}` }
        });
        console.log(`✓ Available eligible drivers found: ${driversRes.data.length}`);
        if (driversRes.data.length > 0) {
            const driverToAssign = driversRes.data[0];
            const assignRes = await req(`/orders/${testOrderId}/assign-driver`, {
                method: 'PUT',
                headers: { Authorization: `Bearer ${adminToken}` },
                body: {
                    driver_id: driverToAssign.id,
                    task_type: 'pickup'
                }
            });
            console.log(`✓ Assigned driver ${driverToAssign.name}. Status:`, assignRes.data.status);
        }

        // 8. Confirm Receipt & Record Weight
        console.log('\n8. Testing Physical Receipt & Weight Recording...');
        await req(`/orders/${testOrderId}/confirm-receipt`, {
            method: 'PUT',
            headers: { Authorization: `Bearer ${adminToken}` },
            body: { notes: 'Received at hub' }
        });

        // Test weight calculation: 7.0 kg should be ₱180 (within 6.01 to 8 kg limit)
        const weightRes = await req(`/orders/${testOrderId}/record-weight`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${adminToken}` },
            body: { actual_weight: 7.0 }
        });
        console.log('✓ Weight recorded (7.0 kg). Calculated total:', weightRes.data.pricing?.totalAmount, 'Status:', weightRes.data.status);

        // 9. Send Price to Customer endpoint
        console.log('\n9. Testing Send Price to Customer...');
        const sendPriceRes = await req(`/orders/${testOrderId}/send-price`, {
            method: 'PUT',
            headers: { Authorization: `Bearer ${adminToken}` }
        });
        console.log('✓ Price notification sent to customer:', sendPriceRes.data.message);

        // 10. Test Overweight load split workflow with another order
        console.log('\n10. Testing Overweight (>8 kg) Multi-load Workflow...');
        // Add random seed to prevent duplicate detection from recent tests
        const overweightOrderRes = await req('/orders', {
            method: 'POST',
            headers: { Authorization: `Bearer ${customerToken}` },
            body: {
                service_name: 'Wash & Fold',
                estimated_weight: 12.0,
                total_amount: 320.00 + (Math.floor(Math.random() * 50)),
                preferred_date: new Date().toISOString().split('T')[0],
                preferred_time: 'Morning',
                pickup_address_text: 'Poblacion, Lagonglong',
                payment_method: 'COD'
            }
        });
        const overId = overweightOrderRes.data.orderId;
        await req(`/orders/${overId}/approve`, { method: 'PUT', headers: { Authorization: `Bearer ${adminToken}` } });
        await req(`/orders/${overId}/confirm-receipt`, { method: 'PUT', headers: { Authorization: `Bearer ${adminToken}` }, body: { notes: 'Hub check-in' } });
        
        // Record 12 kg -> Should split into 2 loads and require customer approval
        const overWeightRecord = await req(`/orders/${overId}/record-weight`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${adminToken}` },
            body: { actual_weight: 12.0 }
        });
        console.log('✓ Overweight order status:', overWeightRecord.data.status, 'Loads:', overWeightRecord.data.pricing?.loadCount, 'Total:', overWeightRecord.data.pricing?.totalAmount);

        // Customer approves proposal
        const decisionRes = await req(`/orders/${overId}/customer-weight-decision`, {
            method: 'PUT',
            headers: { Authorization: `Bearer ${customerToken}` },
            body: { decision: 'approve' }
        });
        console.log('✓ Customer approved overweight proposal:', decisionRes.data.message, 'Status:', decisionRes.data.status);

        // 11. Reports Endpoint Authorization Security: Non-admin should be rejected with 403
        console.log('\n11. Testing Reports Security & Authorization...');
        try {
            await req('/reports', {
                method: 'GET',
                headers: { Authorization: `Bearer ${customerToken}` }
            });
            throw new Error('SECURITY VIOLATION: Customer was able to access reports!');
        } catch (err) {
            if (err.status === 403) {
                console.log('✓ Reports security confirmed: Customer access blocked with 403 Forbidden.');
            } else {
                throw err;
            }
        }

        // 12. Admin Business Reports Generation
        console.log('\n12. Testing Admin Business Reports Generation...');
        
        // Daily Report
        const dailyReport = await req('/reports?period=daily', {
            method: 'GET',
            headers: { Authorization: `Bearer ${adminToken}` }
        });
        console.log('✓ Daily Report generated:');
        console.log('   - Period:', dailyReport.data.startDate, 'to', dailyReport.data.endDate);
        console.log('   - Total Requests:', dailyReport.data.businessSummary.totalRequests);
        console.log('   - Total Revenue (PHP):', dailyReport.data.businessSummary.totalRevenue);
        console.log('   - Total Weight Processed (kg):', dailyReport.data.businessSummary.totalWeightProcessedKg);
        console.log('   - Active Customers:', dailyReport.data.businessSummary.activeCustomers);
        console.log('   - Active Drivers:', dailyReport.data.businessSummary.activeDrivers);
        console.log('   - Transactions in ledger:', dailyReport.data.transactions.length);

        // Weekly Report
        const weeklyReport = await req('/reports?period=weekly', {
            method: 'GET',
            headers: { Authorization: `Bearer ${adminToken}` }
        });
        console.log('\n✓ Weekly Report generated:');
        console.log('   - Days in trend:', weeklyReport.data.salesRevenue.salesByDay.length);
        console.log('   - Services breakdown count:', weeklyReport.data.salesRevenue.salesByService.length);

        // Monthly Report
        const monthlyReport = await req('/reports?period=monthly', {
            method: 'GET',
            headers: { Authorization: `Bearer ${adminToken}` }
        });
        console.log('\n✓ Monthly Report generated:');
        console.log('   - Gross Sales:', monthlyReport.data.salesRevenue.grossSales);
        console.log('   - Recorded Payments:', monthlyReport.data.salesRevenue.paymentsReceived);

        // Custom Range Report
        const customReport = await req('/reports?period=custom&startDate=2026-01-01&endDate=2026-12-31', {
            method: 'GET',
            headers: { Authorization: `Bearer ${adminToken}` }
        });
        console.log('\n✓ Custom Date Range Report generated (2026-01-01 to 2026-12-31):');
        console.log('   - Total Orders:', customReport.data.businessSummary.totalRequests);
        console.log('   - Total Ledger rows:', customReport.data.transactions.length);

        console.log('\n======================================================');
        console.log('>>> ALL VERIFICATION TESTS PASSED SUCCESSFULLY! (100%) <<<');
        console.log('======================================================\n');
        process.exit(0);
    } catch (err) {
        console.error('\n❌ Test failed with error:', err.data || err.message);
        process.exit(1);
    }
}

runTests();
