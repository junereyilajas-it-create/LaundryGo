const db = require('../config/db');

exports.getServices = async (req, res) => {
    try {
        const [services] = await db.query('SELECT * FROM services ORDER BY created_at DESC');
        res.json(services);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching services', error: error.message });
    }
};

exports.getServiceById = async (req, res) => {
    try {
        const [services] = await db.query('SELECT * FROM services WHERE id = ?', [req.params.id]);
        if (services.length === 0) return res.status(404).json({ message: 'Service not found' });
        res.json(services[0]);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching service', error: error.message });
    }
};

exports.createService = async (req, res) => {
    try {
        const { name, description, price } = req.body;
        if (!name || price === undefined) return res.status(400).json({ message: 'Missing required fields' });
        
        const [result] = await db.query(
            'INSERT INTO services (name, description, price) VALUES (?, ?, ?)',
            [name, description, price]
        );
        res.status(201).json({ message: 'Service created', id: result.insertId });
    } catch (error) {
        res.status(500).json({ message: 'Error creating service', error: error.message });
    }
};

exports.updateService = async (req, res) => {
    try {
        const { name, description, price } = req.body;
        const [result] = await db.query(
            'UPDATE services SET name = COALESCE(?, name), description = COALESCE(?, description), price = COALESCE(?, price) WHERE id = ?',
            [name, description, price, req.params.id]
        );
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Service not found' });
        res.json({ message: 'Service updated' });
    } catch (error) {
        res.status(500).json({ message: 'Error updating service', error: error.message });
    }
};

exports.deleteService = async (req, res) => {
    try {
        const [result] = await db.query('DELETE FROM services WHERE id = ?', [req.params.id]);
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Service not found' });
        res.json({ message: 'Service deleted' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting service', error: error.message });
    }
};
