// One-shot fix for admin login. Run this ON THE VPS (the machine the live API
// runs on) so it seeds the SAME database the backend reads from:
//
//     node scripts/fix-admin-login.js
//
// It connects using the DB_* vars in .env, makes sure the admin_users table
// exists, then creates/updates the admin with the credentials below. Safe to
// re-run (it upserts).
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Fixed, known login — deliberately hard-coded so the result doesn't depend on
// whatever ADMIN_EMAIL/ADMIN_PASSWORD happen to be in this machine's .env.
const EMAIL = 'admin@example.com';
const PASSWORD = 'Sujeet@456';
const NAME = 'Super Admin';

(async () => {
  const useSSL = process.env.DB_SSL === 'true' || process.env.DB_SSL === '1';
  const host = process.env.DB_HOST || 'localhost';
  const name = process.env.DB_NAME || 'eduskill';
  console.log(`🔄 Connecting to DB '${name}' on ${host}:${process.env.DB_PORT || 3306} ...`);

  let connection;
  try {
    connection = await mysql.createConnection({
      host,
      port: Number(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER || 'eduskill',
      password: process.env.DB_PASSWORD,
      database: name,
      ssl: useSSL ? { rejectUnauthorized: true } : undefined,
      connectTimeout: 10000,
    });
    console.log('✅ Connected.');

    // Make sure the table exists (no-op if it already does).
    await connection.query(`
      CREATE TABLE IF NOT EXISTS admin_users (
        id INT PRIMARY KEY AUTO_INCREMENT,
        email VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(100),
        role ENUM('admin', 'moderator', 'viewer') DEFAULT 'moderator',
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_email (email)
      )
    `);

    const hash = await bcrypt.hash(PASSWORD, 10);
    await connection.query(
      `INSERT INTO admin_users (email, password_hash, name, role, is_active)
       VALUES (?, ?, ?, 'admin', TRUE)
       ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), name = VALUES(name), role = 'admin', is_active = TRUE`,
      [EMAIL, hash, NAME]
    );

    // Verify it really works against what's now stored.
    const [rows] = await connection.query('SELECT password_hash FROM admin_users WHERE email = ?', [EMAIL]);
    const ok = rows.length && (await bcrypt.compare(PASSWORD, rows[0].password_hash));

    console.log('\n──────────────────────────────────────────');
    console.log(ok ? '✅ Admin login is ready.' : '❌ Verification failed — check the DB.');
    console.log(`   Database : ${name} @ ${host}`);
    console.log(`   Email    : ${EMAIL}`);
    console.log(`   Password : ${PASSWORD}`);
    console.log('──────────────────────────────────────────');
    console.log('\nLog in at https://eduskill.co.in/admin/login');

    await connection.end();
    process.exit(ok ? 0 : 1);
  } catch (error) {
    console.error('\n❌ Failed:', error.code || '', error.message);
    console.error('   Check the DB_* values in your .env and that MySQL is reachable from this machine.');
    if (connection) await connection.end().catch(() => {});
    process.exit(1);
  }
})();
