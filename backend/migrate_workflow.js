const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function runWorkflowMigration() {
    console.log('--- LaundriGo Workflow Enhancement Migration ---');
    let connection;
    try {
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            port: parseInt(process.env.DB_PORT || '3306'),
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'laundrigo_db'
        });
        console.log('✓ Connected to database.');

        async function columnExists(tableName, columnName) {
            const [rows] = await connection.query(
                `SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.COLUMNS 
                 WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
                [process.env.DB_NAME || 'laundrigo_db', tableName, columnName]
            );
            return rows[0].count > 0;
        }

        async function addColumnIfMissing(tableName, columnName, columnDef) {
            const exists = await columnExists(tableName, columnName);
            if (!exists) {
                await connection.query(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDef}`);
                console.log(`✓ Added column ${columnName} to ${tableName}`);
            } else {
                console.log(`- Column ${columnName} already exists on ${tableName}`);
            }
        }

        // Add coordinates and workflow audit columns to laundry_orders
        await addColumnIfMissing('laundry_orders', 'pickup_latitude', 'DECIMAL(10,8) DEFAULT NULL');
        await addColumnIfMissing('laundry_orders', 'pickup_longitude', 'DECIMAL(11,8) DEFAULT NULL');
        await addColumnIfMissing('laundry_orders', 'delivery_latitude', 'DECIMAL(10,8) DEFAULT NULL');
        await addColumnIfMissing('laundry_orders', 'delivery_longitude', 'DECIMAL(11,8) DEFAULT NULL');
        await addColumnIfMissing('laundry_orders', 'estimated_amount', 'DECIMAL(10,2) DEFAULT 0.00');
        await addColumnIfMissing('laundry_orders', 'final_amount', 'DECIMAL(10,2) DEFAULT NULL');
        await addColumnIfMissing('laundry_orders', 'approved_by', 'INT DEFAULT NULL');
        await addColumnIfMissing('laundry_orders', 'approved_at', 'DATETIME DEFAULT NULL');
        await addColumnIfMissing('laundry_orders', 'pickup_confirmed_by', 'INT DEFAULT NULL');
        await addColumnIfMissing('laundry_orders', 'pickup_confirmed_at', 'DATETIME DEFAULT NULL');
        await addColumnIfMissing('laundry_orders', 'delivery_confirmed_by', 'INT DEFAULT NULL');
        await addColumnIfMissing('laundry_orders', 'delivery_confirmed_at', 'DATETIME DEFAULT NULL');

        // Add coordinates to pickup_requests and delivery_requests
        await addColumnIfMissing('pickup_requests', 'pickup_latitude', 'DECIMAL(10,8) DEFAULT NULL');
        await addColumnIfMissing('pickup_requests', 'pickup_longitude', 'DECIMAL(11,8) DEFAULT NULL');
        await addColumnIfMissing('delivery_requests', 'delivery_latitude', 'DECIMAL(10,8) DEFAULT NULL');
        await addColumnIfMissing('delivery_requests', 'delivery_longitude', 'DECIMAL(11,8) DEFAULT NULL');

        // Backfill existing orders with default Poblacion, Lagonglong coordinates if null
        await connection.query(`
            UPDATE laundry_orders 
            SET estimated_amount = total_amount 
            WHERE estimated_amount = 0.00 OR estimated_amount IS NULL
        `);

        await connection.query(`
            UPDATE laundry_orders 
            SET pickup_latitude = 8.8105, pickup_longitude = 124.7925 
            WHERE pickup_latitude IS NULL
        `);

        await connection.query(`
            UPDATE laundry_orders 
            SET delivery_latitude = 8.8105, delivery_longitude = 124.7925 
            WHERE delivery_latitude IS NULL
        `);

        await connection.query(`
            UPDATE pickup_requests 
            SET pickup_latitude = 8.8105, pickup_longitude = 124.7925 
            WHERE pickup_latitude IS NULL
        `);

        await connection.query(`
            UPDATE delivery_requests 
            SET delivery_latitude = 8.8105, delivery_longitude = 124.7925 
            WHERE delivery_latitude IS NULL
        `);

        console.log('✓ Workflow migration completed successfully.');
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    } finally {
        if (connection) await connection.end();
    }
}

runWorkflowMigration();
