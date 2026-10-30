const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

router.get('/stats', authenticateToken, authorizeRole('admin', 'worker'), async (req, res) => {
    try {
        const [[{ totalCustomers }]] = await db.query('SELECT COUNT(*) as totalCustomers FROM users WHERE role = "customer"');
        const [[{ activeDrivers }]] = await db.query('SELECT COUNT(*) as activeDrivers FROM users WHERE role = "driver" AND COALESCE(is_active, 1) = 1');
        const [[{ totalOrders }]] = await db.query('SELECT COUNT(*) as totalOrders FROM laundry_orders');
        
        const [statusCounts] = await db.query('SELECT status, COUNT(*) as count FROM laundry_orders GROUP BY status');
        
        let pending = 0, processing = 0, ready = 0, completed = 0;
        statusCounts.forEach(row => {
            const st = (row.status || '').toLowerCase();
            if (st.includes('pending') || st.includes('awaiting pickup') || st.includes('driver assigned') || st.includes('pickup in progress') || st.includes('laundry received') || st.includes('picked up')) {
                pending += row.count;
            } else if (st.includes('processing') || st.includes('washing') || st.includes('drying') || st.includes('folding') || st.includes('awaiting customer')) {
                processing += row.count;
            } else if (st.includes('ready') || st.includes('delivery assigned') || st.includes('out for delivery')) {
                ready += row.count;
            } else if (st.includes('completed') || st.includes('delivered')) {
                completed += row.count;
            }
        });

        const [[{ revenue }]] = await db.query('SELECT SUM(total_amount) as revenue FROM laundry_orders WHERE status IN ("Completed", "Delivered") OR payment_status IN ("paid", "Paid", "Paid (Demo)")');

        res.json({
            totalCustomers,
            activeDrivers,
            totalOrders,
            pendingOrders: pending,
            processingOrders: processing,
            readyForDelivery: ready,
            completedOrders: completed,
            revenue: parseFloat(revenue || 0)
        });
    } catch (error) {
        console.error('Dashboard stats error:', error);
        res.status(500).json({ message: 'Error fetching dashboard stats', error: error.message });
    }
});

router.get('/activity', authenticateToken, authorizeRole('admin', 'worker'), async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 15;
        const [recentLogs] = await db.query(
            `SELECT id, actor_id, actor_name, actor_role, action_type, description, entity_type, entity_id, outcome, metadata, created_at 
             FROM activity_logs 
             ORDER BY created_at DESC 
             LIMIT ?`,
            [limit]
        );

        if (recentLogs.length > 0) {
            const parsedActivities = recentLogs.map(act => {
                let meta = null;
                if (act.metadata) {
                    try {
                        meta = typeof act.metadata === 'string' ? JSON.parse(act.metadata) : act.metadata;
                    } catch (e) {
                        meta = act.metadata;
                    }
                }
                return {
                    ...act,
                    metadata: meta
                };
            });
            return res.json(parsedActivities);
        }

        // Fallback to legacy laundry_status_history if activity_logs is completely fresh
        const query = `
            SELECT 
                h.id, 
                h.status as action_type, 
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
            LIMIT ?
        `;
        const [fallbackActivities] = await db.query(query, [limit]);
        res.json(fallbackActivities);
    } catch (error) {
        console.error('Dashboard activity error:', error);
        res.status(500).json({ message: 'Error fetching activity', error: error.message });
    }
});

module.exports = router;
