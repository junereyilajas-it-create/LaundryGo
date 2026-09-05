const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

router.get('/stats', authenticateToken, authorizeRole('admin', 'worker'), async (req, res) => {
    try {
        const [[{ totalCustomers }]] = await db.query('SELECT COUNT(*) as totalCustomers FROM users WHERE role = "customer"');
        const [[{ activeDrivers }]] = await db.query('SELECT COUNT(*) as activeDrivers FROM users WHERE role = "driver"');
        const [[{ totalOrders }]] = await db.query('SELECT COUNT(*) as totalOrders FROM laundry_orders');
        
        const [statusCounts] = await db.query('SELECT current_status, COUNT(*) as count FROM laundry_orders GROUP BY current_status');
        
        let pending = 0, processing = 0, ready = 0, completed = 0;
        statusCounts.forEach(row => {
            if (row.current_status === 'Pending Request') pending = row.count;
            if (row.current_status === 'Washing' || row.current_status === 'Drying' || row.current_status === 'Folding') processing += row.count;
            if (row.current_status === 'Ready' || row.current_status === 'Ready for Delivery') ready += row.count;
            if (row.current_status === 'Completed') completed = row.count;
        });

        const [[{ revenue }]] = await db.query('SELECT SUM(total_amount) as revenue FROM laundry_orders WHERE current_status = "Completed"');

        res.json({
            totalCustomers,
            activeDrivers,
            totalOrders,
            pendingOrders: pending,
            processingOrders: processing,
            readyForDelivery: ready,
            completedOrders: completed,
            revenue: revenue || 0
        });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching dashboard stats', error: error.message });
    }
});

module.exports = router;
