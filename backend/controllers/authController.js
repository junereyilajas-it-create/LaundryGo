const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../config/db');
const { logActivity } = require('../utils/activityLogger');

// Regular expression for valid email RFC format
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

// Helper to send email or log development preview
const sendPasswordResetEmail = async (email, token) => {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const resetUrl = `${frontendUrl}/reset-password?token=${token}`;
    
    // In local development or if SMTP is not configured, log clearly in terminal
    console.log('\n======================================================');
    console.log('🔑 [PASSWORD RESET REQUEST]');
    console.log(`Recipient: ${email}`);
    console.log(`Reset Token: ${token}`);
    console.log(`Reset URL: ${resetUrl}`);
    console.log('======================================================\n');

    // Optional nodemailer integration if credentials exist
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
        try {
            const nodemailer = require('nodemailer');
            const transporter = nodemailer.createTransport({
                host: process.env.SMTP_HOST,
                port: parseInt(process.env.SMTP_PORT || '587'),
                secure: process.env.SMTP_SECURE === 'true',
                auth: {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASS,
                },
            });

            await transporter.sendMail({
                from: process.env.SMTP_FROM || '"LaundriGo Support" <noreply@laundrigo.ph>',
                to: email,
                subject: 'LaundriGo - Password Reset Request',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
                        <h2 style="color: #002045; text-align: center;">LaundriGo Password Reset</h2>
                        <p>Hello,</p>
                        <p>We received a request to reset your password for your LaundriGo account. Click the button below to set a new password:</p>
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${resetUrl}" style="background-color: #1a365d; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Reset Password</a>
                        </div>
                        <p style="font-size: 13px; color: #666;">This link is valid for 1 hour. If you did not request this reset, you can safely ignore this email.</p>
                        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
                        <p style="font-size: 12px; color: #999; text-align: center;">LaundriGo • Poblacion, Lagonglong, Misamis Oriental, Philippines</p>
                    </div>
                `,
            });
            console.log(`✓ Reset email successfully dispatched to ${email}`);
        } catch (err) {
            console.error('Failed to send SMTP email, used dev logging fallback:', err.message);
        }
    }
};

// 1. Strict Registration (Customer & Driver only)
exports.register = async (req, res) => {
    try {
        const { name, email, password, phone, role } = req.body;
        
        if (!name || !email || !password) {
            return res.status(400).json({ message: 'Full name, email, and password are required.' });
        }

        const normalizedEmail = email.trim().toLowerCase();
        const normalizedName = name.trim();
        const requestedRole = (role || 'customer').trim().toLowerCase();

        // Validate email format strictly
        if (!EMAIL_REGEX.test(normalizedEmail)) {
            return res.status(400).json({ message: 'Please provide a valid email address.' });
        }

        // Validate password minimum requirements
        if (password.length < 8) {
            return res.status(400).json({ message: 'Password must be at least 8 characters long.' });
        }

        // STRICT ROLE ENFORCEMENT: Public registration is strictly for Customer or Driver only
        if (requestedRole !== 'customer' && requestedRole !== 'driver') {
            return res.status(403).json({ 
                message: 'Registration for worker or administrator accounts is not permitted. Worker and Admin accounts must be created by an authorized Administrator.' 
            });
        }

        // Duplicate Email Check - Return 409 Conflict with friendly message
        const [existingEmail] = await db.query('SELECT id FROM users WHERE email = ?', [normalizedEmail]);
        if (existingEmail.length > 0) {
            return res.status(409).json({ message: 'This email address is already registered. Please log in or use another email.' });
        }

        // Check for potential duplicate account (same normalized full name + phone)
        if (phone && phone.trim()) {
            const [existingAccount] = await db.query(
                'SELECT id FROM users WHERE LOWER(TRIM(name)) = LOWER(?) AND phone = ?',
                [normalizedName, phone.trim()]
            );
            if (existingAccount.length > 0) {
                return res.status(409).json({ message: 'An account with these details may already exist. Please sign in or use another phone number.' });
            }
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        // Account status logic: Drivers require Admin approval before activation
        const isDriver = requestedRole === 'driver';
        const isActive = isDriver ? 0 : 1;
        const approvalStatus = isDriver ? 'pending' : 'approved';

        const [result] = await db.query(
            'INSERT INTO users (name, email, password, role, phone, is_active, approval_status) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [normalizedName, normalizedEmail, hashedPassword, requestedRole, phone ? phone.trim() : null, isActive, approvalStatus]
        );

        const newUserId = result.insertId;

        if (isDriver) {
            // Create driver application record
            await db.query(
                'INSERT INTO driver_applications (user_id, status, applied_at, sms_status) VALUES (?, "pending", NOW(), "not_sent")',
                [newUserId]
            );

            // Notify Admin inside the LaundriGo system
            try {
                const [admins] = await db.query('SELECT id FROM users WHERE role = "admin" LIMIT 1');
                if (admins.length > 0) {
                    await db.query(
                        'INSERT INTO notifications (user_id, title, message) VALUES (?, "New Driver Application", ?)',
                        [admins[0].id, `A new driver application has been submitted by ${normalizedName} (${normalizedEmail}).`]
                    );
                }
            } catch (notifErr) {
                console.warn('Admin notification warning:', notifErr.message);
            }

            await logActivity({
                actorId: newUserId,
                actorName: normalizedName,
                actorRole: 'driver',
                actionType: 'driver_apply',
                description: `New driver application submitted by ${normalizedName} (${normalizedEmail})`,
                entityType: 'user',
                entityId: newUserId,
                outcome: 'success',
                metadata: { email: normalizedEmail, phone }
            });

            return res.status(201).json({ 
                message: 'Your driver application has been submitted and is awaiting administrator approval. You will receive an SMS notification once reviewed.', 
                userId: newUserId,
                role: 'driver',
                approval_status: 'pending'
            });
        }

        await logActivity({
            actorId: newUserId,
            actorName: normalizedName,
            actorRole: 'customer',
            actionType: 'user_register',
            description: `New customer account registered: ${normalizedName} (${normalizedEmail})`,
            entityType: 'user',
            entityId: newUserId,
            outcome: 'success',
            metadata: { email: normalizedEmail, phone }
        });

        res.status(201).json({ 
            message: 'User registered successfully. You can now log in.', 
            userId: newUserId,
            role: 'customer',
            approval_status: 'approved'
        });
    } catch (error) {
        console.error('Registration error:', error);
        // Handle database duplicate key error gracefully
        if (error.code === 'ER_DUP_ENTRY' || error.errno === 1062 || (error.message && error.message.includes('Duplicate entry'))) {
            return res.status(409).json({ message: 'This email address is already registered. Please log in or use another email.' });
        }
        res.status(500).json({ message: 'Error registering user', error: error.message });
    }
};

// 2. Fully Functional Login
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required.' });
        }

        const normalizedEmail = email.trim().toLowerCase();

        const [users] = await db.query(
            'SELECT id, name, email, password, role, phone, is_active, approval_status FROM users WHERE email = ?',
            [normalizedEmail]
        );

        if (users.length === 0) {
            await logActivity({
                req,
                actorName: normalizedEmail,
                actorRole: 'unknown',
                actionType: 'auth_login_failed',
                description: `Failed login attempt: Email ${normalizedEmail} not found`,
                outcome: 'failure',
                metadata: { email: normalizedEmail }
            });
            return res.status(401).json({ message: 'Invalid email or password.' });
        }

        const user = users[0];
        const isMatch = await bcrypt.compare(password, user.password);
        
        if (!isMatch) {
            await logActivity({
                req,
                actorId: user.id,
                actorName: user.name,
                actorRole: user.role,
                actionType: 'auth_login_failed',
                description: `Failed login attempt for ${user.email}: Incorrect password`,
                entityType: 'user',
                entityId: user.id,
                outcome: 'failure'
            });
            return res.status(401).json({ message: 'Invalid email or password.' });
        }

        // Driver approval check
        if (user.role === 'driver') {
            if (user.approval_status === 'pending' || user.is_active === 0) {
                await logActivity({
                    req,
                    actorId: user.id,
                    actorName: user.name,
                    actorRole: user.role,
                    actionType: 'auth_login_blocked',
                    description: `Driver login blocked: Application still pending approval (${user.email})`,
                    entityType: 'user',
                    entityId: user.id,
                    outcome: 'failure'
                });
                return res.status(403).json({ 
                    message: 'Your driver application is awaiting administrator approval. You will receive an SMS notification once approved.',
                    approval_status: 'pending'
                });
            }
            if (user.approval_status === 'rejected') {
                await logActivity({
                    req,
                    actorId: user.id,
                    actorName: user.name,
                    actorRole: user.role,
                    actionType: 'auth_login_blocked',
                    description: `Driver login blocked: Application was rejected (${user.email})`,
                    entityType: 'user',
                    entityId: user.id,
                    outcome: 'failure'
                });
                return res.status(403).json({ 
                    message: 'Your driver application has been rejected. Please contact LaundriGo management for details.',
                    approval_status: 'rejected'
                });
            }
        } else {
            // General account active check
            if (user.is_active === 0) {
                await logActivity({
                    req,
                    actorId: user.id,
                    actorName: user.name,
                    actorRole: user.role,
                    actionType: 'auth_login_blocked',
                    description: `Login blocked: Account has been deactivated (${user.email})`,
                    entityType: 'user',
                    entityId: user.id,
                    outcome: 'failure'
                });
                return res.status(403).json({ 
                    message: 'Your account has been deactivated. Please contact an administrator.' 
                });
            }
        }

        const token = jwt.sign(
            { id: user.id, role: user.role, email: user.email, name: user.name, approval_status: user.approval_status },
            process.env.JWT_SECRET || 'laundrigo_super_secret_jwt_key_2026',
            { expiresIn: '7d' }
        );

        await logActivity({
            req,
            actorId: user.id,
            actorName: user.name,
            actorRole: user.role,
            actionType: 'auth_login',
            description: `${user.name} (${user.role}) logged in successfully`,
            entityType: 'user',
            entityId: user.id,
            outcome: 'success'
        });

        res.json({
            message: 'Login successful!',
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                phone: user.phone,
                approval_status: user.approval_status
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Error logging in', error: error.message });
    }
};

// 2b. Logout (Audit log)
exports.logout = async (req, res) => {
    try {
        if (req.user) {
            await logActivity({
                req,
                actorId: req.user.id,
                actorName: req.user.name,
                actorRole: req.user.role,
                actionType: 'auth_logout',
                description: `${req.user.name} (${req.user.role}) logged out`,
                entityType: 'user',
                entityId: req.user.id,
                outcome: 'success'
            });
        }
        res.json({ message: 'Logged out successfully' });
    } catch (error) {
        console.error('Logout audit error:', error);
        res.json({ message: 'Logged out' });
    }
};

// 3. Current User Profile
exports.getMe = async (req, res) => {
    try {
        const [users] = await db.query('SELECT id, name, email, role, phone, default_address, latitude, longitude, created_at FROM users WHERE id = ?', [req.user.id]);
        if (users.length === 0) return res.status(404).json({ message: 'User not found' });
        res.json(users[0]);
    } catch (error) {
        console.error('getMe error:', error);
        res.status(500).json({ message: 'Error fetching user data', error: error.message });
    }
};

// 4. Forgot Password Workflow
exports.forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ message: 'Email address is required.' });
        }

        const normalizedEmail = email.trim().toLowerCase();
        const [users] = await db.query('SELECT id, name FROM users WHERE email = ?', [normalizedEmail]);

        // Generic response to avoid revealing user existence
        const genericSuccessMessage = 'If an account exists with this email, password recovery instructions have been sent.';

        if (users.length === 0) {
            return res.json({ message: genericSuccessMessage });
        }

        // Generate cryptographically secure reset token
        const resetToken = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

        // Invalidate any previous unconsumed tokens for this email
        await db.query('UPDATE password_resets SET used = 1 WHERE email = ?', [normalizedEmail]);

        // Save new token
        await db.query(
            'INSERT INTO password_resets (email, token, expires_at) VALUES (?, ?, ?)',
            [normalizedEmail, resetToken, expiresAt]
        );

        // Send email or log development reset link
        await sendPasswordResetEmail(normalizedEmail, resetToken);

        res.json({ 
            message: genericSuccessMessage,
            // For developer ease in testing when SMTP is not configured:
            devResetToken: process.env.NODE_ENV !== 'production' ? resetToken : undefined
        });
    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({ message: 'Error processing password reset request', error: error.message });
    }
};

// 5. Verify Reset Token
exports.verifyResetToken = async (req, res) => {
    try {
        const { token } = req.query;
        if (!token) return res.status(400).json({ valid: false, message: 'Token is required' });

        const [rows] = await db.query(
            'SELECT email, expires_at, used FROM password_resets WHERE token = ? AND used = 0 AND expires_at > NOW()',
            [token]
        );

        if (rows.length === 0) {
            return res.status(400).json({ valid: false, message: 'Invalid or expired password reset link.' });
        }

        res.json({ valid: true, email: rows[0].email });
    } catch (error) {
        res.status(500).json({ valid: false, message: 'Error verifying token' });
    }
};

// 6. Reset Password Confirmation
exports.resetPassword = async (req, res) => {
    try {
        const { token, password, confirm_password } = req.body;

        if (!token || !password) {
            return res.status(400).json({ message: 'Token and new password are required.' });
        }

        if (confirm_password && password !== confirm_password) {
            return res.status(400).json({ message: 'Passwords do not match.' });
        }

        if (password.length < 8) {
            return res.status(400).json({ message: 'Password must be at least 8 characters long.' });
        }

        // Verify token in database
        const [rows] = await db.query(
            'SELECT email, expires_at, used FROM password_resets WHERE token = ? AND used = 0 AND expires_at > NOW()',
            [token]
        );

        if (rows.length === 0) {
            return res.status(400).json({ message: 'This password reset link is invalid or has expired. Please request a new one.' });
        }

        const email = rows[0].email;
        const hashedPassword = await bcrypt.hash(password, 10);

        // Update user password
        await db.query('UPDATE users SET password = ? WHERE email = ?', [hashedPassword, email]);

        // Mark token as used
        await db.query('UPDATE password_resets SET used = 1 WHERE token = ?', [token]);

        res.json({ message: 'Password has been successfully updated. You may now log in with your new password.' });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ message: 'Error resetting password', error: error.message });
    }
};

// 7. Google OAuth Login
exports.googleLogin = async (req, res) => {
    try {
        const { credential } = req.body;
        if (!credential) {
            return res.status(400).json({ message: 'Google credential token is required.' });
        }

        // Verify Google ID token using Google tokeninfo API endpoint
        const googleResponse = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${credential}`);
        if (!googleResponse.ok) {
            return res.status(401).json({ message: 'Invalid Google authentication token.' });
        }

        const payload = await googleResponse.json();
        const { email, name, email_verified } = payload;

        if (!email_verified) {
            return res.status(400).json({ message: 'Google email is not verified.' });
        }

        const normalizedEmail = email.trim().toLowerCase();

        // Check if user already exists
        let [users] = await db.query('SELECT * FROM users WHERE email = ?', [normalizedEmail]);
        let user;

        if (users.length > 0) {
            user = users[0];
        } else {
            // Create new customer account (Strictly customer role, never privileged admin/worker)
            const randomPassword = crypto.randomBytes(16).toString('hex');
            const hashedPassword = await bcrypt.hash(randomPassword, 10);

            const [result] = await db.query(
                'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, "customer")',
                [name || 'Google User', normalizedEmail, hashedPassword]
            );

            user = {
                id: result.insertId,
                name: name || 'Google User',
                email: normalizedEmail,
                role: 'customer'
            };
        }

        const token = jwt.sign(
            { id: user.id, role: user.role, email: user.email, name: user.name },
            process.env.JWT_SECRET || 'laundrigo_super_secret_jwt_key_2026',
            { expiresIn: '7d' }
        );

        res.json({
            message: 'Google login successful!',
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                phone: user.phone
            }
        });
    } catch (error) {
        console.error('Google login error:', error);
        res.status(500).json({ message: 'Google authentication failed', error: error.message });
    }
};
