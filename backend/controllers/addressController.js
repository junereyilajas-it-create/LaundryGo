const db = require('../config/db');

exports.getAddresses = async (req, res) => {
    try {
        let query = 'SELECT * FROM addresses';
        let params = [];
        
        // Customers only see their own addresses
        if (req.user.role === 'customer') {
            query += ' WHERE user_id = ?';
            params.push(req.user.id);
        }
        
        const [addresses] = await db.query(query, params);
        res.json(addresses);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching addresses', error: error.message });
    }
};

exports.getAddressById = async (req, res) => {
    try {
        const [addresses] = await db.query('SELECT * FROM addresses WHERE id = ?', [req.params.id]);
        if (addresses.length === 0) return res.status(404).json({ message: 'Address not found' });
        
        const address = addresses[0];
        if (req.user.role === 'customer' && address.user_id !== req.user.id) {
            return res.status(403).json({ message: 'Access denied' });
        }
        
        res.json(address);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching address', error: error.message });
    }
};

exports.createAddress = async (req, res) => {
    try {
        const { address, latitude, longitude, user_id } = req.body;
        
        // Default to current user unless admin specifies
        const targetUserId = (req.user.role === 'admin' || req.user.role === 'worker') && user_id ? user_id : req.user.id;
        
        const [result] = await db.query(
            'INSERT INTO addresses (user_id, address, latitude, longitude) VALUES (?, ?, ?, ?)',
            [targetUserId, address || 'Unknown Address', latitude, longitude]
        );
        
        res.status(201).json({ message: 'Address created', id: result.insertId });
    } catch (error) {
        res.status(500).json({ message: 'Error creating address', error: error.message });
    }
};

exports.updateAddress = async (req, res) => {
    try {
        const { address, latitude, longitude } = req.body;
        const addressId = req.params.id;
        
        const [existing] = await db.query('SELECT * FROM addresses WHERE id = ?', [addressId]);
        if (existing.length === 0) return res.status(404).json({ message: 'Address not found' });
        
        if (req.user.role === 'customer' && existing[0].user_id !== req.user.id) {
            return res.status(403).json({ message: 'Access denied' });
        }
        
        await db.query(
            'UPDATE addresses SET address = ?, latitude = ?, longitude = ? WHERE id = ?',
            [address || existing[0].address, latitude || existing[0].latitude, longitude || existing[0].longitude, addressId]
        );
        
        res.json({ message: 'Address updated' });
    } catch (error) {
        res.status(500).json({ message: 'Error updating address', error: error.message });
    }
};

exports.deleteAddress = async (req, res) => {
    try {
        const addressId = req.params.id;
        
        const [existing] = await db.query('SELECT * FROM addresses WHERE id = ?', [addressId]);
        if (existing.length === 0) return res.status(404).json({ message: 'Address not found' });
        
        if (req.user.role === 'customer' && existing[0].user_id !== req.user.id) {
            return res.status(403).json({ message: 'Access denied' });
        }
        
        await db.query('DELETE FROM addresses WHERE id = ?', [addressId]);
        res.json({ message: 'Address deleted' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting address', error: error.message });
    }
};
