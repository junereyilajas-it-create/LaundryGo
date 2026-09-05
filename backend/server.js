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

// Basic route for testing
app.get('/api/health', async (req, res) => {
    try {
        await db.query('SELECT 1');
        res.json({
            status: 'ok',
            database: 'connected',
            databaseName: process.env.DB_NAME || 'laundrigo_db'
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

const PORT = process.env.PORT || 5000;
app.listen(PORT, async () => {
    console.log('\n================================');
    console.log('LaundriGo Backend');
    console.log('================================');
    console.log(`Server running on port ${PORT}`);
    
    try {
        const connection = await db.getConnection();
        console.log('MySQL connected successfully');
        console.log(`Database: ${process.env.DB_NAME || 'laundrigo_db'}`);
        console.log('================================\n');
        connection.release();
    } catch (error) {
        console.error('\nMySQL connection failed.\n');
        console.error('Check:');
        console.error('1. Laragon is running');
        console.error('2. MySQL is running');
        console.error(`3. Database ${process.env.DB_NAME || 'laundrigo_db'} exists`);
        console.error('4. DB_HOST is correct');
        console.error('5. DB_PORT is correct');
        console.error('6. DB_USER is correct');
        console.error('7. DB_PASSWORD is correct');
        console.log('================================\n');
    }
});
