/**
 * Database Migration Script
 * Run all SQL migrations in order
 */

const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();
const { pool } = require('../src/config/database');

async function runMigrations() {
  console.log('🚀 Starting database migrations...\n');
  
  const migrationsDir = path.join(__dirname, '../migrations');
  
  try {
    // Read all migration files
    const files = await fs.readdir(migrationsDir);
    const sqlFiles = files
      .filter(f => f.endsWith('.sql'))
      .sort(); // Run in order
    
    console.log(`Found ${sqlFiles.length} migration files\n`);
    
    for (const file of sqlFiles) {
      console.log(`📄 Running: ${file}`);
      
      const filePath = path.join(migrationsDir, file);
      const sql = await fs.readFile(filePath, 'utf8');
      
      try {
        await pool.query(sql);
        console.log(`   ✅ Success\n`);
      } catch (error) {
        console.error(`   ❌ Error: ${error.message}\n`);
        throw error;
      }
    }
    
    console.log('✅ All migrations completed successfully!');
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    await pool.end();
    process.exit(1);
  }
}

// Run migrations
runMigrations();
