const db = require('./config/db');
const bcrypt = require('bcrypt');

async function seedAdminAndApprovalSchema() {
    console.log('\n======================================================');
    console.log('🔧 [MIGRATION & SEED] Admin Account & Driver Approval');
    console.log('======================================================');

    try {
        const dbName = process.env.DB_NAME || 'laundrigo_db';

        // 1. Ensure approval_status column exists in users table
        const [approvalColumnCheck] = await db.query(
            "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = 'approval_status'",
            [dbName]
        );

        if (approvalColumnCheck.length === 0) {
            console.log('Adding approval_status column to users table...');
            await db.query(`
                ALTER TABLE users 
                ADD COLUMN approval_status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'approved' 
                AFTER is_active
            `);
            console.log('✓ approval_status column added to users.');
        }

        // 2. Ensure driver_applications table exists
        await db.query(`
            CREATE TABLE IF NOT EXISTS driver_applications (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL UNIQUE,
                status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
                applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                reviewed_at TIMESTAMP NULL,
                reviewed_by INT NULL,
                rejection_reason TEXT NULL,
                sms_status ENUM('not_sent', 'sent', 'failed', 'not_configured') DEFAULT 'not_sent',
                sms_sent_at TIMESTAMP NULL,
                sms_reference VARCHAR(255) NULL,
                sms_error TEXT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
            )
        `);
        console.log('✓ driver_applications table verified.');

        // 3. Provision the Single Admin Account
        const adminEmail = 'junerey@gmail.com'; // Normalized
        const adminPlainPassword = 'junerey123';
        const adminName = 'Junerey Admin';
        const adminPhone = '09606305374';
        const hashedAdminPassword = await bcrypt.hash(adminPlainPassword, 10);

        // Check if admin user exists (case-insensitive)
        const [existingAdmin] = await db.query('SELECT id, email, role FROM users WHERE LOWER(email) = ?', [adminEmail]);

        let adminUserId;
        if (existingAdmin.length > 0) {
            adminUserId = existingAdmin[0].id;
            await db.query(
                'UPDATE users SET name = ?, email = ?, password = ?, role = "admin", is_active = 1, approval_status = "approved", phone = COALESCE(phone, ?) WHERE id = ?',
                [adminName, adminEmail, hashedAdminPassword, adminPhone, adminUserId]
            );
            console.log(`✓ Authorized Admin account (${adminEmail}) synchronized and configured.`);
        } else {
            const [insertResult] = await db.query(
                'INSERT INTO users (name, email, password, role, phone, is_active, approval_status) VALUES (?, ?, ?, "admin", ?, 1, "approved")',
                [adminName, adminEmail, hashedAdminPassword, adminPhone]
            );
            adminUserId = insertResult.insertId;
            console.log(`✓ Single Authorized Admin account (${adminEmail}) created with ID: ${adminUserId}`);
        }

        // 4. Ensure there is strictly ONLY ONE administrator account in the entire system.
        // Demote all other accounts that currently have role = 'admin' to role = 'worker',
        // and rename any 'Super Admin' users to eliminate all references to Super Admin.
        const [otherAdmins] = await db.query(
            'SELECT id, email, name FROM users WHERE role = "admin" AND id != ?',
            [adminUserId]
        );

        if (otherAdmins.length > 0) {
            console.log(`Migrating ${otherAdmins.length} additional admin account(s) to worker role to enforce single-admin architecture...`);
            for (const other of otherAdmins) {
                const newName = other.name.replace(/Super Admin/gi, 'Staff Worker');
                await db.query(
                    'UPDATE users SET role = "worker", name = ? WHERE id = ?',
                    [newName, other.id]
                );
                console.log(`  - Migrated user #${other.id} (${other.email}) from admin to worker.`);
            }
        }

        // Clean up any remaining users with name 'Super Admin'
        await db.query('UPDATE users SET name = "Administrator" WHERE name = "Super Admin"');

        // 5. Backfill existing drivers into driver_applications as approved so existing operations remain uninterrupted
        const [existingDrivers] = await db.query('SELECT id FROM users WHERE role = "driver"');
        for (const driver of existingDrivers) {
            await db.query(`
                INSERT IGNORE INTO driver_applications (user_id, status, reviewed_at, reviewed_by, sms_status)
                VALUES (?, 'approved', NOW(), ?, 'not_configured')
            `, [driver.id, adminUserId]);
            await db.query('UPDATE users SET approval_status = "approved", is_active = 1 WHERE id = ? AND approval_status IS NULL', [driver.id]);
        }

        console.log('✓ Existing driver applications synchronized.');
        console.log('======================================================');
        console.log('🎉 Admin & Driver Approval Setup completed successfully!');
        console.log(`   Admin Email: Junerey@gmail.com`);
        console.log(`   Admin Role: Admin`);
        console.log('======================================================\n');
        return true;
    } catch (err) {
        console.error('❌ Error in seedAdminAndApprovalSchema:', err);
        throw err;
    }
}

if (require.main === module) {
    seedAdminAndApprovalSchema()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
}

module.exports = seedAdminAndApprovalSchema;
