const pool = require('./backend/config/db');
async function run() {
  try {
    // Add reference_number and payment_date to payments table
    await pool.query(`
      ALTER TABLE payments 
      ADD COLUMN reference_number VARCHAR(100) NULL,
      ADD COLUMN payment_date DATETIME DEFAULT CURRENT_TIMESTAMP
    `);
    console.log('Payments table altered');
  } catch(e) {
    console.log(e.message);
  }

  try {
      // Add bank_transfer to enum
      await pool.query(`
        ALTER TABLE payments 
        MODIFY COLUMN payment_method ENUM('cash','gcash','bank_transfer') NOT NULL
      `);
      console.log('Payment method enum altered');
  } catch (e) {
      console.log(e.message);
  }

  try {
      // Total amount is needed for order calculation, wait do we have it? Let's check laundry_orders
      await pool.query(`
          ALTER TABLE laundry_orders
          ADD COLUMN total_amount DECIMAL(10,2) DEFAULT 0.00
      `);
      console.log('laundry_orders altered to have total_amount');
  } catch (e) {
      console.log(e.message);
  }
  process.exit();
}
run();
