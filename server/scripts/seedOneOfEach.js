/**
 * Seed One of Each Role
 * Creates or updates exactly one account per role.
 */

require('dotenv').config();
const { pool, transaction } = require('../src/config/database');
const { hashpw, gensalt } = require('../src/utils/ripcrypt');

const DEFAULT_PASSWORD = '123456789';
const DEFAULT_FACULTY = 'คณะวิทยาศาสตร์';
const DEFAULT_DEPARTMENT = 'วิทยาการคอมพิวเตอร์';

const ACCOUNTS = [
  {
    role: 'ADMIN',
    email: 'admin@ku.th',
    fullname: 'ผู้ดูแลระบบ',
    ku_id: null,
    faculty: null,
    department: null
  },
  {
    role: 'COMMITTEE_PRESIDENT',
    email: 'committeepresident@ku.th',
    fullname: 'ประธานกรรมการ',
    ku_id: null,
    faculty: null,
    department: null
  },
  {
    role: 'COMMITTEE',
    email: 'committee@ku.th',
    fullname: 'กรรมการ',
    ku_id: null,
    faculty: null,
    department: null
  },
  {
    role: 'DEAN',
    email: 'dean@ku.th',
    fullname: 'คณบดี',
    ku_id: null,
    faculty: DEFAULT_FACULTY,
    department: DEFAULT_DEPARTMENT
  },
  {
    role: 'SUB_DEAN',
    email: 'subdean@ku.th',
    fullname: 'รองคณบดี',
    ku_id: null,
    faculty: DEFAULT_FACULTY,
    department: DEFAULT_DEPARTMENT
  },
  {
    role: 'STAFF',
    email: 'staff@ku.th',
    fullname: 'เจ้าหน้าที่',
    ku_id: null,
    faculty: DEFAULT_FACULTY,
    department: DEFAULT_DEPARTMENT
  },
  {
    role: 'STUDENT',
    email: 'student@ku.th',
    fullname: 'นิสิตตัวอย่าง',
    ku_id: '6512345678',
    faculty: DEFAULT_FACULTY,
    department: DEFAULT_DEPARTMENT
  }
];

async function seedOneOfEach() {
  try {
    console.log('Seed one account for each role...');

    const salt = gensalt();
    const passwordHash = hashpw(DEFAULT_PASSWORD, salt);

    const result = await transaction(async (client) => {
      const roleRows = await client.query('SELECT id, name FROM roles');
      const roleMap = new Map(roleRows.rows.map((row) => [row.name, row.id]));

      const created = [];
      const updated = [];

      for (const account of ACCOUNTS) {
        const roleId = roleMap.get(account.role);
        if (!roleId) {
          throw new Error(`Role not found: ${account.role}`);
        }

        const email = account.email.toLowerCase();
        const existing = await client.query('SELECT id FROM users WHERE email = $1', [email]);
        let userId;

        if (existing.rows.length > 0) {
          userId = existing.rows[0].id;
          await client.query(
            `UPDATE users
             SET fullname = $1,
                 ku_id = $2,
                 faculty = $3,
                 department = $4,
                 password_hash = $5,
                 sso_enabled = false
             WHERE id = $6`,
            [
              account.fullname,
              account.ku_id,
              account.faculty,
              account.department,
              passwordHash,
              userId
            ]
          );
          updated.push({ email, role: account.role, id: userId });
        } else {
          const insert = await client.query(
            `INSERT INTO users (ku_id, email, fullname, faculty, department, password_hash, sso_enabled)
             VALUES ($1, $2, $3, $4, $5, $6, false)
             RETURNING id`,
            [
              account.ku_id,
              email,
              account.fullname,
              account.faculty,
              account.department,
              passwordHash
            ]
          );
          userId = insert.rows[0].id;
          created.push({ email, role: account.role, id: userId });
        }

        await client.query(
          `INSERT INTO user_roles (user_id, role_id)
           VALUES ($1, $2)
           ON CONFLICT (user_id, role_id) DO NOTHING`,
          [userId, roleId]
        );
      }

      return { created, updated };
    });

    console.log('\nCreated:');
    if (result.created.length === 0) {
      console.log('- none');
    } else {
      result.created.forEach((item) => {
        console.log(`- ${item.email} (${item.role}) id=${item.id}`);
      });
    }

    console.log('\nUpdated:');
    if (result.updated.length === 0) {
      console.log('- none');
    } else {
      result.updated.forEach((item) => {
        console.log(`- ${item.email} (${item.role}) id=${item.id}`);
      });
    }

    console.log(`\nDefault password: ${DEFAULT_PASSWORD}`);
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('\nError:', error.message);
    await pool.end();
    process.exit(1);
  }
}

seedOneOfEach();
