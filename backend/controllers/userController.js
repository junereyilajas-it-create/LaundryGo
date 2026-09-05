const db = require('../config/db');
const bcrypt = require('bcrypt');

exports.getAllUsers = async (req, res) => {
    try {
        const { role } = req.query;
        let query = 'SELECT id, name, email, role, phone, created_at FROM users';
        let params = [];
        if (role) {
            query += ' WHERE role = ?';
            params.push(role.toLowerCase());
        }
        const [users] = await db.query(query, params);
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching users', error: error.message });
    }
};

exports.getUserById = async (req, res) => {
    try {
        const [users] = await db.query('SELECT id, name, email, role, phone, created_at FROM users WHERE id = ?', [req.params.id]);
        if (users.length === 0) return res.status(404).json({ message: 'User not found' });
        res.json(users[0]);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching user', error: error.message });
    }
};

exports.createUser = async (req, res) => {
    try {
        const { name, email, password, phone, role } = req.body;
        if (!name || !email || !password) return res.status(400).json({ message: 'Missing required fields' });
        
        const hashedPassword = await bcrypt.hash(password, 10);
        const [result] = await db.query(
            'INSERT INTO users (name, email, password, phone, role) VALUES (?, ?, ?, ?, ?)',
            [name, email, hashedPassword, phone, role || 'customer']
        );
        res.status(201).json({ message: 'User created successfully', id: result.insertId });
    } catch (error) {
        res.status(500).json({ message: 'Error creating user', error: error.message });
    }
};

exports.updateUser = async (req, res) => {
    try {
        const { name, email, phone, role, password } = req.body;
        
        // Build dynamic query
        let fields = [];
        let params = [];
        
        if (name) { fields.push('name = ?'); params.push(name); }
        if (email) { fields.push('email = ?'); params.push(email); }
        if (phone) { fields.push('phone = ?'); params.push(phone); }
        if (role) { fields.push('role = ?'); params.push(role); }
        if (password) {
            const hashedPassword = await bcrypt.hash(password, 10);
            fields.push('password = ?');
            params.push(hashedPassword);
        }
        
        if (fields.length === 0) return res.status(400).json({ message: 'No fields to update' });
        
        params.push(req.params.id);
        const query = `UPDATE users SET ${fields.join(', ')} WHERE id = ?`;
        
        const [result] = await db.query(query, params);
        if (result.affectedRows === 0) return res.status(404).json({ message: 'User not found' });
        
        res.json({ message: 'User updated successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error updating user', error: error.message });
    }
};

exports.deleteUser = async (req, res) => {
    try {
        const [result] = await db.query('DELETE FROM users WHERE id = ?', [req.params.id]);
        if (result.affectedRows === 0) return res.status(404).json({ message: 'User not found' });
        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        // Foreign key constraint failures will end up here
        res.status(500).json({ message: 'Error deleting user', error: error.message });
    }
};
