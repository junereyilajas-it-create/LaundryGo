-- LaundriGo Database Schema
-- Serves Poblacion, Lagonglong, Misamis Oriental, Philippines

CREATE DATABASE IF NOT EXISTS laundrigo_db;
USE laundrigo_db;

-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    role ENUM('customer', 'worker', 'driver', 'admin') NOT NULL DEFAULT 'customer',
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Addresses Table
CREATE TABLE IF NOT EXISTS addresses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    address TEXT NOT NULL,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Services Catalog Table
CREATE TABLE IF NOT EXISTS services (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Laundry Orders Table
CREATE TABLE IF NOT EXISTS laundry_orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_number VARCHAR(50) UNIQUE NOT NULL,
    customer_id INT NOT NULL,
    service_type ENUM('customer_dropoff', 'shop_pickup') NOT NULL,
    service_name VARCHAR(150),
    estimated_weight DECIMAL(5,2),
    total_amount DECIMAL(10,2) DEFAULT 0.00,
    preferred_date DATE,
    preferred_time VARCHAR(50),
    pickup_address_text TEXT,
    delivery_address_text TEXT,
    special_instructions TEXT,
    payment_method ENUM('cash', 'gcash', 'bank_transfer') NOT NULL DEFAULT 'cash',
    status ENUM(
        'Pending Request', 'Confirmed', 'Pickup Scheduled', 'Picked Up',
        'Laundry Received', 'Washing', 'Drying', 'Folding', 'Ready',
        'Out for Delivery', 'Delivered', 'Customer Pickup', 'Completed', 'Cancelled'
    ) NOT NULL DEFAULT 'Pending Request',
    payment_status ENUM('unpaid', 'partially_paid', 'paid', 'cancelled', 'refunded') NOT NULL DEFAULT 'unpaid',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Pickup Requests Table
CREATE TABLE IF NOT EXISTS pickup_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    customer_id INT NOT NULL,
    driver_id INT,
    pickup_date DATE,
    pickup_time VARCHAR(50),
    address_id INT,
    status ENUM('pending', 'accepted', 'assigned', 'on_the_way', 'arrived', 'picked_up', 'failed', 'cancelled') NOT NULL DEFAULT 'pending',
    notes TEXT,
    actual_time DATETIME,
    failure_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES laundry_orders(id) ON DELETE CASCADE,
    FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (driver_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (address_id) REFERENCES addresses(id) ON DELETE SET NULL
);

-- Delivery Requests Table
CREATE TABLE IF NOT EXISTS delivery_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    customer_id INT NOT NULL,
    driver_id INT,
    delivery_date DATE,
    delivery_time VARCHAR(50),
    address_id INT,
    status ENUM('pending', 'assigned', 'on_the_way', 'arrived', 'delivered', 'failed', 'cancelled') NOT NULL DEFAULT 'pending',
    notes TEXT,
    actual_time DATETIME,
    failure_reason TEXT,
    proof_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES laundry_orders(id) ON DELETE CASCADE,
    FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (driver_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (address_id) REFERENCES addresses(id) ON DELETE SET NULL
);

-- Laundry Status History Table
CREATE TABLE IF NOT EXISTS laundry_status_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    status VARCHAR(100) NOT NULL,
    changed_by INT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES laundry_orders(id) ON DELETE CASCADE,
    FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Payments Table
CREATE TABLE IF NOT EXISTS payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    payment_method ENUM('cash', 'gcash', 'bank_transfer') NOT NULL,
    payment_status ENUM('unpaid', 'partially_paid', 'paid', 'cancelled', 'refunded') NOT NULL DEFAULT 'unpaid',
    reference_number VARCHAR(150),
    gateway_transaction_id VARCHAR(255),
    collected_by INT,
    payment_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES laundry_orders(id) ON DELETE CASCADE,
    FOREIGN KEY (collected_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    order_id INT,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (order_id) REFERENCES laundry_orders(id) ON DELETE SET NULL
);

-- Password Resets Table
CREATE TABLE IF NOT EXISTS password_resets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    token VARCHAR(255) NOT NULL,
    expires_at DATETIME NOT NULL,
    used TINYINT(1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_token (token),
    INDEX idx_email (email)
);

-- Order Messages Table (Order-specific customer <-> driver / staff chat)
CREATE TABLE IF NOT EXISTS order_messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    sender_id INT NOT NULL,
    message TEXT NOT NULL,
    is_read TINYINT(1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES laundry_orders(id) ON DELETE CASCADE,
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Insert Sample Services
INSERT IGNORE INTO services (id, name, description, price) VALUES
(1, 'Wash & Fold', 'Regular washing, tumble drying, and neat folding for everyday laundry.', 35.00),
(2, 'Wash & Iron / Press', 'Washed, dried, and professionally steam ironed on hangers or neatly folded.', 50.00),
(3, 'Dry Cleaning', 'Delicate dry cleaning treatment for suits, barongs, gowns, and coats.', 120.00),
(4, 'Comforter & Heavy Blanket', 'Deep hygiene cleaning for heavy duvets, comforters, and quilts.', 150.00),
(5, 'Shoe & Bag Refresh', 'Specialized gentle scrubbing and stain removal for sneakers and canvas bags.', 90.00);

-- Insert Sample Users
-- Password for all: password123 (bcrypt cost 10)
INSERT IGNORE INTO users (id, name, email, password, role, phone, latitude, longitude) VALUES
(1, 'John Customer', 'customer@example.com', '$2b$10$X8OOM8K9/5B.6B.8.D6nCOm7q3sC2Bv52r.t0Jm2O.D.3m1z3vKOC', 'customer', '09123456789', 8.7845, 124.7761),
(2, 'Admin Worker', 'admin@example.com', '$2b$10$X8OOM8K9/5B.6B.8.D6nCOm7q3sC2Bv52r.t0Jm2O.D.3m1z3vKOC', 'worker', '09198765432', 8.7842, 124.7758),
(3, 'Dave Driver', 'driver@example.com', '$2b$10$X8OOM8K9/5B.6B.8.D6nCOm7q3sC2Bv52r.t0Jm2O.D.3m1z3vKOC', 'driver', '09112233445', 8.7850, 124.7770);

-- Sample Address in Poblacion, Lagonglong, Misamis Oriental
INSERT IGNORE INTO addresses (id, user_id, address, latitude, longitude) VALUES
(1, 1, 'Poblacion, Lagonglong, Misamis Oriental, 9006 Philippines', 8.7845, 124.7761);

-- Sample Order
INSERT IGNORE INTO laundry_orders (id, order_number, customer_id, service_type, service_name, estimated_weight, total_amount, preferred_date, preferred_time, pickup_address_text, delivery_address_text, payment_status, payment_method, status)
VALUES (1, 'LAU-2026-00001', 1, 'shop_pickup', 'Wash & Fold', 5.5, 192.50, CURDATE(), 'Afternoon', 'Poblacion, Lagonglong, Misamis Oriental', 'Poblacion, Lagonglong, Misamis Oriental', 'unpaid', 'gcash', 'Pending Request');

-- Sample Pickup Request
INSERT IGNORE INTO pickup_requests (id, order_id, customer_id, status, pickup_date, pickup_time, address_id)
VALUES (1, 1, 1, 'pending', CURDATE(), 'Afternoon', 1);

-- Initial History
INSERT IGNORE INTO laundry_status_history (id, order_id, status, notes, changed_by)
VALUES (1, 1, 'Pending Request', 'Order placed by customer', 1);

-- Sample Notification
INSERT IGNORE INTO notifications (id, user_id, order_id, title, message)
VALUES (1, 1, 1, 'Request Submitted', 'Your laundry pickup request LAU-2026-00001 has been submitted.');
