const db = require('../config/db');

async function updateNotificationSchema() {
    console.log('--- Updating Database Schema for Facebook-Style Notifications ---');
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        // 1. Check existing columns in notifications table
        const [cols] = await conn.query('SHOW COLUMNS FROM notifications');
        const colNames = cols.map(c => c.Field);

        const addCol = async (name, def) => {
            if (!colNames.includes(name)) {
                console.log(`Adding column ${name} to notifications...`);
                await conn.query(`ALTER TABLE notifications ADD COLUMN ${name} ${def}`);
            } else {
                console.log(`- Column ${name} already exists in notifications.`);
            }
        };

        // notification_type (e.g. 'order', 'payment', 'delivery', 'account', 'system')
        await addCol('notification_type', "VARCHAR(50) NOT NULL DEFAULT 'order'");
        // related_order_id (nullable, sync with order_id)
        await addCol('related_order_id', 'INT NULL');
        // related_user_id (e.g. worker/driver/customer who triggered it)
        await addCol('related_user_id', 'INT NULL');
        // target_url (direct URL route to open when clicked)
        await addCol('target_url', 'VARCHAR(255) NULL');
        // read_at (timestamp when user read it)
        await addCol('read_at', 'DATETIME NULL');

        // Backfill related_order_id if null
        await conn.query('UPDATE notifications SET related_order_id = order_id WHERE related_order_id IS NULL AND order_id IS NOT NULL');

        // Backfill notification_type based on existing titles/messages
        await conn.query(`
            UPDATE notifications 
            SET notification_type = CASE 
                WHEN title LIKE '%Payment%' OR title LIKE '%GCash%' OR title LIKE '%COD%' THEN 'payment'
                WHEN title LIKE '%Driver%' OR title LIKE '%Delivery%' OR title LIKE '%Pickup%' THEN 'delivery'
                WHEN title LIKE '%Application%' OR title LIKE '%Account%' OR title LIKE '%Password%' THEN 'account'
                WHEN title LIKE '%System%' OR title LIKE '%Alert%' THEN 'system'
                ELSE 'order'
            END
            WHERE notification_type = 'order' OR notification_type IS NULL OR notification_type = 'general'
        `);

        // Check and add indexes safely
        const [indexes] = await conn.query('SHOW INDEX FROM notifications');
        const indexNames = indexes.map(i => i.Key_name);

        if (!indexNames.includes('idx_notif_user_read')) {
            console.log('Adding index idx_notif_user_read...');
            await conn.query('ALTER TABLE notifications ADD INDEX idx_notif_user_read (user_id, is_read, created_at)');
        }

        if (!indexNames.includes('idx_notif_type')) {
            console.log('Adding index idx_notif_type...');
            await conn.query('ALTER TABLE notifications ADD INDEX idx_notif_type (user_id, notification_type)');
        }

        // 2. Create notification_preferences table for Category Preferences (Section 7)
        console.log('Ensuring notification_preferences table...');
        await conn.query(`
            CREATE TABLE IF NOT EXISTS notification_preferences (
                user_id INT PRIMARY KEY,
                laundry_updates TINYINT(1) DEFAULT 1,
                payment_updates TINYINT(1) DEFAULT 1,
                delivery_updates TINYINT(1) DEFAULT 1,
                account_updates TINYINT(1) DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        // Backfill preferences for existing users who don't have a row yet
        await conn.query(`
            INSERT IGNORE INTO notification_preferences (user_id, laundry_updates, payment_updates, delivery_updates, account_updates)
            SELECT id, 1, 1, 1, 1 FROM users
        `);

        await conn.commit();
        console.log('✓ Notification schema and preferences migration completed successfully!');
        return true;
    } catch (err) {
        await conn.rollback();
        console.error('Migration error in updateNotificationSchema:', err);
        throw err;
    } finally {
        conn.release();
    }
}

if (require.main === module) {
    updateNotificationSchema()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
}

module.exports = updateNotificationSchema;
