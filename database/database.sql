-- LaundriGo Database Schema

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

-- Laundry Orders Table
CREATE TABLE IF NOT EXISTS laundry_orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_number VARCHAR(50) UNIQUE NOT NULL,
    customer_id INT NOT NULL,
    service_type ENUM('customer_dropoff', 'shop_pickup') NOT NULL,
    estimated_weight DECIMAL(5,2),
    preferred_date DATE,
    preferred_time VARCHAR(50),
    special_instructions TEXT,
    status ENUM(
        'Pending Request', 'Confirmed', 'Pickup Scheduled', 'Picked Up',
        'Laundry Received', 'Washing', 'Drying', 'Folding', 'Ready',
        'Out for Delivery', 'Delivered', 'Customer Pickup', 'Completed', 'Cancelled'
    ) NOT NULL DEFAULT 'Pending Request',
    payment_status ENUM('unpaid', 'partially_paid', 'paid') NOT NULL DEFAULT 'unpaid',
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
    status ENUM('pending', 'accepted', 'assigned', 'on_the_way', 'picked_up', 'cancelled') NOT NULL DEFAULT 'pending',
    notes TEXT,
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
    status ENUM('pending', 'assigned', 'out_for_delivery', 'delivered', 'cancelled') NOT NULL DEFAULT 'pending',
    notes TEXT,
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
    payment_method ENUM('cash', 'gcash') NOT NULL,
    payment_status ENUM('unpaid', 'partially_paid', 'paid') NOT NULL DEFAULT 'unpaid',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES laundry_orders(id) ON DELETE CASCADE
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

-- Insert Sample Data
-- Passwords are hashed versions of 'password123' using bcrypt (cost 10).
INSERT INTO users (name, email, password, role, phone) VALUES
('John Customer', 'customer@example.com', '$2b$10$X8OOM8K9/5B.6B.8.D6nCOm7q3sC2Bv52r.t0Jm2O.D.3m1z3vKOC', 'customer', '09123456789'),
('Admin Worker', 'admin@example.com', '$2b$10$X8OOM8K9/5B.6B.8.D6nCOm7q3sC2Bv52r.t0Jm2O.D.3m1z3vKOC', 'worker', '09198765432'),
('Dave Driver', 'driver@example.com', '$2b$10$X8OOM8K9/5B.6B.8.D6nCOm7q3sC2Bv52r.t0Jm2O.D.3m1z3vKOC', 'driver', '09112233445');

INSERT INTO addresses (user_id, address, latitude, longitude) VALUES
(1, '123 Customer St, Sample City', 14.5995, 120.9842);

-- Sample Order (Pickup requested)
INSERT INTO laundry_orders (order_number, customer_id, service_type, estimated_weight, preferred_date, preferred_time, payment_status, status)
VALUES ('LAU-2026-00001', 1, 'shop_pickup', 5.5, CURDATE(), 'Afternoon', 'unpaid', 'Pending Request');

-- Sample Pickup Request for the order
INSERT INTO pickup_requests (order_id, customer_id, status)
VALUES (1, 1, 'pending');

-- Initial History
INSERT INTO laundry_status_history (order_id, status, notes, changed_by)
VALUES (1, 'Pending Request', 'Order placed', 1);

-- Sample Notification
INSERT INTO notifications (user_id, order_id, title, message)
VALUES (1, 1, 'Request Submitted', 'Your laundry pickup request LAU-2026-00001 has been submitted.');
