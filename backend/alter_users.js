const mysql = require('mysql2/promise');
require('dotenv').config({path: './.env'});
async function run() {
    const conn = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });
    try {
        await conn.query('ALTER TABLE users ADD COLUMN latitude DECIMAL(10,8), ADD COLUMN longitude DECIMAL(11,8)');
        console.log('Altered users table successfully');
    } catch(e) {
        console.log('Columns might exist:', e.message);
    }
    process.exit(0);
}
run();
