/**
 * Server Entry Point
 * Nisit Deeden System - Outstanding Student Selection
 */

require('dotenv').config();
const app = require('./app');
const { pool } = require('./src/config/database');
const { hashpw, gensalt } = require('./src/utils/ripcrypt');

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

async function ensureDefaultAdminAccount() {
  const defaultEmail = 'admin@ku.th';
  const defaultName = 'admin';
  const defaultPassword = '123456789';
  const passwordHash = hashpw(defaultPassword, gensalt());

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const roleResult = await client.query(
      'SELECT id FROM roles WHERE name = $1 LIMIT 1',
      ['ADMIN']
    );
    if (roleResult.rows.length === 0) {
      await client.query('ROLLBACK');
      console.warn('ADMIN role not found. Skip default admin bootstrap.');
      return;
    }
    const adminRoleId = roleResult.rows[0].id;

    const userResult = await client.query(
      'SELECT id FROM users WHERE email = $1 LIMIT 1',
      [defaultEmail]
    );

    let userId;
    if (userResult.rows.length === 0) {
      const insertUser = await client.query(
        `INSERT INTO users (email, password_hash, fullname, sso_enabled)
         VALUES ($1, $2, $3, false)
         RETURNING id`,
        [defaultEmail, passwordHash, defaultName]
      );
      userId = insertUser.rows[0].id;
      console.log('Default admin account created: admin@ku.th');
    } else {
      userId = userResult.rows[0].id;
    }

    await client.query(
      `INSERT INTO user_roles (user_id, role_id)
       VALUES ($1, $2)
       ON CONFLICT (user_id, role_id) DO NOTHING`,
      [userId, adminRoleId]
    );

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Failed to bootstrap default admin account:', error.message);
  } finally {
    client.release();
  }
}

// Test database connection before starting server
async function startServer() {
  try {
    // Test database connection
    await pool.query('SELECT NOW()');
    console.log('✅ Database connection successful');
    await ensureDefaultAdminAccount();

    // Start server
    app.listen(PORT, HOST, () => {
      console.log('=================================');
      console.log('🚀 Nisit Deeden System Server');
      console.log('=================================');
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`Server running at: http://${HOST}:${PORT}`);
      console.log(`Health check: http://${HOST}:${PORT}/api/health`);
      console.log('=================================');
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received: closing HTTP server');
  await pool.end();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT signal received: closing HTTP server');
  await pool.end();
  process.exit(0);
});

// Start the server
startServer();

