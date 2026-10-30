const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const db = require('./config/db');

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files for uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/addresses', require('./routes/addressRoutes'));
app.use('/api/drivers', require('./routes/driverRoutes'));
app.use('/api/services', require('./routes/serviceRoutes'));
app.use('/api/orders', require('./routes/orderRoutes'));
app.use('/api/payments', require('./routes/paymentRoutes'));
app.use('/api/logistics', require('./routes/logisticsRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));
app.use('/api/dashboard', require('./routes/dashboardRoutes'));
app.use('/api/messages', require('./routes/messageRoutes'));
app.use('/api/reports', require('./routes/reportRoutes'));
app.use('/api/activities', require('./routes/activityRoutes'));

// Basic health check route
app.get('/api/health', async (req, res) => {
    try {
        await db.query('SELECT 1');
        res.json({
            status: 'ok',
            database: 'connected',
            databaseName: process.env.DB_NAME || 'laundrigo_db',
            service_area: 'Poblacion, Lagonglong, Misamis Oriental, Philippines'
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            database: 'disconnected',
            message: error.message
        });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: 'Something went wrong!', error: err.message });
});

// Auto-run schema checks on server launch
async function ensureDatabaseSchema() {
    try {
        const [tableCheck] = await db.query(
            "SELECT table_name FROM information_schema.tables WHERE table_schema = ? AND table_name = 'password_resets'",
            [process.env.DB_NAME || 'laundrigo_db']
        );

        if (tableCheck.length === 0) {
            console.log('Applying database schema updates...');
            // 1. Password resets table
            await db.query(`
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
        }

        // 2. Order messages table
        await db.query(`
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

        // 3. Services table
        await db.query(`
            CREATE TABLE IF NOT EXISTS services (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                description TEXT,
                price DECIMAL(10,2) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);

        // 4. Seed initial services if empty
        const [servicesCount] = await db.query('SELECT COUNT(*) as count FROM services');
        if (servicesCount[0].count === 0) {
            const initialServices = [
                ['Wash & Fold', 'Regular washing, tumble drying, and neat folding for everyday laundry.', 35.00],
                ['Wash & Iron / Press', 'Washed, dried, and professionally steam ironed on hangers or neatly folded.', 50.00],
                ['Dry Cleaning', 'Delicate dry cleaning treatment for suits, barongs, gowns, and coats.', 120.00],
                ['Comforter & Heavy Blanket', 'Deep hygiene cleaning for heavy duvets, comforters, and quilts.', 150.00],
                ['Shoe & Bag Refresh', 'Specialized gentle scrubbing and stain removal for sneakers and canvas bags.', 90.00]
            ];
            for (const s of initialServices) {
                await db.query('INSERT INTO services (name, description, price) VALUES (?, ?, ?)', s);
            }
        }

        // 5. Verify single admin and driver approval schema
        const seedAdminAndApprovalSchema = require('./seed_admin');
        await seedAdminAndApprovalSchema();

        // 6. Ensure activity logs and location columns
        const migrateActivityLogs = require('./migrations/migrate_activity_logs');
        await migrateActivityLogs();

        // 7. Ensure walk-in and workflow enhancement schema
        const updateWalkinAndWorkflowSchema = require('./migrations/update_walkin_and_workflow');
        await updateWalkinAndWorkflowSchema();

        console.log('✓ Database schema verified and synchronized.');
    } catch (err) {
        console.warn('Notice: Non-critical schema synchronization warning:', err.message);
    }
}

const PORT = process.env.PORT || 5000;
app.listen(PORT, async () => {
    console.log('\n================================');
    console.log('LaundriGo Backend API');
    console.log('Serving Poblacion, Lagonglong, Misamis Oriental');
    console.log('================================');
    console.log(`Server running on port ${PORT}`);
    
    try {
        const connection = await db.getConnection();
        console.log('MySQL connected successfully');
        console.log(`Database: ${process.env.DB_NAME || 'laundrigo_db'}`);
        console.log('================================\n');
        connection.release();
        await ensureDatabaseSchema();
    } catch (error) {
        console.error('\nMySQL connection failed.\n');
        console.error('Check:');
        console.error('1. Laragon / MySQL is running');
        console.error(`2. Database ${process.env.DB_NAME || 'laundrigo_db'} exists`);
        console.error('3. Credentials in backend/.env are correct');
        console.log('================================\n');
    }
});
