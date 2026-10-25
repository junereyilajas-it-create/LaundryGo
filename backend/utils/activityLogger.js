const db = require('../config/db');

/**
 * Centralized, secure activity logging utility for LaundriGo.
 * Records authenticated user actions, laundry orders, authentication attempts, driver approvals, etc.
 * 
 * IMPORTANT SECURITY RULES:
 * - Never log passwords, password hashes, JWT tokens, or SMS API credentials.
 * - Authenticated actor info is extracted directly from server-side req.user.
 */

async function logActivity({
    req = null,
    actorId = null,
    actorName = null,
    actorRole = null,
    actionType,
    description,
    entityType = null,
    entityId = null,
    outcome = 'success',
    metadata = null
}) {
    try {
        if (!actionType || !description) {
            console.warn('[ActivityLogger] Warning: actionType and description are required.');
            return;
        }

        // Determine authenticated actor from request if available
        let finalActorId = actorId;
        let finalActorName = actorName;
        let finalActorRole = actorRole;
        let ipAddress = null;

        if (req) {
            if (req.user) {
                finalActorId = finalActorId !== null ? finalActorId : req.user.id;
                finalActorName = finalActorName || req.user.name || 'User #' + req.user.id;
                finalActorRole = finalActorRole || req.user.role || 'customer';
            }
            ipAddress = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || req.ip || null;
            if (typeof ipAddress === 'string' && ipAddress.includes(',')) {
                ipAddress = ipAddress.split(',')[0].trim();
            }
        }

        finalActorName = finalActorName || 'System';
        finalActorRole = finalActorRole || 'system';

        // Sanitize metadata to protect secrets
        let safeMetadata = null;
        if (metadata && typeof metadata === 'object') {
            const clone = JSON.parse(JSON.stringify(metadata));
            delete clone.password;
            delete clone.pin;
            delete clone.token;
            delete clone.secret;
            delete clone.apiKey;
            delete clone.apikey;
            delete clone.authorization;
            safeMetadata = JSON.stringify(clone);
        } else if (typeof metadata === 'string') {
            safeMetadata = metadata;
        }

        await db.query(
            `INSERT INTO activity_logs 
             (actor_id, actor_name, actor_role, action_type, description, entity_type, entity_id, outcome, metadata, ip_address) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                finalActorId || null,
                finalActorName,
                finalActorRole,
                actionType,
                description,
                entityType || null,
                entityId !== null && entityId !== undefined ? String(entityId) : null,
                outcome === 'failure' ? 'failure' : 'success',
                safeMetadata,
                ipAddress
            ]
        );
    } catch (err) {
        // Fail-safe: Activity logging must never break the main operation
        console.error('[ActivityLogger] Failed to write audit log entry:', err.message);
    }
}

module.exports = {
    logActivity
};
