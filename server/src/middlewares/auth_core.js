/**
 * Authentication Core Module for Nisit Deeden System
 * Supports KU SSO Authentication (@ku.th / @live.ku.th)
 * Install ts in dependencies: npm install express express-session pg dotenv
 */

import express from "express";
import pg from "pg";
import dotenv from "dotenv";
import { hashpw, checkpw, gensalt } from "./ripcrypt.js";

dotenv.config();
const router = express.Router();

/* --------------------
   Database connection
-------------------- */
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

/* --------------------
   Helpers
-------------------- */
function validateKuEmail(email) {
  const kuPattern = /^[a-zA-Z0-9._%+-]+@(ku\.th|live\.ku\.th)$/;
  return kuPattern.test(email);
}

/* Get user roles from user_roles and roles tables */
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

/* Get primary role (first role or most important) */
function getPrimaryRole(roles) {
  const roleHierarchy = [
    "ADMIN",
    "DEAN",
    "SUB_DEAN",
    "COMMITTEE_PRESIDENT",
    "COMMITTEE",
    "STAFF",
    "STUDENT"
  ];
  
  for (const role of roleHierarchy) {
    if (roles.includes(role)) {
      return role;
    }
  }
  return "STUDENT";
}

/* URL redirect based on role */
function getRedirectUrl(role) {
  const roleRoutes = {
    STUDENT: "/student/student_dashboard",
    STAFF: "/staff/staff_dashboard",
    SUB_DEAN: "/subdean/subdean_dashboard",
    DEAN: "/dean/dean_dashboard",
    ADMIN: "/admin/admin_dashboard",
    COMMITTEE: "/committee/committee_dashboard",
    COMMITTEE_PRESIDENT: "/committee_president/president_dashboard",
  };
  return roleRoutes[role] || "/login";
}

/* --------------------
   Routes
-------------------- */

// GET /login
router.get("/login", (req, res) => {
  if (req.session.user_id) {
    return res.redirect(getRedirectUrl(req.session.primary_role));
  }
  return res.json({
    message: "Login page",
    note: "This should render login.html template",
  });
});

// POST /api/login
router.post("/api/login", async (req, res) => {
  const { email = "", password = "" } = req.body;
  const emailNorm = email.trim().toLowerCase();

  if (!emailNorm || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }

  if (!validateKuEmail(emailNorm)) {
    return res.status(400).json({
      message: "Please use a valid KU email (@ku.th or @live.ku.th)",
    });
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT * FROM users WHERE email = $1',
      [emailNorm]
    );
    const user = result.rows[0];

    if (!user) {
      return res
        .status(404)
        .json({ message: "User not found. Please register first." });
    }

    // Check if user has password (not SSO-only account)
    if (!user.password_hash) {
      return res.status(400).json({
        message: "This account uses SSO login only. Please login via KU SSO.",
      });
    }

    if (!checkpw(password, user.password_hash)) {
      return res.status(401).json({ message: "Incorrect password" });
    }

    // Get user roles
    const roles = await getUserRoles(client, user.id);
    if (roles.length === 0) {
      return res.status(403).json({
        message: "No roles assigned. Please contact admin.",
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
      message: "Login successful",
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
  } catch (e) {
    return res.status(500).json({ message: `Login error: ${e.message}` });
  } finally {
    client.release();
  }
});

// POST /api/register
router.post("/api/register", async (req, res) => {
  const {
    email = "",
    password = "",
    fullname = "",
    ku_id = "",
    department = "",
    faculty = "",
  } = req.body;

  const emailNorm = email.trim().toLowerCase();

  if (!emailNorm || !password || !fullname) {
    return res.status(400).json({
      message: "Email, password, and full name are required",
    });
  }

  if (!validateKuEmail(emailNorm)) {
    return res.status(400).json({
      message: "Please use a valid KU email (@ku.th or @live.ku.th)",
    });
  }

  if (password.length < 8) {
    return res
      .status(400)
      .json({ message: "Password must be at least 8 characters" });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Check if email already exists
    const exists = await client.query(
      'SELECT id FROM users WHERE email = $1',
      [emailNorm]
    );

    if (exists.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ message: "Email already registered" });
    }

    // Hash password
    const salt = gensalt();
    const passwordHash = hashpw(password, salt);

    // Insert user
    const userResult = await client.query(
      `INSERT INTO users
      (ku_id, email, fullname, faculty, department, password_hash, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
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
      await client.query('ROLLBACK');
      return res.status(500).json({
        message: "STUDENT role not found in database. Please contact admin.",
      });
    }

    const studentRoleId = roleResult.rows[0].id;

    // Assign STUDENT role to new user
    await client.query(
      'INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)',
      [newUserId, studentRoleId]
    );

    await client.query('COMMIT');

    return res.status(201).json({
      message: "Registration successful",
      user_id: newUserId,
    });
  } catch (e) {
    await client.query('ROLLBACK');
    return res.status(500).json({
      message: `Registration error: ${e.message}`,
    });
  } finally {
    client.release();
  }
});

// POST /api/ku-sso-callback
router.post("/api/ku-sso-callback", async (req, res) => {
  const { sso_token, email = "", fullname, ku_id, faculty, department } = req.body;
  const emailNorm = email.trim().toLowerCase();

  if (!sso_token || !emailNorm) {
    return res.status(400).json({ message: "Invalid SSO data" });
  }

  if (!validateKuEmail(emailNorm)) {
    return res.status(400).json({ message: "Invalid KU email" });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Check if user exists
    const result = await client.query(
      'SELECT * FROM users WHERE email = $1',
      [emailNorm]
    );

    let user = result.rows[0];

    if (!user) {
      // Create new user via SSO
      const insertResult = await client.query(
        `INSERT INTO users
        (ku_id, email, fullname, faculty, department, sso_enabled, created_at)
        VALUES ($1, $2, $3, $4, $5, true, NOW())
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
        await client.query('ROLLBACK');
        return res.status(500).json({
          message: "STUDENT role not found. Please contact admin.",
        });
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
    } else {
      // Update last login
      await client.query(
        'UPDATE users SET last_login=NOW(), sso_enabled=true WHERE id=$1',
        [user.id]
      );
    }

    // Get user roles
    const roles = await getUserRoles(client, user.id);
    if (roles.length === 0) {
      await client.query('ROLLBACK');
      return res.status(403).json({
        message: "No roles assigned. Please contact admin.",
      });
    }

    const primaryRole = getPrimaryRole(roles);

    await client.query('COMMIT');

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
      message: "SSO login successful",
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
  } catch (e) {
    await client.query('ROLLBACK');
    return res.status(500).json({
      message: `SSO authentication error: ${e.message}`,
    });
  } finally {
    client.release();
  }
});

// GET /logout
router.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/login");
  });
});

// GET /api/check-auth
router.get("/api/check-auth", (req, res) => {
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

// POST /api/change-password
router.post("/api/change-password", async (req, res) => {
  if (!req.session.user_id) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const { current_password = "", new_password = "" } = req.body;

  if (!current_password || !new_password) {
    return res.status(400).json({
      message: "Current and new password are required",
    });
  }

  if (new_password.length < 8) {
    return res.status(400).json({
      message: "New password must be at least 8 characters",
    });
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT password_hash FROM users WHERE id=$1',
      [req.session.user_id]
    );

    const user = result.rows[0];

    if (!user || !user.password_hash) {
      return res
        .status(404)
        .json({ message: "User not found or SSO-only account" });
    }

    if (!checkpw(current_password, user.password_hash)) {
      return res
        .status(401)
        .json({ message: "Current password is incorrect" });
    }

    const salt = gensalt();
    const newHash = hashpw(new_password, salt);

    await client.query(
      'UPDATE users SET password_hash=$1 WHERE id=$2',
      [newHash, req.session.user_id]
    );

    return res
      .status(200)
      .json({ message: "Password changed successfully" });
  } catch (e) {
    return res.status(500).json({
      message: `Error changing password: ${e.message}`,
    });
  } finally {
    client.release();
  }
});

// POST /api/request-password-reset
router.post("/api/request-password-reset", async (req, res) => {
  const { email = "" } = req.body;
  const emailNorm = email.trim().toLowerCase();

  if (!emailNorm || !validateKuEmail(emailNorm)) {
    return res
      .status(400)
      .json({ message: "Valid KU email is required" });
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT id FROM users WHERE email=$1',
      [emailNorm]
    );

    if (!result.rows[0]) {
      // Don't reveal if email exists or not for security
      return res.status(200).json({
        message: "If email exists, reset link has been sent",
      });
    }

    // TODO: Generate reset token and send email
    // For now, just return success message

    return res.status(200).json({
      message: "Password reset link sent to your email",
    });
  } catch (e) {
    return res.status(500).json({ message: `Error: ${e.message}` });
  } finally {
    client.release();
  }
});

export default router;