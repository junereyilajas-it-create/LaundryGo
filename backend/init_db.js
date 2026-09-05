const fs = require('fs');
const mysql = require('mysql2/promise');
require('dotenv').config({path: './.env'});

async function init() {
    try {
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            multipleStatements: true
        });
        const sql = fs.readFileSync('../database/database.sql', 'utf8');
        await connection.query(sql);
        console.log('Database initialized successfully.');
        process.exit(0);
    } catch(err) {
        console.error(err);
        process.exit(1);
    }
}
init();
