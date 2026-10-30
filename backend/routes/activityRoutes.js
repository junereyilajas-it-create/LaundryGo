const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

// GET /api/activities - Paginated and filtered activity logs (Admin / Worker)
router.get('/', authenticateToken, authorizeRole('admin', 'worker'), async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 15));
        const offset = (page - 1) * limit;

        const { role, action_type, outcome, startDate, endDate, search } = req.query;

        let conditions = ['1=1'];
        let params = [];

        if (role && role !== 'all') {
            conditions.push('actor_role = ?');
            params.push(role);
        }

        if (action_type && action_type !== 'all') {
            conditions.push('action_type LIKE ?');
            params.push(`%${action_type}%`);
        }

        if (outcome && outcome !== 'all') {
            conditions.push('outcome = ?');
            params.push(outcome);
        }

        if (startDate) {
            conditions.push('created_at >= ?');
            params.push(`${startDate} 00:00:00`);
        }

        if (endDate) {
            conditions.push('created_at <= ?');
            params.push(`${endDate} 23:59:59`);
        }

        if (search && search.trim()) {
            conditions.push('(description LIKE ? OR actor_name LIKE ? OR entity_id LIKE ?)');
            const s = `%${search.trim()}%`;
            params.push(s, s, s);
        }

        const whereSql = conditions.join(' AND ');

        // Total count
        const [[{ total }]] = await db.query(
            `SELECT COUNT(*) as total FROM activity_logs WHERE ${whereSql}`,
            params
        );

        // Fetch logs
        const [activities] = await db.query(
            `SELECT id, actor_id, actor_name, actor_role, action_type, description, entity_type, entity_id, outcome, metadata, created_at 
             FROM activity_logs 
             WHERE ${whereSql} 
             ORDER BY created_at DESC 
             LIMIT ? OFFSET ?`,
            [...params, limit, offset]
        );

        // Parse metadata JSON safely
        const parsedActivities = activities.map(act => {
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

        res.json({
            activities: parsedActivities,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
        });
    } catch (error) {
        console.error('Error fetching activity logs:', error);
        res.status(500).json({ message: 'Error retrieving activity logs', error: error.message });
    }
});

// GET /api/activities/recent - Lightweight recent activities for dashboard widget
router.get('/recent', authenticateToken, authorizeRole('admin', 'worker'), async (req, res) => {
    try {
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 15));
        const [activities] = await db.query(
            `SELECT id, actor_id, actor_name, actor_role, action_type, description, entity_type, entity_id, outcome, metadata, created_at 
             FROM activity_logs 
             ORDER BY created_at DESC 
             LIMIT ?`,
            [limit]
        );

        const parsedActivities = activities.map(act => {
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

        res.json(parsedActivities);
    } catch (error) {
        console.error('Error fetching recent activities:', error);
        res.status(500).json({ message: 'Error retrieving recent activities', error: error.message });
    }
});

module.exports = router;
