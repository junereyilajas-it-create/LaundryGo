const db = require('../config/db');

/**
 * LaundriGo Business Reports Controller
 * Authoritative backend calculations from actual database records.
 * Restricted strictly to Admin role.
 */

// Helper to format date as YYYY-MM-DD
function formatDate(d) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

const getBusinessReport = async (req, res) => {
    try {
        const { period = 'daily', startDate, endDate } = req.query;

        // Resolve date boundaries based on period in local time
        const now = new Date();
        let startBound;
        let endBound;

        if (period === 'daily') {
            const todayStr = formatDate(now);
            startBound = `${todayStr} 00:00:00`;
            endBound = `${todayStr} 23:59:59`;
        } else if (period === 'weekly') {
            const weekAgo = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
            startBound = `${formatDate(weekAgo)} 00:00:00`;
            endBound = `${formatDate(now)} 23:59:59`;
        } else if (period === 'monthly') {
            const monthAgo = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000);
            startBound = `${formatDate(monthAgo)} 00:00:00`;
            endBound = `${formatDate(now)} 23:59:59`;
        } else if (period === 'custom') {
            const s = startDate ? startDate : formatDate(now);
            const e = endDate ? endDate : formatDate(now);
            startBound = `${s} 00:00:00`;
            endBound = `${e} 23:59:59`;
        } else {
            const todayStr = formatDate(now);
            startBound = `${todayStr} 00:00:00`;
            endBound = `${todayStr} 23:59:59`;
        }

        // =========================================================================
        // 1. BUSINESS SUMMARY & ORDERS WITHIN PERIOD
        // =========================================================================
        const [ordersInPeriod] = await db.query(
            `SELECT lo.*, 
                    u.name as customer_name,
                    u.phone as customer_phone,
                    pu.name as pickup_driver_name,
                    du.name as delivery_driver_name,
                    wu.name as worker_name
             FROM laundry_orders lo
             JOIN users u ON lo.customer_id = u.id
             LEFT JOIN users pu ON lo.assigned_pickup_driver_id = pu.id
             LEFT JOIN users du ON lo.assigned_delivery_driver_id = du.id
             LEFT JOIN users wu ON lo.approved_by = wu.id
             WHERE lo.created_at BETWEEN ? AND ?
             ORDER BY lo.created_at DESC`,
            [startBound, endBound]
        );

        // Payments in period
        const [paymentsInPeriod] = await db.query(
            `SELECT p.*, lo.order_number, lo.customer_id
             FROM payments p
             JOIN laundry_orders lo ON p.order_id = lo.id
             WHERE p.created_at BETWEEN ? AND ?`,
            [startBound, endBound]
        );

        // Active users counts
        const [userCounts] = await db.query(
            `SELECT 
                SUM(CASE WHEN role = 'customer' AND is_active = 1 THEN 1 ELSE 0 END) as activeCustomers,
                SUM(CASE WHEN role = 'driver' AND approval_status = 'approved' AND is_active = 1 THEN 1 ELSE 0 END) as activeDrivers,
                SUM(CASE WHEN role IN ('worker', 'admin') AND is_active = 1 THEN 1 ELSE 0 END) as activeWorkers,
                SUM(CASE WHEN role = 'customer' AND created_at BETWEEN ? AND ? THEN 1 ELSE 0 END) as newRegistrations
             FROM users`,
            [startBound, endBound]
        );

        const activeCustomers = Number(userCounts[0]?.activeCustomers || 0);
        const activeDrivers = Number(userCounts[0]?.activeDrivers || 0);
        const activeWorkers = Number(userCounts[0]?.activeWorkers || 0);
        const newRegistrations = Number(userCounts[0]?.newRegistrations || 0);

        // Calculate summary indicators
        let totalRequests = ordersInPeriod.length;
        let totalApproved = 0;
        let totalCompleted = 0;
        let pendingRequests = 0;
        let cancelledRequests = 0;
        let awaitingConfirmation = 0;
        let awaitingDriverAssignment = 0;
        let currentlyProcessing = 0;
        let awaitingDelivery = 0;

        let totalWeightProcessedKg = 0;
        let totalCompletedWeightKg = 0;
        let totalLoadsCount = 0;
        let multiLoadOrdersCount = 0;
        let missingWeightOrdersCount = 0;

        let grossSales = 0;
        let totalRevenue = 0; // Recognized revenue from completed orders

        // Map for daily sales trend
        const dailyTrendMap = {};

        // Map for services breakdown
        const serviceBreakdownMap = {};

        ordersInPeriod.forEach(order => {
            const status = order.status;
            const finalPrice = parseFloat(String(order.final_amount !== null && order.final_amount !== undefined ? order.final_amount : order.total_amount || 0));
            const estPrice = parseFloat(String(order.estimated_amount || order.total_amount || 0));
            const actualKg = parseFloat(String(order.actual_weight || 0));
            const estKg = parseFloat(String(order.estimated_weight || 0));
            const loads = parseInt(String(order.load_count || 1), 10);
            const service = order.service_name || order.service_type || 'Wash & Fold';

            // Status buckets
            if (status === 'Pending Approval' || status === 'Pending Request') {
                pendingRequests++;
            } else if (status === 'Cancelled' || status === 'Customer Rejected Weight Proposal') {
                cancelledRequests++;
            } else {
                totalApproved++;
            }

            if (status === 'Completed' || status === 'Delivered') {
                totalCompleted++;
                totalRevenue += finalPrice;
                if (actualKg > 0) totalCompletedWeightKg += actualKg;
            }

            if (status === 'Awaiting Customer Approval') {
                awaitingConfirmation++;
            }

            if (status === 'Approved' || status === 'Awaiting Pickup Assignment' || (status === 'Ready for Delivery' && !order.assigned_delivery_driver_id)) {
                awaitingDriverAssignment++;
            }

            if (status === 'Processing' || status === 'Washing' || status === 'Drying' || status === 'Folding' || status === 'Quality Check') {
                currentlyProcessing++;
            }

            if (status === 'Ready for Delivery' || status === 'Ready') {
                awaitingDelivery++;
            }

            // Weight and loads
            if (actualKg > 0) {
                totalWeightProcessedKg += actualKg;
                totalLoadsCount += loads;
                if (loads > 1) multiLoadOrdersCount++;
            } else if (status !== 'Pending Approval' && status !== 'Pending Request' && status !== 'Cancelled') {
                missingWeightOrdersCount++;
            }

            // Gross sales (non-cancelled orders)
            if (status !== 'Cancelled' && status !== 'Customer Rejected Weight Proposal') {
                grossSales += finalPrice > 0 ? finalPrice : estPrice;
            }

            // Service Breakdown
            if (!serviceBreakdownMap[service]) {
                serviceBreakdownMap[service] = {
                    service,
                    orderCount: 0,
                    completedCount: 0,
                    totalRevenue: 0,
                    totalKg: 0,
                    loads: 0
                };
            }
            serviceBreakdownMap[service].orderCount++;
            if (status === 'Completed' || status === 'Delivered') {
                serviceBreakdownMap[service].completedCount++;
                serviceBreakdownMap[service].totalRevenue += finalPrice;
            }
            serviceBreakdownMap[service].totalKg += actualKg > 0 ? actualKg : estKg;
            serviceBreakdownMap[service].loads += loads;

            // Daily Trend (by order date YYYY-MM-DD)
            const dayKey = formatDate(new Date(order.created_at));
            if (!dailyTrendMap[dayKey]) {
                dailyTrendMap[dayKey] = {
                    date: dayKey,
                    orderCount: 0,
                    completedCount: 0,
                    sales: 0,
                    weightKg: 0
                };
            }
            dailyTrendMap[dayKey].orderCount++;
            if (status === 'Completed' || status === 'Delivered') {
                dailyTrendMap[dayKey].completedCount++;
                dailyTrendMap[dayKey].sales += finalPrice;
            }
            dailyTrendMap[dayKey].weightKg += actualKg > 0 ? actualKg : estKg;
        });

        // Recorded payments received
        let totalPaymentsReceived = 0;
        let gcashPaymentsReceived = 0;
        let codPaymentsReceived = 0;

        paymentsInPeriod.forEach(pm => {
            const amt = parseFloat(String(pm.amount || 0));
            const pStatus = (pm.payment_status || '').toLowerCase();
            if (pStatus === 'paid' || pStatus === 'paid (demo)') {
                totalPaymentsReceived += amt;
                if ((pm.payment_method || '').toUpperCase().includes('GCASH')) {
                    gcashPaymentsReceived += amt;
                } else {
                    codPaymentsReceived += amt;
                }
            }
        });

        // Outstanding customer balances: Gross sales minus total recorded payments (capped at >= 0)
        const outstandingBalances = Math.max(0, grossSales - totalPaymentsReceived);

        // Averages
        const avgOrderValue = totalCompleted > 0 ? (totalRevenue / totalCompleted) : 0;
        const avgWeightPerCompletedOrder = totalCompleted > 0 ? (totalCompletedWeightKg / totalCompleted) : 0;
        const avgWeightPerLoad = totalLoadsCount > 0 ? (totalWeightProcessedKg / totalLoadsCount) : 0;
        const orderCompletionRate = totalRequests > 0 ? ((totalCompleted / totalRequests) * 100) : 0;

        // Turnaround / Processing Times (average minutes)
        let totalApprovalTimeMin = 0;
        let approvalCount = 0;
        let totalPickupTimeMin = 0;
        let pickupCount = 0;
        let totalCompletionTimeMin = 0;
        let completionCount = 0;

        ordersInPeriod.forEach(o => {
            if (o.approved_at && o.created_at) {
                const diff = (new Date(o.approved_at).getTime() - new Date(o.created_at).getTime()) / (1000 * 60);
                if (diff >= 0) {
                    totalApprovalTimeMin += diff;
                    approvalCount++;
                }
            }
            if (o.pickup_confirmed_at && o.approved_at) {
                const diff = (new Date(o.pickup_confirmed_at).getTime() - new Date(o.approved_at).getTime()) / (1000 * 60);
                if (diff >= 0) {
                    totalPickupTimeMin += diff;
                    pickupCount++;
                }
            }
            if (o.delivery_confirmed_at && o.pickup_confirmed_at) {
                const diff = (new Date(o.delivery_confirmed_at).getTime() - new Date(o.pickup_confirmed_at).getTime()) / (1000 * 60);
                if (diff >= 0) {
                    totalCompletionTimeMin += diff;
                    completionCount++;
                }
            }
        });

        const avgTimeToApprovalMinutes = approvalCount > 0 ? Math.round(totalApprovalTimeMin / approvalCount) : 0;
        const avgTimeToPickupMinutes = pickupCount > 0 ? Math.round(totalPickupTimeMin / pickupCount) : 0;
        const avgTimeToCompletionMinutes = completionCount > 0 ? Math.round(totalCompletionTimeMin / completionCount) : 0;

        // Format Daily Trend sorted by date
        const salesByDay = Object.values(dailyTrendMap).sort((a, b) => a.date.localeCompare(b.date));

        // Format Services Breakdown
        const salesByService = Object.values(serviceBreakdownMap);

        // Customer & Driver Performance
        const customerOrderCounts = {};
        ordersInPeriod.forEach(o => {
            customerOrderCounts[o.customer_id] = (customerOrderCounts[o.customer_id] || 0) + 1;
        });
        const customersPlacedOrders = Object.keys(customerOrderCounts).length;
        const repeatCustomers = Object.values(customerOrderCounts).filter(c => c > 1).length;

        // Worker workload breakdown
        const workerWorkload = {};
        ordersInPeriod.forEach(o => {
            if (o.approved_by && o.worker_name) {
                workerWorkload[o.worker_name] = (workerWorkload[o.worker_name] || 0) + 1;
            }
        });

        // Driver performance breakdown
        const driverPerformance = {};
        ordersInPeriod.forEach(o => {
            if (o.pickup_driver_name) {
                if (!driverPerformance[o.pickup_driver_name]) {
                    driverPerformance[o.pickup_driver_name] = { name: o.pickup_driver_name, assignedPickups: 0, completedPickups: 0, assignedDeliveries: 0, completedDeliveries: 0 };
                }
                driverPerformance[o.pickup_driver_name].assignedPickups++;
                if (o.pickup_confirmed_at) driverPerformance[o.pickup_driver_name].completedPickups++;
            }
            if (o.delivery_driver_name) {
                if (!driverPerformance[o.delivery_driver_name]) {
                    driverPerformance[o.delivery_driver_name] = { name: o.delivery_driver_name, assignedPickups: 0, completedPickups: 0, assignedDeliveries: 0, completedDeliveries: 0 };
                }
                driverPerformance[o.delivery_driver_name].assignedDeliveries++;
                if (o.delivery_confirmed_at) driverPerformance[o.delivery_driver_name].completedDeliveries++;
            }
        });

        // Detailed transaction rows for table
        const transactions = ordersInPeriod.map(o => ({
            id: o.id,
            order_number: o.order_number,
            created_at: o.created_at,
            customer_name: o.customer_name,
            customer_phone: o.customer_phone,
            service_name: o.service_name || o.service_type,
            estimated_weight: o.estimated_weight,
            actual_weight: o.actual_weight,
            load_count: o.load_count || 1,
            estimated_amount: parseFloat(String(o.estimated_amount || o.total_amount || 0)),
            final_amount: o.final_amount !== null && o.final_amount !== undefined ? parseFloat(String(o.final_amount)) : null,
            total_amount: parseFloat(String(o.total_amount || 0)),
            payment_method: o.payment_method || 'COD',
            payment_status: o.payment_status || 'Pending',
            status: o.status,
            processing_stage: o.processing_stage,
            pickup_address_text: o.pickup_address_text,
            delivery_address_text: o.delivery_address_text,
            assigned_driver: o.delivery_driver_name || o.pickup_driver_name || null
        }));

        res.json({
            period,
            startDate: startBound.split(' ')[0],
            endDate: endBound.split(' ')[0],
            generatedAt: new Date().toISOString(),
            businessSummary: {
                totalRequests,
                totalApproved,
                totalCompleted,
                pendingRequests,
                cancelledRequests,
                totalWeightProcessedKg: Math.round(totalWeightProcessedKg * 100) / 100,
                totalRevenue: Math.round(totalRevenue * 100) / 100,
                totalPaymentsReceived: Math.round(totalPaymentsReceived * 100) / 100,
                outstandingBalances: Math.round(outstandingBalances * 100) / 100,
                activeCustomers,
                activeDrivers,
                activeWorkers,
                avgOrderValue: Math.round(avgOrderValue * 100) / 100,
                avgWeightPerCompletedOrder: Math.round(avgWeightPerCompletedOrder * 100) / 100
            },
            salesRevenue: {
                grossSales: Math.round(grossSales * 100) / 100,
                discountsRefunds: 0.00,
                netSales: Math.round(totalRevenue * 100) / 100,
                paymentsReceived: Math.round(totalPaymentsReceived * 100) / 100,
                gcashPaymentsReceived: Math.round(gcashPaymentsReceived * 100) / 100,
                codPaymentsReceived: Math.round(codPaymentsReceived * 100) / 100,
                unpaidBalances: Math.round(outstandingBalances * 100) / 100,
                salesByDay,
                salesByService
            },
            orderPerformance: {
                received: totalRequests,
                approved: totalApproved,
                completed: totalCompleted,
                cancelled: cancelledRequests,
                pending: pendingRequests,
                awaitingCustomerConfirmation: awaitingConfirmation,
                awaitingDriverAssignment,
                currentlyProcessing,
                awaitingDelivery,
                completionRate: Math.round(orderCompletionRate * 10) / 10,
                avgTimeToApprovalMinutes,
                avgTimeToPickupMinutes,
                avgTimeToCompletionMinutes
            },
            laundryOperations: {
                totalKgProcessed: Math.round(totalWeightProcessedKg * 100) / 100,
                totalLoadsProcessed: totalLoadsCount,
                avgWeightPerLoad: Math.round(avgWeightPerLoad * 100) / 100,
                multiLoadOrdersCount,
                missingWeightOrdersCount,
                salesByService
            },
            customerDriverPerformance: {
                newCustomerRegistrations: newRegistrations,
                customersPlacedOrders,
                repeatCustomers,
                workerWorkload: Object.entries(workerWorkload).map(([worker, count]) => ({ worker, count })),
                driverPerformance: Object.values(driverPerformance)
            },
            transactions
        });
    } catch (error) {
        console.error('Error generating business report:', error);
        res.status(500).json({ message: 'Error generating business report', error: error.message });
    }
};

module.exports = {
    getBusinessReport
};
