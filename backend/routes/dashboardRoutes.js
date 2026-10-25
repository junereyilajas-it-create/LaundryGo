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

router.get('/activity', authenticateToken, authorizeRole('admin', 'worker'), async (req, res) => {
    try {
        const [recentLogs] = await db.query(
            `SELECT id, actor_id, actor_name, actor_role, action_type, description, entity_type, entity_id, outcome, metadata, created_at 
             FROM activity_logs 
             ORDER BY created_at DESC 
             LIMIT 8`
        );

        if (recentLogs.length > 0) {
            return res.json(recentLogs);
        }

        // Fallback to legacy laundry_status_history if activity_logs is completely fresh
        const query = `
            SELECT 
                h.id, 
                h.status, 
                h.notes as description, 
                h.created_at,
                o.order_number,
                u.name as actor_name,
                u.role as actor_role,
                'order' as entity_type,
                o.order_number as entity_id,
                'success' as outcome
            FROM laundry_status_history h
            LEFT JOIN laundry_orders o ON h.order_id = o.id
            LEFT JOIN users u ON h.changed_by = u.id
            ORDER BY h.created_at DESC
            LIMIT 5
        `;
        const [fallbackActivities] = await db.query(query);
        res.json(fallbackActivities);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching activity', error: error.message });
    }
});

module.exports = router;
