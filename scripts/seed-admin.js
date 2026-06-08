// Seed (or update) an admin user. Run after `npm run db:setup`.
// Usage: set ADMIN_EMAIL and ADMIN_PASSWORD in .env, then `npm run seed:admin`.
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME || 'Administrator';

  if (!email || !password) {
    console.error('❌ Set ADMIN_EMAIL and ADMIN_PASSWORD in your .env first.');
    process.exit(1);
  }

  const useSSL = process.env.DB_SSL === 'true' || process.env.DB_SSL === '1';
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'eduskill',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'eduskill',
    ssl: useSSL ? { rejectUnauthorized: true } : undefined
  });

  const hash = await bcrypt.hash(password, 10);
  await connection.query(
    `INSERT INTO admin_users (email, password_hash, name, role, is_active)
     VALUES (?, ?, ?, 'admin', TRUE)
     ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), name = VALUES(name), role = 'admin', is_active = TRUE`,
    [email, hash, name]
  );

  console.log(`✅ Admin user ready: ${email}`);
  await connection.end();
  process.exit(0);
}

seedAdmin().catch((err) => {
  console.error('❌ Failed to seed admin:', err.message);
  process.exit(1);
});
