const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function runMigration() {
    console.log('Connecting to MySQL database...');
    let connection;
    try {
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            port: parseInt(process.env.DB_PORT || '3306'),
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'laundrigo_db',
            multipleStatements: true
        });
        console.log('Connected to MySQL successfully.');

        // 1. Password resets table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS password_resets (
                id INT AUTO_INCREMENT PRIMARY KEY,
                email VARCHAR(255) NOT NULL,
                token VARCHAR(255) NOT NULL,
                expires_at DATETIME NOT NULL,
                used TINYINT(1) DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_token (token),
                INDEX idx_email (email)
            )
        `);
        console.log('✓ Checked/Created table: password_resets');

        // 2. Order messages table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS order_messages (
                id INT AUTO_INCREMENT PRIMARY KEY,
                order_id INT NOT NULL,
                sender_id INT NOT NULL,
                message TEXT NOT NULL,
                is_read TINYINT(1) DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (order_id) REFERENCES laundry_orders(id) ON DELETE CASCADE,
                FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
        console.log('✓ Checked/Created table: order_messages');

        // 3. Services table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS services (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                description TEXT,
                price DECIMAL(10,2) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);
        console.log('✓ Checked/Created table: services');

        // Helper to check if a column exists
        async function columnExists(tableName, columnName) {
            const [rows] = await connection.query(
                `SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.COLUMNS 
                 WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
                [process.env.DB_NAME || 'laundrigo_db', tableName, columnName]
            );
            return rows[0].count > 0;
        }

        // Helper to add column if missing
        async function addColumnIfMissing(tableName, columnName, columnDef) {
            const exists = await columnExists(tableName, columnName);
            if (!exists) {
                await connection.query(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDef}`);
                console.log(`✓ Added column ${columnName} to ${tableName}`);
            } else {
                console.log(`- Column ${columnName} already exists on ${tableName}`);
            }
        }

        // 4. Update laundry_orders columns
        await addColumnIfMissing('laundry_orders', 'total_amount', 'DECIMAL(10,2) DEFAULT 0.00');
        await addColumnIfMissing('laundry_orders', 'service_name', 'VARCHAR(150) NULL');
        await addColumnIfMissing('laundry_orders', 'pickup_address_text', 'TEXT NULL');
        await addColumnIfMissing('laundry_orders', 'delivery_address_text', 'TEXT NULL');
        await addColumnIfMissing('laundry_orders', 'payment_method', "ENUM('cash', 'gcash', 'bank_transfer') NOT NULL DEFAULT 'cash'");

        // 5. Update pickup_requests columns
        await addColumnIfMissing('pickup_requests', 'actual_time', 'DATETIME NULL');
        await addColumnIfMissing('pickup_requests', 'failure_reason', 'TEXT NULL');

        // 6. Update delivery_requests columns
        await addColumnIfMissing('delivery_requests', 'actual_time', 'DATETIME NULL');
        await addColumnIfMissing('delivery_requests', 'failure_reason', 'TEXT NULL');
        await addColumnIfMissing('delivery_requests', 'proof_notes', 'TEXT NULL');

        // 7. Update payments columns
        await addColumnIfMissing('payments', 'reference_number', 'VARCHAR(150) NULL');
        await addColumnIfMissing('payments', 'payment_date', 'DATETIME DEFAULT CURRENT_TIMESTAMP');
        await addColumnIfMissing('payments', 'collected_by', 'INT NULL');
        await addColumnIfMissing('payments', 'gateway_transaction_id', 'VARCHAR(255) NULL');

        // Update payment_method ENUM on payments if needed
        try {
            await connection.query(`
                ALTER TABLE payments 
                MODIFY COLUMN payment_method ENUM('cash','gcash','bank_transfer') NOT NULL
            `);
        } catch (e) {
            console.log('payment_method modify error:', e.message);
        }

        // 8. Insert standard services if empty
        const [servicesCount] = await connection.query('SELECT COUNT(*) as count FROM services');
        if (servicesCount[0].count === 0) {
            const initialServices = [
                ['Wash & Fold', 'Regular washing, tumble drying, and neat folding for everyday laundry.', 35.00],
                ['Wash & Iron / Press', 'Washed, dried, and professionally steam ironed on hangers or neatly folded.', 50.00],
                ['Dry Cleaning', 'Delicate dry cleaning treatment for suits, barongs, gowns, and coats.', 120.00],
                ['Comforter & Heavy Blanket', 'Deep hygiene cleaning for heavy duvets, comforters, and quilts.', 150.00],
                ['Shoe & Bag Refresh', 'Specialized gentle scrubbing and stain removal for sneakers and canvas bags.', 90.00]
            ];
            for (const s of initialServices) {
                await connection.query('INSERT INTO services (name, description, price) VALUES (?, ?, ?)', s);
            }
            console.log('✓ Seeded standard services into services table.');
        } else {
            console.log(`- Services table already has ${servicesCount[0].count} entries.`);
        }

        console.log('\n========================================');
        console.log('✓ Database upgrade completed successfully!');
        console.log('========================================\n');
    } catch (error) {
        console.error('Migration error:', error);
    } finally {
        if (connection) await connection.end();
        process.exit(0);
    }
}

runMigration();
