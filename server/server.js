/**
 * Server Entry Point
 * Nisit Deeden System - Outstanding Student Selection
 */

require('dotenv').config();
const app = require('./app');
const { pool } = require('./src/config/database');

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

// Test database connection before starting server
async function startServer() {
  try {
    // Test database connection
    await pool.query('SELECT NOW()');
    console.log('✅ Database connection successful');

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