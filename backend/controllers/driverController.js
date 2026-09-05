const db = require('../config/db');

exports.updateLocation = async (req, res) => {
    try {
        const { id } = req.params;
        const { latitude, longitude } = req.body;
        
        // Ensure user is updating their own location, or is admin/worker
        if (req.user.role === 'driver' && String(req.user.id) !== String(id)) {
            return res.status(403).json({ message: 'Access denied' });
        }
        
        const [result] = await db.query(
            'UPDATE users SET latitude = ?, longitude = ? WHERE id = ? AND role = "driver"',
            [latitude, longitude, id]
        );
        
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Driver not found' });
        
        res.json({ message: 'Driver location updated successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error updating location', error: error.message });
    }
};
