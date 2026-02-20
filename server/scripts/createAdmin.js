/**
 * Create Admin User Script
 * Creates a default admin user or resets admin password
 */

const readline = require('readline');
require('dotenv').config();
const { pool, transaction } = require('../src/config/database');
const { hashpw, gensalt } = require('../src/utils/ripcrypt');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function createAdmin() {
  console.log('🔐 Create/Reset Admin User\n');
  
  try {
    const email = await question('Admin email (@ku.th or @live.ku.th): ');
    const emailNorm = email.trim().toLowerCase();
    
    if (!/^[a-zA-Z0-9._%+-]+@(ku\.th|live\.ku\.th)$/.test(emailNorm)) {
      console.error('❌ Invalid KU email format');
      process.exit(1);
    }
    
    const password = await question('Admin password (min 8 characters): ');
    
    if (password.length < 8) {
      console.error('❌ Password must be at least 8 characters');
      process.exit(1);
    }
    
    const fullname = await question('Full name: ');
    
    // Hash password
    const salt = gensalt();
    const passwordHash = hashpw(password, salt);
    
    const result = await transaction(async (client) => {
      // Check if user exists
      const userResult = await client.query(
        'SELECT id FROM users WHERE email = $1',
        [emailNorm]
      );
      
      let userId;
      
      if (userResult.rows.length > 0) {
        // Update existing user
        userId = userResult.rows[0].id;
        await client.query(
          'UPDATE users SET password_hash = $1, fullname = $2 WHERE id = $3',
          [passwordHash, fullname, userId]
        );
        console.log('\n✅ Admin user password reset');
      } else {
        // Create new user
        const insertResult = await client.query(
          `INSERT INTO users (email, password_hash, fullname)
           VALUES ($1, $2, $3)
           RETURNING id`,
          [emailNorm, passwordHash, fullname]
        );
        userId = insertResult.rows[0].id;
        console.log('\n✅ Admin user created');
      }
      
      // Get ADMIN role
      const roleResult = await client.query(
        'SELECT id FROM roles WHERE name = $1',
        ['ADMIN']
      );
      
      if (roleResult.rows.length === 0) {
        throw new Error('ADMIN role not found. Run migrations first!');
      }
      
      const adminRoleId = roleResult.rows[0].id;
      
      // Assign ADMIN role (if not already assigned)
      await client.query(
        `INSERT INTO user_roles (user_id, role_id)
         VALUES ($1, $2)
         ON CONFLICT (user_id, role_id) DO NOTHING`,
        [userId, adminRoleId]
      );
      
      return { userId, email: emailNorm };
    });
    
    console.log(`\n📧 Email: ${result.email}`);
    console.log(`🆔 User ID: ${result.userId}`);
    console.log('\n🎉 Admin user is ready!');
    
    await pool.end();
    rl.close();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    await pool.end();
    rl.close();
    process.exit(1);
  }
}

createAdmin();
