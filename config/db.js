const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config();

// Managed MySQL providers (Aiven, etc.) require TLS. Set DB_SSL=true in production.
const useSSL = process.env.DB_SSL === 'true' || process.env.DB_SSL === '1';

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'eduskill',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'eduskill',
  waitForConnections: true,
  // Keep the pool small on serverless to avoid exhausting the provider's
  // connection limit across many concurrent function invocations.
  connectionLimit: Number(process.env.DB_POOL_LIMIT) || (process.env.VERCEL ? 3 : 10),
  queueLimit: 0,
  ssl: useSSL ? { rejectUnauthorized: true } : undefined
});

module.exports = pool;
