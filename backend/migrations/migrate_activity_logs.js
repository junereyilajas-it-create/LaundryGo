const db = require('../config/db');

async function migrateActivityLogs() {
    console.log('--- Migrating Activity Logs and Location Schema ---');
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        // 1. Create activity_logs table
        console.log('Creating activity_logs table if not exists...');
        await conn.query(`
            CREATE TABLE IF NOT EXISTS activity_logs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                actor_id INT NULL,
                actor_name VARCHAR(255) NOT NULL,
                actor_role VARCHAR(50) NOT NULL,
                action_type VARCHAR(100) NOT NULL,
                description TEXT NOT NULL,
                entity_type VARCHAR(50) NULL,
                entity_id VARCHAR(100) NULL,
                outcome ENUM('success', 'failure') NOT NULL DEFAULT 'success',
                metadata JSON NULL,
                ip_address VARCHAR(100) NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_actor_id (actor_id),
                INDEX idx_actor_role (actor_role),
                INDEX idx_action_type (action_type),
                INDEX idx_outcome (outcome),
                INDEX idx_created_at (created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        // 2. Check and add default_address or coordinates to users table if missing
        const [userCols] = await conn.query("SHOW COLUMNS FROM users");
        const userColNames = userCols.map(c => c.Field);

        if (!userColNames.includes('latitude')) {
            console.log('Adding latitude to users...');
            await conn.query('ALTER TABLE users ADD COLUMN latitude DECIMAL(10, 8) NULL');
        }
        if (!userColNames.includes('longitude')) {
            console.log('Adding longitude to users...');
            await conn.query('ALTER TABLE users ADD COLUMN longitude DECIMAL(11, 8) NULL');
        }
        if (!userColNames.includes('default_address')) {
            console.log('Adding default_address to users...');
            await conn.query('ALTER TABLE users ADD COLUMN default_address TEXT NULL');
        }

        // 3. Ensure laundry_orders has all multi-load columns
        const [orderCols] = await conn.query("SHOW COLUMNS FROM laundry_orders");
        const orderColNames = orderCols.map(c => c.Field);

        const addCol = async (name, def) => {
            if (!orderColNames.includes(name)) {
                console.log(`Adding ${name} to laundry_orders...`);
                await conn.query(`ALTER TABLE laundry_orders ADD COLUMN ${name} ${def}`);
            }
        };

        await addCol('load_count', 'INT DEFAULT 1');
        await addCol('load_details', 'JSON DEFAULT NULL');
        await addCol('pricing_version', "VARCHAR(20) DEFAULT 'v1.0'");
        await addCol('estimated_amount', 'DECIMAL(10, 2) DEFAULT NULL');
        await addCol('pickup_latitude', 'DECIMAL(10, 8) DEFAULT NULL');
        await addCol('pickup_longitude', 'DECIMAL(11, 8) DEFAULT NULL');
        await addCol('delivery_latitude', 'DECIMAL(10, 8) DEFAULT NULL');
        await addCol('delivery_longitude', 'DECIMAL(11, 8) DEFAULT NULL');

        await conn.commit();
        console.log('✓ Activity logs and schema migration completed successfully.');
        return true;
    } catch (err) {
        await conn.rollback();
        console.error('Migration error:', err);
        throw err;
    } finally {
        conn.release();
    }
}

if (require.main === module) {
    migrateActivityLogs()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
}

module.exports = migrateActivityLogs;
