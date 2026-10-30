const db = require('../config/db');

async function updateWalkinAndWorkflowSchema() {
    console.log('--- Updating Database Schema for Walk-in Laundry & Workflow ---');
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        // Check columns in laundry_orders
        const [orderCols] = await conn.query("SHOW COLUMNS FROM laundry_orders");
        const orderColNames = orderCols.map(c => c.Field);

        const addOrderCol = async (name, def) => {
            if (!orderColNames.includes(name)) {
                console.log(`Adding ${name} to laundry_orders...`);
                await conn.query(`ALTER TABLE laundry_orders ADD COLUMN ${name} ${def}`);
            } else {
                console.log(`- Column ${name} already exists in laundry_orders.`);
            }
        };

        await addOrderCol('is_walkin', 'TINYINT(1) DEFAULT 0');
        await addOrderCol('registered_by', 'INT NULL');
        await addOrderCol('customer_choice', "VARCHAR(50) DEFAULT NULL");
        await addOrderCol('processing_started_at', 'DATETIME NULL');
        await addOrderCol('ready_at', 'DATETIME NULL');
        await addOrderCol('completed_at', 'DATETIME NULL');
        await addOrderCol('payment_collected_by', 'INT NULL');
        await addOrderCol('payment_collected_at', 'DATETIME NULL');

        // Allow 'walk_in' or ensure service_type allows varchar or customer_dropoff
        try {
            await conn.query("ALTER TABLE laundry_orders MODIFY COLUMN service_type VARCHAR(50) NOT NULL DEFAULT 'customer_dropoff'");
            console.log('✓ Modified service_type to VARCHAR(50)');
        } catch (e) {
            console.log('service_type modify note:', e.message);
        }

        // Check payments table columns
        const [paymentCols] = await conn.query("SHOW COLUMNS FROM payments");
        const paymentColNames = paymentCols.map(c => c.Field);

        if (!paymentColNames.includes('collected_by')) {
            console.log('Adding collected_by to payments...');
            await conn.query('ALTER TABLE payments ADD COLUMN collected_by INT NULL');
        }
        if (!paymentColNames.includes('payment_date')) {
            console.log('Adding payment_date to payments...');
            await conn.query('ALTER TABLE payments ADD COLUMN payment_date DATETIME DEFAULT CURRENT_TIMESTAMP');
        }

        await conn.commit();
        console.log('✓ Walk-in & workflow database schema migration complete!');
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
    updateWalkinAndWorkflowSchema()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
}

module.exports = updateWalkinAndWorkflowSchema;
