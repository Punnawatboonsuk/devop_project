/**
 * Authentication Core Module
 * Supports KU SSO Authentication (@ku.th / @live.ku.th)
 * Merged from original code + enhancements
 */

const express = require('express');
const { pool, transaction } = require('../config/database');
const { hashpw, checkpw, gensalt } = require('../utils/ripcrypt');

const router = express.Router();

/* ==================== Helpers ==================== */

/**
 * Validate KU email format
 */
function validateKuEmail(email) {
  const kuPattern = /^[a-zA-Z0-9._%+-]+@(ku\.th|live\.ku\.th)$/;
  return kuPattern.test(email);
}

/**
 * Get user roles from database
 */
async function getUserRoles(client, userId) {
  const result = await client.query(
    `SELECT r.name 
     FROM user_roles ur 
     JOIN roles r ON ur.role_id = r.id 
     WHERE ur.user_id = $1`,
    [userId]
  );
  return result.rows.map(row => row.name);
}

/**
 * Get primary role (highest priority)
 */
function getPrimaryRole(roles) {
  const roleHierarchy = [
    'ADMIN',
    'COMMITTEE_PRESIDENT',
    'DEAN',
    'SUB_DEAN',
    'COMMITTEE',
    'STAFF',
    'STUDENT'
  ];
  
  for (const role of roleHierarchy) {
    if (roles.includes(role)) {
      return role;
    }
  }
  return 'STUDENT';
}

/**
 * Get redirect URL based on role
 */
function getRedirectUrl(role) {
  const roleRoutes = {
    STUDENT: '/student/dashboard',
    STAFF: '/staff/dashboard',
    SUB_DEAN: '/subdean/dashboard',
    DEAN: '/dean/dashboard',
    ADMIN: '/admin/dashboard',
    COMMITTEE: '/committee/dashboard',
    COMMITTEE_PRESIDENT: '/president/dashboard',
  };
  return roleRoutes[role] || '/login';
}

/**
 * Create audit log
 */
async function createAuditLog(client, userId, action, data = {}) {
  await client.query(
    `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, new_values)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, action, data.resourceType, data.resourceId, JSON.stringify(data.newValues)]
  );
}

/* ==================== Routes ==================== */

/**
 * GET /api/auth/login
 * Show login page info
 */
router.get('/login', (req, res) => {
  if (req.session.user_id) {
    return res.redirect(getRedirectUrl(req.session.primary_role));
  }
  return res.json({
    message: 'Login page',
    methods: ['password', 'ku_sso'],
  });
});

/**
 * POST /api/auth/login
 * Login with email + password
 */
router.post('/login', async (req, res) => {
  const { email = '', password = '' } = req.body;
  const emailNorm = email.trim().toLowerCase();

  if (!emailNorm || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  if (!validateKuEmail(emailNorm)) {
    return res.status(400).json({
      message: 'Please use a valid KU email (@ku.th or @live.ku.th)',
    });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const result = await client.query(
      'SELECT * FROM users WHERE email = $1',
      [emailNorm]
    );
    const user = result.rows[0];

    if (!user) {
      await client.query('ROLLBACK');
      return res.status(404).json({ 
        message: 'User not found. Please register first.' 
      });
    }

    // Check if user has password (not SSO-only account)
    if (!user.password_hash) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        message: 'This account uses SSO login only. Please login via KU SSO.',
      });
    }

    if (!checkpw(password, user.password_hash)) {
      await client.query('ROLLBACK');
      return res.status(401).json({ message: 'Incorrect password' });
    }

    // Get user roles
    const roles = await getUserRoles(client, user.id);
    if (roles.length === 0) {
      await client.query('ROLLBACK');
      return res.status(403).json({
        message: 'No roles assigned. Please contact admin.',
      });
    }

    const primaryRole = getPrimaryRole(roles);

    // Update password hash with new salt and update last login
    const salt = gensalt();
    const newHash = hashpw(password, salt);

    await client.query(
      'UPDATE users SET password_hash=$1, last_login=NOW() WHERE id=$2',
      [newHash, user.id]
    );

    // Create audit log
    await createAuditLog(client, user.id, 'user_login', {
      newValues: { method: 'password', ip: req.ip }
    });

    await client.query('COMMIT');

    // Set session
    req.session.user_id = user.id;
    req.session.email = user.email;
    req.session.fullname = user.fullname;
    req.session.ku_id = user.ku_id;
    req.session.faculty = user.faculty;
    req.session.department = user.department;
    req.session.roles = roles;
    req.session.primary_role = primaryRole;

    return res.status(200).json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        fullname: user.fullname,
        ku_id: user.ku_id,
        faculty: user.faculty,
        department: user.department,
        roles: roles,
        primary_role: primaryRole,
      },
      redirect: getRedirectUrl(primaryRole),
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Login error:', error);
    return res.status(500).json({ message: `Login error: ${error.message}` });
  } finally {
    client.release();
  }
});

/**
 * POST /api/auth/register
 * Register new user (auto-assign STUDENT role)
 */
router.post('/register', async (req, res) => {
  const {
    email = '',
    password = '',
    fullname = '',
    ku_id = '',
    department = '',
    faculty = '',
  } = req.body;

  const emailNorm = email.trim().toLowerCase();

  if (!emailNorm || !password || !fullname) {
    return res.status(400).json({
      message: 'Email, password, and full name are required',
    });
  }

  if (!validateKuEmail(emailNorm)) {
    return res.status(400).json({
      message: 'Please use a valid KU email (@ku.th or @live.ku.th)',
    });
  }

  if (password.length < 8) {
    return res.status(400).json({ 
      message: 'Password must be at least 8 characters' 
    });
  }

  try {
    const result = await transaction(async (client) => {
      // Check if email already exists
      const exists = await client.query(
        'SELECT id FROM users WHERE email = $1',
        [emailNorm]
      );

      if (exists.rows.length > 0) {
        throw new Error('Email already registered');
      }

      // Hash password
      const salt = gensalt();
      const passwordHash = hashpw(password, salt);

      // Insert user
      const userResult = await client.query(
        `INSERT INTO users
        (ku_id, email, fullname, faculty, department, password_hash)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id`,
        [ku_id, emailNorm, fullname, faculty, department, passwordHash]
      );

      const newUserId = userResult.rows[0].id;

      // Get STUDENT role id
      const roleResult = await client.query(
        'SELECT id FROM roles WHERE name = $1',
        ['STUDENT']
      );

      if (roleResult.rows.length === 0) {
        throw new Error('STUDENT role not found in database');
      }

      const studentRoleId = roleResult.rows[0].id;

      // Assign STUDENT role
      await client.query(
        'INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)',
        [newUserId, studentRoleId]
      );

      // Create audit log
      await createAuditLog(client, newUserId, 'user_register', {
        resourceType: 'user',
        resourceId: newUserId,
        newValues: { email: emailNorm, fullname, method: 'password' }
      });

      return newUserId;
    });

    return res.status(201).json({
      message: 'Registration successful',
      user_id: result,
    });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({
      message: error.message || 'Registration error',
    });
  }
});

/**
 * POST /api/auth/ku-sso-callback
 * Handle KU SSO authentication callback
 */
router.post('/ku-sso-callback', async (req, res) => {
  const { sso_token, email = '', fullname, ku_id, faculty, department } = req.body;
  const emailNorm = email.trim().toLowerCase();

  if (!sso_token || !emailNorm) {
    return res.status(400).json({ message: 'Invalid SSO data' });
  }

  if (!validateKuEmail(emailNorm)) {
    return res.status(400).json({ message: 'Invalid KU email' });
  }

  try {
    const result = await transaction(async (client) => {
      // Check if user exists
      const userResult = await client.query(
        'SELECT * FROM users WHERE email = $1',
        [emailNorm]
      );

      let user = userResult.rows[0];

      if (!user) {
        // Create new user via SSO
        const insertResult = await client.query(
          `INSERT INTO users
          (ku_id, email, fullname, faculty, department, sso_enabled)
          VALUES ($1, $2, $3, $4, $5, true)
          RETURNING id`,
          [ku_id, emailNorm, fullname, faculty, department]
        );

        const newUserId = insertResult.rows[0].id;

        // Get STUDENT role
        const roleResult = await client.query(
          'SELECT id FROM roles WHERE name = $1',
          ['STUDENT']
        );

        if (roleResult.rows.length === 0) {
          throw new Error('STUDENT role not found');
        }

        // Assign STUDENT role
        await client.query(
          'INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)',
          [newUserId, roleResult.rows[0].id]
        );

        // Fetch the newly created user
        const newUserResult = await client.query(
          'SELECT * FROM users WHERE id = $1',
          [newUserId]
        );
        user = newUserResult.rows[0];

        // Create audit log
        await createAuditLog(client, newUserId, 'user_register', {
          resourceType: 'user',
          resourceId: newUserId,
          newValues: { email: emailNorm, fullname, method: 'ku_sso' }
        });
      } else {
        // Update last login and SSO status
        await client.query(
          'UPDATE users SET last_login=NOW(), sso_enabled=true WHERE id=$1',
          [user.id]
        );

        // Create audit log
        await createAuditLog(client, user.id, 'user_login', {
          newValues: { method: 'ku_sso', ip: req.ip }
        });
      }

      // Get user roles
      const roles = await getUserRoles(client, user.id);
      if (roles.length === 0) {
        throw new Error('No roles assigned');
      }

      return { user, roles };
    });

    const { user, roles } = result;
    const primaryRole = getPrimaryRole(roles);

    // Set session
    req.session.user_id = user.id;
    req.session.email = emailNorm;
    req.session.fullname = fullname || user.fullname;
    req.session.ku_id = ku_id || user.ku_id;
    req.session.faculty = faculty || user.faculty;
    req.session.department = department || user.department;
    req.session.roles = roles;
    req.session.primary_role = primaryRole;
    req.session.sso_authenticated = true;

    return res.status(200).json({
      message: 'SSO login successful',
      user: {
        id: user.id,
        email: emailNorm,
        fullname: req.session.fullname,
        ku_id: req.session.ku_id,
        faculty: req.session.faculty,
        department: req.session.department,
        roles: roles,
        primary_role: primaryRole,
      },
      redirect: getRedirectUrl(primaryRole),
    });
  } catch (error) {
    console.error('SSO error:', error);
    return res.status(500).json({
      message: error.message || 'SSO authentication error',
    });
  }
});

/**
 * POST /api/auth/logout
 * Logout user
 */
router.post('/logout', (req, res) => {
  const userId = req.session.user_id;
  
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ message: 'Logout failed' });
    }
    
    // Log logout action (async, don't wait)
    if (userId) {
      pool.query(
        `INSERT INTO audit_logs (user_id, action) VALUES ($1, $2)`,
        [userId, 'user_logout']
      ).catch(console.error);
    }
    
    res.json({ message: 'Logged out successfully' });
  });
});

/**
 * GET /api/auth/me
 * Get current user info
 */
router.get('/me', (req, res) => {
  if (!req.session.user_id) {
    return res.status(401).json({ authenticated: false });
  }

  return res.status(200).json({
    authenticated: true,
    user: {
      id: req.session.user_id,
      email: req.session.email,
      fullname: req.session.fullname,
      ku_id: req.session.ku_id,
      faculty: req.session.faculty,
      department: req.session.department,
      roles: req.session.roles,
      primary_role: req.session.primary_role,
    },
  });
});

/**
 * POST /api/auth/change-password
 * Change user password
 */
router.post('/change-password', async (req, res) => {
  if (!req.session.user_id) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const { current_password = '', new_password = '' } = req.body;

  if (!current_password || !new_password) {
    return res.status(400).json({
      message: 'Current and new password are required',
    });
  }

  if (new_password.length < 8) {
    return res.status(400).json({
      message: 'New password must be at least 8 characters',
    });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const result = await client.query(
      'SELECT password_hash FROM users WHERE id=$1',
      [req.session.user_id]
    );

    const user = result.rows[0];

    if (!user || !user.password_hash) {
      await client.query('ROLLBACK');
      return res.status(404).json({ 
        message: 'User not found or SSO-only account' 
      });
    }

    if (!checkpw(current_password, user.password_hash)) {
      await client.query('ROLLBACK');
      return res.status(401).json({ 
        message: 'Current password is incorrect' 
      });
    }

    const salt = gensalt();
    const newHash = hashpw(new_password, salt);

    await client.query(
      'UPDATE users SET password_hash=$1 WHERE id=$2',
      [newHash, req.session.user_id]
    );

    // Create audit log
    await createAuditLog(client, req.session.user_id, 'admin_action', {
      resourceType: 'user',
      resourceId: req.session.user_id,
      newValues: { action: 'password_change' }
    });

    await client.query('COMMIT');

    return res.status(200).json({ 
      message: 'Password changed successfully' 
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Change password error:', error);
    return res.status(500).json({
      message: `Error changing password: ${error.message}`,
    });
  } finally {
    client.release();
  }
});

module.exports = router;
