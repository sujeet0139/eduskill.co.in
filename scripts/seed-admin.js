const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const path = require('path');

// Load .env file from the root directory
dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function seedAdmin() {
  console.log('🔄 Connecting to database to seed admin user...');
  try {
    const useSSL = process.env.DB_SSL === 'true' || process.env.DB_SSL === '1';
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER || 'eduskill',
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME || 'eduskill',
      ssl: useSSL ? { rejectUnauthorized: true } : undefined,
    });

    // Get credentials from .env, or use defaults
    const email = process.env.ADMIN_EMAIL || 'admin@eduskill.co.in';
    const password = process.env.ADMIN_PASSWORD || 'admin123';
    const name = 'Super Admin';

    // Securely hash the password before saving to the database
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert or update the admin account
    await connection.query(`
      INSERT INTO admin_users (email, password_hash, name, role, is_active)
      VALUES (?, ?, ?, 'admin', TRUE)
      ON DUPLICATE KEY UPDATE
        password_hash = VALUES(password_hash),
        name = VALUES(name),
        is_active = TRUE
    `, [email, hashedPassword, name]);

    console.log('✅ Admin user created/updated successfully!');
    console.log(`👉 Log in with Email: ${email} | Password: ${password}`);

    await connection.end();
  } catch (error) {
    console.error('❌ Failed to seed admin:', error.message);
  }
}

seedAdmin();