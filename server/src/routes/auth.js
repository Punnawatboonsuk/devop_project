/**
 * Authentication Core Module
 * Supports KU SSO Authentication (@ku.th / @live.ku.th)
 * Merged from original code + enhancements
 */

const express = require('express');
const { pool, transaction } = require('../config/database');
const { hashpw, checkpw, gensalt } = require('../utils/ripcrypt');
const passport = require('../config/passport');

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
    SUB_DEAN: '/staff/dashboard',
    DEAN: '/staff/dashboard',
    ADMIN: '/admin/verification',
    COMMITTEE: '/committee/dashboard',
    COMMITTEE_PRESIDENT: '/president/proclaim',
  };
  return roleRoutes[role] || '/login';
}

/**
 * Build absolute frontend URL from a route path
 */
function toFrontendUrl(routePath) {
  const frontendBase = (process.env.FRONTEND_URL || process.env.CORS_ORIGIN || 'http://localhost:5173').replace(/\/+$/, '');
  const safePath = typeof routePath === 'string' && routePath.startsWith('/') ? routePath : '/login';
  return `${frontendBase}${safePath}`;
}

/**
 * Sync Passport-authenticated user into app session fields expected by /api/auth/me and protected APIs
 */
function setSessionFromUser(req, user) {
  req.session.user_id = user.id;
  req.session.email = user.email || null;
  req.session.fullname = user.fullname || null;
  req.session.ku_id = user.ku_id || null;
  req.session.faculty = user.faculty || null;
  req.session.department = user.department || null;
  req.session.roles = user.roles || [];
  req.session.primary_role = user.primary_role || getPrimaryRole(user.roles || []);
  req.session.sso_authenticated = true;
}

function needsProfileCompletionFromSession(req) {
  const missingProfile =
    !req.session.ku_id ||
    !req.session.faculty ||
    !req.session.department;

  return (
    req.session.sso_authenticated === true &&
    req.session.primary_role === 'STUDENT' &&
    missingProfile
  );
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
        needs_profile_completion: false,
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

    const redirectUrl = needsProfileCompletionFromSession(req)
      ? '/auth/sso-setup'
      : getRedirectUrl(primaryRole);

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
        needs_profile_completion: needsProfileCompletionFromSession(req),
      },
      redirect: redirectUrl,
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

  const needsProfileCompletion = needsProfileCompletionFromSession(req);

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
      needs_profile_completion: needsProfileCompletion,
    },
  });
});

/**
 * GET /api/auth/phase
 * Get current system phase (public endpoint for all authenticated users)
 * Used by student dashboard to determine if apply button should be shown
 */
router.get('/phase', async (req, res) => {
  try {
    const client = await pool.connect();
    try {
      const result = await client.query(
        'SELECT phase FROM system_phase WHERE id = 1',
        []
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ 
          message: 'System phase not initialized',
          phase: null
        });
      }

      return res.status(200).json({
        phase: result.rows[0].phase
      });

    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Get current phase error:', error);
    res.status(500).json({ 
      message: 'Error fetching current phase',
      phase: null
    });
  }
});

/**
 * POST /api/auth/complete-profile
 * Complete required profile fields for SSO student accounts
 */
router.post('/complete-profile', async (req, res) => {
  if (!req.session.user_id) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  if (req.session.primary_role !== 'STUDENT') {
    return res.status(403).json({ message: 'Only student accounts can complete this profile' });
  }

  const { ku_id = '', faculty = '', department = '' } = req.body;
  const kuId = ku_id.trim();
  const facultyValue = faculty.trim();
  const departmentValue = department.trim();

  if (!kuId || !facultyValue || !departmentValue) {
    return res.status(400).json({
      message: 'KU ID, faculty, and department are required',
    });
  }

  const client = await pool.connect();
  try {
    await client.query(
      `UPDATE users
       SET ku_id = $1,
           faculty = $2,
           department = $3
       WHERE id = $4`,
      [kuId, facultyValue, departmentValue, req.session.user_id]
    );

    req.session.ku_id = kuId;
    req.session.faculty = facultyValue;
    req.session.department = departmentValue;

    return res.status(200).json({
      message: 'Profile completed successfully',
      user: {
        id: req.session.user_id,
        email: req.session.email,
        fullname: req.session.fullname,
        ku_id: req.session.ku_id,
        faculty: req.session.faculty,
        department: req.session.department,
        roles: req.session.roles,
        primary_role: req.session.primary_role,
        needs_profile_completion: needsProfileCompletionFromSession(req),
      },
      redirect: getRedirectUrl(req.session.primary_role),
    });
  } catch (error) {
    console.error('Complete profile error:', error);
    return res.status(500).json({ message: 'Failed to complete profile' });
  } finally {
    client.release();
  }
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

/* ==================== Google OAuth Routes ==================== */

/**
 * GET /api/auth/google
 * Initiate Google OAuth flow
 */
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

/**
 * GET /api/auth/google/callback
 * Handle Google OAuth callback
 */
router.get('/google/callback', 
  passport.authenticate('google', { 
    failureRedirect: toFrontendUrl('/login?error=google_auth_failed'),
    session: true
  }),
  (req, res) => {
    const user = req.user;
    setSessionFromUser(req, user);
    const roleRedirect = needsProfileCompletionFromSession(req)
      ? '/auth/sso-setup'
      : getRedirectUrl(user.primary_role);
    const oauthCallbackPath = (
      typeof req.session.oauth_redirect === 'string' &&
      req.session.oauth_redirect.startsWith('/')
    ) ? req.session.oauth_redirect : null;

    delete req.session.oauth_redirect;

    if (oauthCallbackPath) {
      const callbackUrl = new URL(toFrontendUrl(oauthCallbackPath));
      callbackUrl.searchParams.set('next', roleRedirect);
      return res.redirect(callbackUrl.toString());
    }

    return res.redirect(toFrontendUrl(roleRedirect));
  }
);

/**
 * GET /api/auth/google-login
 * API endpoint to initiate Google OAuth for frontend
 */
router.get('/google-login', (req, res) => {
  // Store the original URL to redirect back after OAuth
  if (req.query.redirect) {
    req.session.oauth_redirect = req.query.redirect;
  }
  
  // Initiate Google OAuth
  res.redirect('/api/auth/google');
});

/**
 * GET /api/auth/google-callback
 * Handle Google OAuth callback for API
 */
router.get('/google-callback', 
  passport.authenticate('google', { 
    failureRedirect: toFrontendUrl('/login?error=google_auth_failed'),
    session: true
  }),
  (req, res) => {
    const user = req.user;
    setSessionFromUser(req, user);
    const roleRedirect = needsProfileCompletionFromSession(req)
      ? '/auth/sso-setup'
      : getRedirectUrl(user.primary_role);
    const oauthCallbackPath = (
      typeof req.session.oauth_redirect === 'string' &&
      req.session.oauth_redirect.startsWith('/')
    ) ? req.session.oauth_redirect : null;

    delete req.session.oauth_redirect;

    if (oauthCallbackPath) {
      const callbackUrl = new URL(toFrontendUrl(oauthCallbackPath));
      callbackUrl.searchParams.set('next', roleRedirect);
      return res.redirect(callbackUrl.toString());
    }

    return res.redirect(toFrontendUrl(roleRedirect));
  }
);

module.exports = router;
