# LaundriGo: Laundry Management System

A full-stack web application designed for a small laundry business to manage customer requests, pickups, processing, and deliveries.

## Features
- **Role-based Access**: Custom dashboards for Customers, Workers/Admins, and Drivers.
- **Laundry Requests**: Customers can schedule drop-offs or shop pickups with preferred dates/times.
- **Map Integration**: Real-time Leaflet map integration for pinning pickup/delivery locations.
- **Status Tracking**: Track laundry through various stages (Washing, Drying, Folding, Ready, Delivered).
- **Driver Logistics**: Dedicated driver dashboard to manage assigned pickups and deliveries.
- **RESTful API**: Secure backend with JWT authentication and Express.js.

## Technology Stack
- **Frontend**: React, TypeScript, Vite, TailwindCSS, React-Leaflet
- **Backend**: Node.js, Express.js, MySQL (mysql2), JWT
- **Database**: MySQL

## Prerequisites
- Node.js (v18 or higher)
- **Laragon** (for local development with MySQL and phpMyAdmin)

## Database Setup Guide (Laragon)

### STEP 1 — Start Laragon
Open Laragon.
Start:
* Apache
* MySQL

The important service for the database is MySQL.

### STEP 2 — Open phpMyAdmin
Open phpMyAdmin from Laragon.
Create a database named:
`laundrigo_db`

### STEP 3 — Import database.sql
Open the SQL/Import section in phpMyAdmin.
Import:
`database/database.sql`

After importing, verify that the database contains:
* users
* addresses
* laundry_orders
* pickup_requests
* delivery_requests
* laundry_status_history
* payments
* notifications

### STEP 4 — Configure .env
Inside the `backend` folder, duplicate `.env.example` and save it as `.env`.
Configure your credentials (default Laragon settings shown):

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=laundrigo_db
PORT=5000
JWT_SECRET=your_secret_here
```

Do not commit `.env` to GitHub.

### STEP 5 — Install Backend Packages
Inside the backend folder, run:
```bash
npm install
```
*(Installs express, mysql2, cors, dotenv, bcrypt, jsonwebtoken, multer)*

### STEP 6 — Start Backend
Run:
```bash
npm run dev
```

The terminal should successfully show:
```text
================================
LaundriGo Backend
================================
Server running on port 5000
MySQL connected successfully
Database: laundrigo_db
================================
```

### STEP 7 — Test the Connection
After starting the backend, test by opening:
`http://localhost:5000/api/health`

The response should confirm:
```json
{
  "status": "ok",
  "database": "connected",
  "databaseName": "laundrigo_db"
}
```

### STEP 8 — Frontend Connection
The React frontend uses a `.env` file (if provided) or defaults to the local API. 
The API service is centralized in `frontend/src/services/api.ts` making use of `VITE_API_URL` (defaulting to `http://localhost:5000/api`).

Navigate to the `frontend` directory, install packages, and run the development server:
```bash
npm install
npm run dev
```

## Sample Accounts
The database script automatically inserts the following sample users for testing (Password for all: `password123`):
- **Customer**: `customer@example.com`
- **Worker/Admin**: `admin@example.com`
- **Driver**: `driver@example.com`

## Ubuntu Server Deployment Guide

1. **System Updates & Dependencies**
   ```bash
   sudo apt update && sudo apt upgrade -y
   sudo apt install nodejs npm mysql-server nginx -y
   ```

2. **Database Configuration**
   - Secure MySQL: `sudo mysql_secure_installation`
   - Create database and import schema: `mysql -u root -p laundrigo_db < database.sql`

3. **Backend Deployment (PM2)**
   - Install PM2: `sudo npm install -g pm2`
   - Inside `backend`, set up `.env` with production DB credentials.
   - Start with PM2: `pm2 start server.js --name "laundrigo-api"`
   - Ensure it starts on boot: `pm2 startup && pm2 save`

4. **Frontend Deployment (Nginx)**
   - Inside `frontend`, run `npm run build` to generate the `dist/` folder.
   - Copy the `dist` contents to `/var/www/laundrigo`: 
     ```bash
     sudo mkdir -p /var/www/laundrigo
     sudo cp -r dist/* /var/www/laundrigo/
     ```

5. **Nginx Configuration**
   Create a new file `/etc/nginx/sites-available/laundrigo` with the following configuration:
   ```nginx
   server {
       listen 80;
       server_name your_domain_or_ip;
       root /var/www/laundrigo;
       index index.html;

       # Frontend Routing
       location / {
           try_files $uri $uri/ /index.html;
       }

       # Backend Proxy
       location /api/ {
           proxy_pass http://localhost:5000/;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```
   - Enable it: `sudo ln -s /etc/nginx/sites-available/laundrigo /etc/nginx/sites-enabled/`
   - Test and restart Nginx: `sudo nginx -t && sudo systemctl restart nginx`

6. **UFW Firewall Setup**
   ```bash
   sudo ufw allow 22/tcp   # SSH
   sudo ufw allow 80/tcp   # HTTP
   sudo ufw allow 443/tcp  # HTTPS
   sudo ufw enable
   ```
