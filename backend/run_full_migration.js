const db = require('./config/db');

async function migrate() {
    console.log('--- Starting LaundriGo Schema Migration ---');
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        // 1. Update laundry_orders table status, payment_method, payment_status to VARCHAR
        console.log('1. Altering laundry_orders column types...');
        await conn.query(`
            ALTER TABLE laundry_orders 
            MODIFY COLUMN status VARCHAR(100) NOT NULL DEFAULT 'Pending Approval',
            MODIFY COLUMN payment_method VARCHAR(50) NOT NULL DEFAULT 'COD',
            MODIFY COLUMN payment_status VARCHAR(50) NOT NULL DEFAULT 'Pending'
        `);

        // Add additional workflow columns to laundry_orders if not present
        const [orderCols] = await conn.query("SHOW COLUMNS FROM laundry_orders");
        const orderColNames = orderCols.map(c => c.Field);

        const addColIfNotExists = async (colName, colDef) => {
            if (!orderColNames.includes(colName)) {
                console.log(`Adding column ${colName} to laundry_orders...`);
                await conn.query(`ALTER TABLE laundry_orders ADD COLUMN ${colName} ${colDef}`);
            }
        };

        await addColIfNotExists('actual_weight', 'DECIMAL(5,2) DEFAULT NULL');
        await addColIfNotExists('load_count', 'INT DEFAULT 1');
        await addColIfNotExists('load_details', 'JSON DEFAULT NULL');
        await addColIfNotExists('pricing_version', "VARCHAR(20) DEFAULT 'v1.0'");
        await addColIfNotExists('weight_approved_by_customer', 'TINYINT(1) DEFAULT NULL');
        await addColIfNotExists('weight_approved_at', 'DATETIME DEFAULT NULL');
        await addColIfNotExists('weight_recorded_by', 'INT DEFAULT NULL');
        await addColIfNotExists('weight_recorded_at', 'DATETIME DEFAULT NULL');
        await addColIfNotExists('rejection_reason', 'TEXT DEFAULT NULL');
        await addColIfNotExists('processing_stage', 'VARCHAR(50) DEFAULT NULL');
        await addColIfNotExists('assigned_pickup_driver_id', 'INT DEFAULT NULL');
        await addColIfNotExists('assigned_delivery_driver_id', 'INT DEFAULT NULL');

        // 2. Alter users table for is_active and created_by
        console.log('2. Altering users table...');
        const [userCols] = await conn.query("SHOW COLUMNS FROM users");
        const userColNames = userCols.map(c => c.Field);

        if (!userColNames.includes('is_active')) {
            console.log('Adding is_active to users...');
            await conn.query('ALTER TABLE users ADD COLUMN is_active TINYINT(1) DEFAULT 1');
        }
        if (!userColNames.includes('created_by')) {
            console.log('Adding created_by to users...');
            await conn.query('ALTER TABLE users ADD COLUMN created_by INT DEFAULT NULL');
        }

        // 3. Alter payments table
        console.log('3. Altering payments table...');
        await conn.query(`
            ALTER TABLE payments 
            MODIFY COLUMN payment_method VARCHAR(50) NOT NULL,
            MODIFY COLUMN payment_status VARCHAR(50) NOT NULL DEFAULT 'unpaid'
        `);

        const [paymentCols] = await conn.query("SHOW COLUMNS FROM payments");
        const paymentColNames = paymentCols.map(c => c.Field);
        if (!paymentColNames.includes('is_demo')) {
            console.log('Adding is_demo to payments...');
            await conn.query('ALTER TABLE payments ADD COLUMN is_demo TINYINT(1) DEFAULT 0');
        }

        // 4. Create gcash_demo_pins table
        console.log('4. Creating gcash_demo_pins table...');
        await conn.query(`
            CREATE TABLE IF NOT EXISTS gcash_demo_pins (
                id INT AUTO_INCREMENT PRIMARY KEY,
                phone VARCHAR(50) NOT NULL,
                pin VARCHAR(10) NOT NULL,
                expires_at DATETIME NOT NULL,
                attempts INT DEFAULT 0,
                used TINYINT(1) DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_phone (phone),
                INDEX idx_expires (expires_at)
            )
        `);

        // 5. Update existing 'Pending Request' to 'Pending Approval' for uniformity
        await conn.query(`UPDATE laundry_orders SET status = 'Pending Approval' WHERE status = 'Pending Request'`);

        await conn.commit();
        console.log('✓ Migration completed successfully.');
        process.exit(0);
    } catch (err) {
        await conn.rollback();
        console.error('Migration failed:', err);
        process.exit(1);
    } finally {
        conn.release();
    }
}

migrate();
