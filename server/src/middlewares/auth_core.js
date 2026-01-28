/**
 * Authentication Core Module for Nisit Deeden System
 * Supports KU SSO Authentication (@ku.th / @live.ku.th)
 * Install ts in dependency: npm install express express-session pg dotenv
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

/* URL ยังไม่เสร็จ ให้เขาของจริงมาใส่ */  
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
    return res.redirect(getRedirectUrl(req.session.role));
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
      'SELECT * FROM "Users" WHERE email = $1',
      [emailNorm]
    );
    const user = result.rows[0];

    if (!user) {
      return res
        .status(404)
        .json({ message: "User not found. Please register first." });
    }

    if (user.account_status !== 1) {
      return res.status(403).json({
        message: "Your account is inactive. Please contact admin.",
      });
    }

    if (!checkpw(password, user.password_hash)) {
      return res.status(401).json({ message: "Incorrect password" });
    }

    const salt = gensalt();
    const newHash = hashpw(password, salt);

    await client.query(
      'UPDATE "Users" SET password_hash=$1, last_login=NOW() WHERE user_id=$2',
      [newHash, user.user_id]
    );

    req.session.user_id = user.user_id;
    req.session.email = user.email;
    req.session.role = user.role;
    req.session.full_name = user.full_name;

    return res.status(200).json({
      message: "Login successful",
      user: {
        user_id: user.user_id,
        email: user.email,
        role: user.role,
        full_name: user.full_name,
      },
      redirect: getRedirectUrl(user.role),
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
    full_name = "",
    student_id = "",
    department = "",
    faculty = "",
  } = req.body;

  const emailNorm = email.trim().toLowerCase();

  if (!emailNorm || !password || !full_name) {
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
    const exists = await client.query(
      'SELECT user_id FROM "Users" WHERE email = $1',
      [emailNorm]
    );

    if (exists.rows.length > 0) {
      return res.status(409).json({ message: "Email already registered" });
    }

    const role = "STUDENT";
    const salt = gensalt();
    const passwordHash = hashpw(password, salt);

    const result = await client.query(
      `INSERT INTO "Users"
      (email, password_hash, role, full_name, student_id, department, faculty, account_status, created_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())
      RETURNING user_id`,
      [
        emailNorm,
        passwordHash,
        role,
        full_name,
        student_id,
        department,
        faculty,
        1,
      ]
    );

    return res.status(201).json({
      message: "Registration successful",
      user_id: result.rows[0].user_id,
    });
  } catch (e) {
    return res.status(500).json({
      message: `Registration error: ${e.message}`,
    });
  } finally {
    client.release();
  }
});

// POST /api/ku-sso-callback
router.post("/api/ku-sso-callback", async (req, res) => {
  const { sso_token, email = "", full_name, student_id } = req.body;
  const emailNorm = email.trim().toLowerCase();

  if (!sso_token || !emailNorm) {
    return res.status(400).json({ message: "Invalid SSO data" });
  }

  if (!validateKuEmail(emailNorm)) {
    return res.status(400).json({ message: "Invalid KU email" });
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT * FROM "Users" WHERE email = $1',
      [emailNorm]
    );

    let user = result.rows[0];

    if (!user) {
      const created = await client.query(
        `INSERT INTO "Users"
        (email, role, full_name, student_id, account_status, sso_enabled, created_at, last_login)
        VALUES ($1,$2,$3,$4,$5,$6,NOW(),NOW())
        RETURNING user_id, role, account_status, full_name`,
        [emailNorm, "STUDENT", full_name, student_id, 1, true]
      );
      user = created.rows[0];
    } else {
      await client.query(
        'UPDATE "Users" SET last_login=NOW() WHERE user_id=$1',
        [user.user_id]
      );
    }

    if (user.account_status !== 1) {
      return res.status(403).json({ message: "Account is inactive" });
    }

    req.session.user_id = user.user_id;
    req.session.email = emailNorm;
    req.session.role = user.role;
    req.session.full_name = full_name || user.full_name;
    req.session.sso_authenticated = true;

    return res.status(200).json({
      message: "SSO login successful",
      user: {
        user_id: user.user_id,
        email: emailNorm,
        role: user.role,
        full_name: req.session.full_name,
      },
      redirect: getRedirectUrl(user.role),
    });
  } catch (e) {
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
      user_id: req.session.user_id,
      email: req.session.email,
      role: req.session.role,
      full_name: req.session.full_name,
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
      'SELECT password_hash FROM "Users" WHERE user_id=$1',
      [req.session.user_id]
    );

    const user = result.rows[0];

    if (!user || !user.password_hash) {
      return res
        .status(404)
        .json({ message: "User not found or SSO account" });
    }

    if (!checkpw(current_password, user.password_hash)) {
      return res
        .status(401)
        .json({ message: "Current password is incorrect" });
    }

    const salt = gensalt();
    const newHash = hashpw(new_password, salt);

    await client.query(
      'UPDATE "Users" SET password_hash=$1 WHERE user_id=$2',
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
      'SELECT user_id FROM "Users" WHERE email=$1',
      [emailNorm]
    );

    if (!result.rows[0]) {
      return res.status(200).json({
        message: "If email exists, reset link has been sent",
      });
    }

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
