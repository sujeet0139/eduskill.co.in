const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const path = require('path');

// Load .env file from the root directory
dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function setupDatabaseAndUser() {
  console.log('🔄 Connecting to MySQL as root...');
  
  try {
    const connection = await mysql.createConnection({
      host: '68.178.153.237',
      user: 'root', // This must be the root user
      password: process.env.DB_ROOT_PASSWORD, // This must be the root password
      port: 3306
    });

    console.log('✅ Connected successfully as root!');

    // 1. Create Database
    await connection.query("CREATE DATABASE IF NOT EXISTS `eduskill` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;");
    console.log('✅ Database "eduskill" created (or already exists).');

    // 2. Create User and Grant Permissions (scoped to eduskill DB only — no impact to other DBs)
    await connection.query("CREATE USER IF NOT EXISTS 'eduskill'@'%' IDENTIFIED BY 'Eduskil@146';");
    // If the user already exists, update their password just in case
    await connection.query("ALTER USER 'eduskill'@'%' IDENTIFIED BY 'Eduskil@146';");
    await connection.query("GRANT ALL PRIVILEGES ON eduskill.* TO 'eduskill'@'%';");
    await connection.query("FLUSH PRIVILEGES;");
    console.log('✅ User "eduskill" configured and granted privileges!');

    await connection.end();
  } catch (error) {
    console.error('❌ Failed to setup database:', error.message);
  }
}

setupDatabaseAndUser();