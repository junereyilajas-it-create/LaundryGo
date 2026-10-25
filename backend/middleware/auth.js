const jwt = require('jsonwebtoken');
const db = require('../config/db');

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    // Format: Bearer TOKEN
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ message: 'Access denied. No token provided.' });

    jwt.verify(token, process.env.JWT_SECRET || 'laundrigo_super_secret_jwt_key_2026', (err, user) => {
        if (err) return res.status(403).json({ message: 'Invalid token.' });
        req.user = user;
        next();
    });
};

const authorizeRole = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user || !allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ message: 'Access denied. Insufficient permissions.' });
        }
        next();
    };
};

/**
 * Validates that driver accounts are explicitly approved and active
 * before allowing access to driver operations (pickups, deliveries, GPS tracking)
 */
const authorizeApprovedDriver = async (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ message: 'Access denied. Authentication required.' });
    }

    if (req.user.role === 'driver') {
        try {
            const [rows] = await db.query(
                'SELECT is_active, approval_status FROM users WHERE id = ?',
                [req.user.id]
            );

            if (rows.length === 0 || rows[0].approval_status !== 'approved' || rows[0].is_active !== 1) {
                return res.status(403).json({ 
                    message: 'Access denied: Driver account is awaiting administrator approval or is currently inactive.',
                    approval_status: rows.length > 0 ? rows[0].approval_status : 'unknown'
                });
            }
        } catch (err) {
            return res.status(500).json({ message: 'Error verifying driver status', error: err.message });
        }
    }
    next();
};

module.exports = { authenticateToken, authorizeRole, authorizeApprovedDriver };
