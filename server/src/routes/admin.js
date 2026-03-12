const express = require('express');
const { pool, transaction } = require('../config/database');
const { ROLES, PHASES, TICKET_STATUS, LOG_ACTIONS } = require('../utils/constants');
const { hashpw, gensalt } = require('../utils/ripcrypt');
const {
  getRoundById,
  getRoundByAcademic,
  getOrCreateRound,
  getCurrentPhaseForRound,
  getActiveRound,
  ensureInitialNominationPhase,
  advancePhase
} = require('../services/roundPhase');
const router = express.Router();

/* ==================== Helper Functions ==================== */

/**
 * Check if user is admin
 */
function isAdmin(userRoles) {
  return userRoles.includes(ROLES.ADMIN);
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

async function resolveRound(client, input = {}, { createIfMissing = false } = {}) {
  const roundId = Number.parseInt(input.round_id, 10);
  if (!Number.isNaN(roundId) && roundId > 0) {
    return getRoundById(client, roundId);
  }

  const hasYearInput = input.academic_year !== undefined && input.academic_year !== null && String(input.academic_year).trim() !== '';
  const hasSemesterInput = input.semester !== undefined && input.semester !== null && String(input.semester).trim() !== '';
  const year = Number.parseInt(input.academic_year, 10);
  const semester = Number.parseInt(input.semester, 10);
  if (hasYearInput || hasSemesterInput) {
    if (Number.isNaN(year) || year < 2000 || year > 3000) {
      throw new Error('academic_year must be between 2000 and 3000.');
    }
    if (![1, 2].includes(semester)) {
      throw new Error('semester must be 1 or 2.');
    }
    if (createIfMissing) {
      return getOrCreateRound(client, year, semester);
    }
    return getRoundByAcademic(client, year, semester);
  }

  return getActiveRound(client);
}

function validateKuEmail(email = '') {
  const kuPattern = /^[a-zA-Z0-9._%+-]+@(ku\.th|live\.ku\.th)$/;
  return kuPattern.test(email);
}

async function getCommitteeCount(client) {
  const result = await client.query(
    `SELECT COUNT(DISTINCT ur.user_id)::int AS total
     FROM user_roles ur
     JOIN roles r ON ur.role_id = r.id
     WHERE r.name IN ($1, $2)`,
    [ROLES.COMMITTEE, ROLES.COMMITTEE_PRESIDENT]
  );
  return result.rows[0]?.total || 0;
}

async function getRoundVoteWinners(client, roundId) {
  const totalCommittee = await getCommitteeCount(client);
  const threshold = Math.floor(totalCommittee / 2) + 1;
  if (threshold <= 0) return { winners: [], threshold };

  const result = await client.query(
    `SELECT
       t.id,
       t.award_type,
       t.created_at,
       COUNT(v.id)::int AS total_votes,
       COUNT(CASE WHEN v.vote = 'approved' THEN 1 END)::int AS approved_votes
     FROM tickets t
     LEFT JOIN votes v ON v.ticket_id = t.id
     WHERE t.round_id = $1
       AND t.status = $2
     GROUP BY t.id
     ORDER BY t.award_type ASC, t.created_at ASC`,
    [roundId, TICKET_STATUS.APPROVED]
  );

  const byAward = new Map();
  for (const row of result.rows) {
    if (!byAward.has(row.award_type)) byAward.set(row.award_type, []);
    byAward.get(row.award_type).push({
      id: row.id,
      award_type: row.award_type,
      approved_votes: row.approved_votes || 0,
      total_votes: row.total_votes || 0,
      created_at: row.created_at
    });
  }

  const winners = [];
  for (const [, candidates] of byAward.entries()) {
    const qualified = candidates
      .filter((item) => item.approved_votes >= threshold)
      .sort((a, b) => {
        if (b.approved_votes !== a.approved_votes) {
          return b.approved_votes - a.approved_votes;
        }
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });
    if (qualified.length > 0) {
      winners.push(qualified[0].id);
    }
  }

  return { winners, threshold };
}

async function getCommitteeMembers(client) {
  const result = await client.query(
    `SELECT u.id, u.fullname, u.email, r.name AS role
     FROM users u
     JOIN user_roles ur ON ur.user_id = u.id
     JOIN roles r ON r.id = ur.role_id
     WHERE r.name IN ($1, $2)
     ORDER BY r.name DESC, u.fullname ASC`,
    [ROLES.COMMITTEE_PRESIDENT, ROLES.COMMITTEE]
  );
  return result.rows;
}

const PHASE_FLOW = [
  PHASES.NOMINATION,
  PHASES.REVIEW_END,
  PHASES.VOTING,
  PHASES.VOTING_END,
  PHASES.CERTIFICATE
];

function normalizeRoleInput(role = '') {
  const value = String(role).trim().toUpperCase().replace(/\s+/g, '_');
  const accepted = new Set([
    ROLES.STUDENT,
    ROLES.STAFF,
    ROLES.SUB_DEAN,
    ROLES.DEAN,
    ROLES.COMMITTEE,
    ROLES.COMMITTEE_PRESIDENT
  ]);
  return accepted.has(value) ? value : null;
}

function normalizeManagedRoleInput(role = '') {
  const value = String(role).trim().toUpperCase().replace(/\s+/g, '_');
  const accepted = new Set([
    ROLES.STUDENT,
    ROLES.STAFF,
    ROLES.SUB_DEAN,
    ROLES.DEAN,
    ROLES.COMMITTEE,
    ROLES.COMMITTEE_PRESIDENT,
    ROLES.ADMIN
  ]);
  return accepted.has(value) ? value : null;
}

function getPrimaryRole(roles = []) {
  const roleHierarchy = [
    ROLES.ADMIN,
    ROLES.COMMITTEE_PRESIDENT,
    ROLES.DEAN,
    ROLES.SUB_DEAN,
    ROLES.COMMITTEE,
    ROLES.STAFF,
    ROLES.STUDENT
  ];

  for (const role of roleHierarchy) {
    if (roles.includes(role)) return role;
  }
  return ROLES.STUDENT;
}

function requiresFaculty(role) {
  return [ROLES.STUDENT, ROLES.STAFF, ROLES.SUB_DEAN, ROLES.DEAN].includes(role);
}

function requiresDepartment(role) {
  return [ROLES.STUDENT, ROLES.STAFF].includes(role);
}

function requiresKuId(role) {
  return role === ROLES.STUDENT;
}

function mustClearKuId(role) {
  return !requiresKuId(role);
}

/* ==================== Middleware ==================== */

/**
 * Verify user is admin
 */
async function requireAdminAuth(req, res, next) {
  if (!req.session.user_id) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  const client = await pool.connect();
  try {
    const rolesResult = await client.query(
      `SELECT r.name FROM user_roles ur 
       JOIN roles r ON ur.role_id = r.id 
       WHERE ur.user_id = $1`,
      [req.session.user_id]
    );

    const roles = rolesResult.rows.map(row => row.name);
    req.userRoles = roles;

    if (!isAdmin(roles)) {
      return res.status(403).json({ message: 'Access denied. Admin only' });
    }

    next();
  } catch (error) {
    console.error('Admin auth error:', error);
    res.status(500).json({ message: 'Authentication error' });
  } finally {
    client.release();
  }
}

/* ==================== Routes ==================== */

// Example: Admin dashboard
router.get('/dashboard', (req, res) => {
  // ...admin dashboard logic...
  res.json({ success: true });
});

/**
 * GET /api/admin/users - List all users for account control
 */
router.get('/users', requireAdminAuth, async (req, res) => {
  try {
    const client = await pool.connect();
    try {
      const result = await client.query(
        `SELECT
           u.id,
           u.email,
           u.fullname,
           u.ku_id,
           u.faculty,
           u.department,
           u.google_profile_picture,
           u.created_at,
           COALESCE(ARRAY_REMOVE(ARRAY_AGG(r.name ORDER BY r.name), NULL), '{}') AS roles
         FROM users u
         LEFT JOIN user_roles ur ON ur.user_id = u.id
         LEFT JOIN roles r ON r.id = ur.role_id
         GROUP BY u.id
         ORDER BY u.created_at DESC`
      );

      const users = result.rows.map((row) => {
        const roles = Array.isArray(row.roles) ? row.roles.filter(Boolean) : [];
        const primaryRole = getPrimaryRole(roles);
        return {
          id: row.id,
          email: row.email,
          fullname: row.fullname,
          ku_id: row.ku_id,
          faculty: row.faculty,
          department: row.department,
          profile_picture: row.google_profile_picture || null,
          roles,
          primary_role: primaryRole,
          created_at: row.created_at
        };
      });

      return res.status(200).json({
        users,
        total: users.length
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('List users error:', error);
    return res.status(500).json({ message: 'Error fetching users.' });
  }
});

/**
 * POST /api/admin/users - Create managed user account
 */
router.post('/users', requireAdminAuth, async (req, res) => {
  const {
    email = '',
    password = '',
    fullname = '',
    ku_id = '',
    role = '',
    faculty = '',
    department = ''
  } = req.body || {};

  const emailNorm = String(email).trim().toLowerCase();
  const roleName = normalizeRoleInput(role);
  const fullNameValue = String(fullname).trim();
  const kuIdValue = String(ku_id).trim();
  const facultyValue = String(faculty).trim();
  const departmentValue = String(department).trim();

  if (!emailNorm || !password || !fullNameValue || !roleName) {
    return res.status(400).json({
      message: 'Email, password, full name, and role are required.'
    });
  }

  if (!validateKuEmail(emailNorm)) {
    return res.status(400).json({
      message: 'Please use a valid KU email (@ku.th or @live.ku.th).'
    });
  }

  if (password.length < 8) {
    return res.status(400).json({
      message: 'Password must be at least 8 characters.'
    });
  }

  if (requiresFaculty(roleName) && !facultyValue) {
    return res.status(400).json({
      message: 'Faculty is required for student, staff, sub-dean, and dean accounts.'
    });
  }

  if (requiresDepartment(roleName) && !departmentValue) {
    return res.status(400).json({
      message: 'Department is required for student and staff accounts.'
    });
  }

  if (requiresKuId(roleName) && !kuIdValue) {
    return res.status(400).json({
      message: 'KU ID is required for student accounts.'
    });
  }

  try {
    const created = await transaction(async (client) => {
      const existing = await client.query(
        'SELECT id FROM users WHERE email = $1',
        [emailNorm]
      );
      if (existing.rows.length > 0) {
        throw new Error('Email already registered');
      }

      const roleResult = await client.query(
        'SELECT id FROM roles WHERE name = $1',
        [roleName]
      );
      if (roleResult.rows.length === 0) {
        throw new Error(`Role not found: ${roleName}`);
      }

      const passwordHash = hashpw(password, gensalt());
      const userInsert = await client.query(
        `INSERT INTO users (ku_id, email, fullname, faculty, department, password_hash, sso_enabled)
         VALUES ($1, $2, $3, $4, $5, $6, false)
         RETURNING id, ku_id, email, fullname, faculty, department, created_at`,
        [
          mustClearKuId(roleName) ? null : (kuIdValue || null),
          emailNorm,
          fullNameValue,
          requiresFaculty(roleName) ? facultyValue : null,
          requiresDepartment(roleName) ? departmentValue : null,
          passwordHash
        ]
      );

      const user = userInsert.rows[0];
      await client.query(
        `INSERT INTO user_roles (user_id, role_id, assigned_by)
         VALUES ($1, $2, $3)`,
        [user.id, roleResult.rows[0].id, req.session.user_id]
      );

      await createAuditLog(client, req.session.user_id, LOG_ACTIONS.ADMIN_ACTION, {
        resourceType: 'user',
        resourceId: user.id,
        newValues: {
          action: 'create_privileged_user',
          role: roleName,
          email: user.email,
          faculty: user.faculty,
          department: user.department
        }
      });

      return { ...user, role: roleName };
    });

    return res.status(201).json({
      success: true,
      message: 'Account created successfully.',
      user: created
    });
  } catch (error) {
    console.error('Create admin user error:', error);
    return res.status(400).json({
      message: error.message || 'Error creating account.'
    });
  }
});

/**
 * PATCH /api/admin/users/:id - Update user profile/role
 */
router.patch('/users/:id', requireAdminAuth, async (req, res) => {
  const userId = Number.parseInt(req.params.id, 10);
  if (Number.isNaN(userId) || userId <= 0) {
    return res.status(400).json({ message: 'Invalid user id.' });
  }

  const {
    fullname = '',
    ku_id = '',
    role = '',
    faculty = '',
    department = '',
    password = ''
  } = req.body || {};

  const roleName = normalizeManagedRoleInput(role);
  const fullNameValue = String(fullname).trim();
  const kuIdValue = String(ku_id).trim();
  const facultyValue = String(faculty).trim();
  const departmentValue = String(department).trim();

  if (!fullNameValue || !roleName) {
    return res.status(400).json({ message: 'Full name and role are required.' });
  }

  if (requiresFaculty(roleName) && !facultyValue) {
    return res.status(400).json({
      message: 'Faculty is required for student, staff, sub-dean, and dean.'
    });
  }

  if (requiresDepartment(roleName) && !departmentValue) {
    return res.status(400).json({
      message: 'Department is required for student and staff.'
    });
  }

  if (requiresKuId(roleName) && !kuIdValue) {
    return res.status(400).json({
      message: 'KU ID is required for student.'
    });
  }

  const passwordValue = String(password || '').trim();
  if (passwordValue && passwordValue.length < 8) {
    return res.status(400).json({
      message: 'Password must be at least 8 characters.'
    });
  }

  try {
    const updated = await transaction(async (client) => {
      const existingUser = await client.query(
        'SELECT id, email FROM users WHERE id = $1',
        [userId]
      );
      if (existingUser.rows.length === 0) {
        throw new Error('User not found');
      }

      const roleResult = await client.query(
        'SELECT id FROM roles WHERE name = $1',
        [roleName]
      );
      if (roleResult.rows.length === 0) {
        throw new Error(`Role not found: ${roleName}`);
      }

      await client.query(
        `UPDATE users
         SET fullname = $1,
             ku_id = $2,
             faculty = $3,
             department = $4,
             updated_at = NOW()
         WHERE id = $5`,
        [
          fullNameValue,
          mustClearKuId(roleName) ? null : (kuIdValue || null),
          requiresFaculty(roleName) ? facultyValue : null,
          requiresDepartment(roleName) ? departmentValue : null,
          userId
        ]
      );

      if (passwordValue) {
        const salt = gensalt();
        const passwordHash = hashpw(passwordValue, salt);
        await client.query(
          `UPDATE users
           SET password_hash = $1,
               updated_at = NOW()
           WHERE id = $2`,
          [passwordHash, userId]
        );
      }

      await client.query('DELETE FROM user_roles WHERE user_id = $1', [userId]);
      await client.query(
        `INSERT INTO user_roles (user_id, role_id, assigned_by)
         VALUES ($1, $2, $3)`,
        [userId, roleResult.rows[0].id, req.session.user_id]
      );

      const rowResult = await client.query(
        `SELECT
           u.id,
           u.email,
           u.fullname,
           u.ku_id,
           u.faculty,
           u.department,
           u.google_profile_picture,
           u.created_at,
           COALESCE(ARRAY_REMOVE(ARRAY_AGG(r.name ORDER BY r.name), NULL), '{}') AS roles
         FROM users u
         LEFT JOIN user_roles ur ON ur.user_id = u.id
         LEFT JOIN roles r ON r.id = ur.role_id
         WHERE u.id = $1
         GROUP BY u.id`,
        [userId]
      );
      const row = rowResult.rows[0];
      const roles = Array.isArray(row.roles) ? row.roles.filter(Boolean) : [];
      const primaryRole = getPrimaryRole(roles);

      await createAuditLog(client, req.session.user_id, LOG_ACTIONS.ADMIN_ACTION, {
        resourceType: 'user',
        resourceId: userId,
        newValues: {
          action: 'update_user_profile',
          role: primaryRole,
          fullname: row.fullname,
          password_reset: Boolean(passwordValue)
        }
      });

      return {
        id: row.id,
        email: row.email,
        fullname: row.fullname,
        ku_id: row.ku_id,
        faculty: row.faculty,
        department: row.department,
        profile_picture: row.google_profile_picture || null,
        roles,
        primary_role: primaryRole,
        created_at: row.created_at
      };
    });

    return res.status(200).json({
      success: true,
      message: 'User updated successfully.',
      user: updated
    });
  } catch (error) {
    console.error('Update user error:', error);
    return res.status(400).json({ message: error.message || 'Error updating user.' });
  }
});

/**
 * POST /api/admin/phase/end-nomination - End nomination phase
 * Moves system from NOMINATION to REVIEW_END phase
 */
router.post('/phase/end-nomination', requireAdminAuth, async (req, res) => {
  try {
    const result = await transaction(async (client) => {
      const round = await resolveRound(client, req.body, { createIfMissing: true });
      if (!round) {
        throw new Error('Round not found');
      }

      const currentPhaseInfo = await ensureInitialNominationPhase(client, round.id, req.session.user_id);
      const currentPhase = currentPhaseInfo.phase;

      if (currentPhase !== PHASES.NOMINATION) {
        throw new Error(`Cannot end nomination. Current phase is ${currentPhase}`);
      }

      const next = await advancePhase(client, round.id, PHASES.REVIEW_END, req.session.user_id, 'Nomination phase ended');

      // Create audit log
      await createAuditLog(client, req.session.user_id, LOG_ACTIONS.PHASE_CHANGE, {
        resourceType: 'round_phase_history',
        resourceId: round.id,
        newValues: {
          round_id: round.id,
          academic_year: round.academic_year,
          semester: round.semester,
          old_phase: PHASES.NOMINATION,
          new_phase: next.phase
        }
      });

      return { success: true, round, new_phase: next.phase };
    });

    return res.status(200).json({
      message: 'Nomination phase ended successfully',
      success: true,
      new_phase: result.new_phase,
      round: {
        id: result.round.id,
        academic_year: result.round.academic_year,
        semester: result.round.semester
      }
    });

  } catch (error) {
    console.error('End nomination error:', error);
    return res.status(400).json({ message: error.message });
  }
});

/**
 * POST /api/admin/phase/initialize
 * Create/initialize first phase for selected academic year/semester.
 * Admin can set the initial phase directly on fresh start.
 */
router.post('/phase/initialize', requireAdminAuth, async (req, res) => {
  try {
    const result = await transaction(async (client) => {
      const round = await resolveRound(client, req.body, { createIfMissing: true });
      if (!round) {
        throw new Error('Round not found');
      }

      const requestedPhase = String(req.body?.phase || PHASES.NOMINATION).trim().toUpperCase();
      if (!PHASE_FLOW.includes(requestedPhase)) {
        throw new Error(`Invalid phase: ${requestedPhase}`);
      }

      const existingPhase = await getCurrentPhaseForRound(client, round.id);
      if (existingPhase?.phase) {
        throw new Error(`Round already initialized with phase ${existingPhase.phase}`);
      }

      let current = await ensureInitialNominationPhase(
        client,
        round.id,
        req.session.user_id,
        'Round initialized by admin'
      );

      while (current?.phase && current.phase !== requestedPhase) {
        const currentIndex = PHASE_FLOW.indexOf(current.phase);
        const nextPhase = PHASE_FLOW[currentIndex + 1];
        if (!nextPhase) break;

        current = await advancePhase(
          client,
          round.id,
          nextPhase,
          req.session.user_id,
          `Initialization advance to ${nextPhase}`
        );
      }

      await createAuditLog(client, req.session.user_id, LOG_ACTIONS.PHASE_CHANGE, {
        resourceType: 'round_phase_history',
        resourceId: round.id,
        newValues: {
          action: 'initialize_round_phase',
          round_id: round.id,
          academic_year: round.academic_year,
          semester: round.semester,
          old_phase: null,
          new_phase: current?.phase || null
        }
      });

      return {
        round,
        new_phase: current?.phase || null
      };
    });

    return res.status(200).json({
      success: true,
      message: 'Round phase initialized successfully',
      new_phase: result.new_phase,
      round: {
        id: result.round.id,
        academic_year: result.round.academic_year,
        semester: result.round.semester
      }
    });
  } catch (error) {
    console.error('Initialize round phase error:', error);
    return res.status(400).json({ message: error.message || 'Error initializing round phase' });
  }
});

/**
 * POST /api/admin/phase/start-vote - Start voting for specific award type
 * Moves specific award type from REVIEW_END to VOTING phase
 */
router.post('/phase/start-vote', requireAdminAuth, async (req, res) => {
  try {
    const result = await transaction(async (client) => {
      const round = await resolveRound(client, req.body);
      if (!round) {
        throw new Error('Round not found');
      }

      const currentPhase = await getCurrentPhaseForRound(client, round.id);
      if (!currentPhase || currentPhase.phase !== PHASES.REVIEW_END) {
        throw new Error(`Cannot start voting. Current phase is ${currentPhase?.phase || 'NONE'}`);
      }

      const next = await advancePhase(client, round.id, PHASES.VOTING, req.session.user_id, 'Voting phase started');

      await createAuditLog(client, req.session.user_id, LOG_ACTIONS.PHASE_CHANGE, {
        resourceType: 'round_phase_history',
        resourceId: round.id,
        newValues: {
          round_id: round.id,
          academic_year: round.academic_year,
          semester: round.semester,
          old_phase: PHASES.REVIEW_END,
          new_phase: next.phase
        }
      });

      return { success: true, round, new_phase: next.phase };
    });

    return res.status(200).json({
      message: 'Voting started',
      success: true,
      new_phase: result.new_phase,
      round: {
        id: result.round.id,
        academic_year: result.round.academic_year,
        semester: result.round.semester
      }
    });

  } catch (error) {
    console.error('Start vote error:', error);
    return res.status(400).json({ message: error.message });
  }
});

/**
 * POST /api/admin/phase/end-vote - End voting for specific award type
 * Moves specific award type from VOTING to VOTING_END phase and calculates results
 */
router.post('/phase/end-vote', requireAdminAuth, async (req, res) => {
  try {
    const result = await transaction(async (client) => {
      const round = await resolveRound(client, req.body);
      if (!round) {
        throw new Error('Round not found');
      }

      const currentPhase = await getCurrentPhaseForRound(client, round.id);
      if (!currentPhase || currentPhase.phase !== PHASES.VOTING) {
        throw new Error(`Cannot end voting. Current phase is ${currentPhase?.phase || 'NONE'}`);
      }

      const next = await advancePhase(client, round.id, PHASES.VOTING_END, req.session.user_id, 'Voting phase ended');

      await createAuditLog(client, req.session.user_id, LOG_ACTIONS.PHASE_CHANGE, {
        resourceType: 'round_phase_history',
        resourceId: round.id,
        newValues: {
          round_id: round.id,
          academic_year: round.academic_year,
          semester: round.semester,
          old_phase: PHASES.VOTING,
          new_phase: next.phase
        }
      });

      return { success: true, round, new_phase: next.phase };
    });

    return res.status(200).json({
      message: 'Voting ended',
      success: true,
      new_phase: result.new_phase,
      round: {
        id: result.round.id,
        academic_year: result.round.academic_year,
        semester: result.round.semester
      }
    });

  } catch (error) {
    console.error('End vote error:', error);
    return res.status(400).json({ message: error.message });
  }
});

/**
 * GET /api/admin/phase/current - Get current system phase
 */
router.get('/phase/current', requireAdminAuth, async (req, res) => {
  try {
    const client = await pool.connect();
    try {
      const round = await resolveRound(client, req.query);
      if (!round) {
        return res.status(404).json({ message: 'Round not found' });
      }

      const phaseInfo = await getCurrentPhaseForRound(client, round.id);
      return res.status(200).json({
        current_phase: phaseInfo?.phase || null,
        round: {
          id: round.id,
          academic_year: round.academic_year,
          semester: round.semester,
          name: round.name
        }
      });

    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Get current phase error:', error);
    const message = error.message || 'Error fetching current phase';
    if (message.includes('academic_year') || message.includes('semester')) {
      return res.status(400).json({ message });
    }
    res.status(500).json({ message: 'Error fetching current phase' });
  }
});

/**
 * POST /api/admin/phase/start-certificate
 * Moves system from VOTING_END to CERTIFICATE phase
 */
router.post('/phase/start-certificate', requireAdminAuth, async (req, res) => {
  try {
    const result = await transaction(async (client) => {
      const round = await resolveRound(client, req.body);
      if (!round) {
        throw new Error('Round not found');
      }

      const currentPhase = await getCurrentPhaseForRound(client, round.id);
      if (!currentPhase || currentPhase.phase !== PHASES.VOTING_END) {
        throw new Error(`Cannot start certificate phase. Current phase is ${currentPhase?.phase || 'NONE'}`);
      }

      const next = await advancePhase(client, round.id, PHASES.CERTIFICATE, req.session.user_id, 'Certificate phase started');

      await createAuditLog(client, req.session.user_id, LOG_ACTIONS.PHASE_CHANGE, {
        resourceType: 'round_phase_history',
        resourceId: round.id,
        newValues: {
          round_id: round.id,
          academic_year: round.academic_year,
          semester: round.semester,
          old_phase: PHASES.VOTING_END,
          new_phase: next.phase
        }
      });

      return { success: true, round, new_phase: next.phase };
    });

    return res.status(200).json({
      message: 'Certificate phase started',
      success: true,
      new_phase: result.new_phase,
      round: {
        id: result.round.id,
        academic_year: result.round.academic_year,
        semester: result.round.semester
      }
    });
  } catch (error) {
    console.error('Start certificate phase error:', error);
    return res.status(400).json({ message: error.message });
  }
});

/**
 * GET /api/admin/statistics - Get system statistics
 */
router.get('/statistics', requireAdminAuth, async (req, res) => {
  try {
    const client = await pool.connect();
    try {
      // Get ticket statistics by status
      const ticketStatsResult = await client.query(
        `SELECT status, COUNT(*) as count
         FROM tickets
         GROUP BY status
         ORDER BY status`,
        []
      );

      // Get ticket statistics by award type
      const awardTypeStatsResult = await client.query(
        `SELECT award_type, COUNT(*) as count
         FROM tickets
         GROUP BY award_type
         ORDER BY award_type`,
        []
      );

      // Get voting phase statistics
      const votingPhaseStatsResult = await client.query(
        `SELECT award_type, status, COUNT(*) as count
         FROM voting_phase
         GROUP BY award_type, status
         ORDER BY award_type, status`,
        []
      );

      // Get committee statistics
      const committeeStatsResult = await client.query(
        `SELECT r.name, COUNT(DISTINCT ur.user_id) as count
         FROM user_roles ur
         JOIN roles r ON ur.role_id = r.id
         WHERE r.name IN ($1, $2, $3, $4, $5, $6, $7)
         GROUP BY r.name
         ORDER BY r.name`,
        [ROLES.STUDENT, ROLES.STAFF, ROLES.SUB_DEAN, ROLES.DEAN, ROLES.COMMITTEE, ROLES.COMMITTEE_PRESIDENT, ROLES.ADMIN]
      );

      return res.status(200).json({
        ticket_statistics: {
          by_status: ticketStatsResult.rows,
          by_award_type: awardTypeStatsResult.rows
        },
        voting_phase_statistics: votingPhaseStatsResult.rows,
        committee_statistics: committeeStatsResult.rows
      });

    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Get statistics error:', error);
    res.status(500).json({ message: 'Error fetching statistics' });
  }
});

/**
 * GET /api/admin/vote-summary - Summary of winners before export
 */
router.get('/vote-summary', requireAdminAuth, async (req, res) => {
  try {
    const client = await pool.connect();
    try {
      const year = Number.parseInt(req.query.academic_year, 10);
      const semester = Number.parseInt(req.query.semester, 10);
      if (Number.isNaN(year) || ![1, 2].includes(semester)) {
        return res.status(400).json({ message: 'Invalid academic year or semester' });
      }

      const round = await getRoundByAcademic(client, year, semester);
      if (!round) {
        return res.status(404).json({ message: 'Round not found' });
      }

      const totalCommittee = await getCommitteeCount(client);
      const threshold = Math.floor(totalCommittee / 2) + 1;

      const result = await client.query(
        `SELECT
           t.id,
           t.award_type,
           t.form_data,
           t.created_at,
           u.id AS user_id,
           u.fullname AS owner_fullname,
           u.ku_id AS owner_ku_id,
           u.faculty AS owner_faculty,
           u.department AS owner_department,
           COUNT(v.id)::int AS total_votes,
           COUNT(CASE WHEN v.vote = 'approved' THEN 1 END)::int AS approved_votes
         FROM tickets t
         JOIN users u ON u.id = t.user_id
         LEFT JOIN votes v ON v.ticket_id = t.id
         WHERE t.round_id = $1
           AND t.status = 'approved'
         GROUP BY t.id, u.id
         ORDER BY t.award_type ASC, t.created_at ASC`,
        [round.id]
      );

      const byAward = new Map();
      for (const row of result.rows) {
        const formData = row.form_data || {};
        const candidate = {
          ticket_id: row.id,
          user_id: row.user_id,
          award_type: row.award_type,
          fullname: formData.full_name || row.owner_fullname || '-',
          gender: formData.gender || null,
          ku_id: formData.student_code || row.owner_ku_id || '-',
          faculty: formData.faculty || row.owner_faculty || '-',
          department: formData.department || row.owner_department || '-',
          approved_votes: row.approved_votes || 0,
          total_votes: row.total_votes || 0,
          created_at: row.created_at
        };
        if (!byAward.has(candidate.award_type)) {
          byAward.set(candidate.award_type, []);
        }
        byAward.get(candidate.award_type).push(candidate);
      }

      const winners = [];
      if (threshold > 0) {
        for (const [, candidates] of byAward.entries()) {
          const qualified = candidates
            .filter((item) => item.approved_votes >= threshold)
            .sort((a, b) => {
              if (b.approved_votes !== a.approved_votes) {
                return b.approved_votes - a.approved_votes;
              }
              return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
            });
          if (qualified.length > 0) {
            winners.push(qualified[0]);
          }
        }
      }

      return res.status(200).json({
        round: {
          id: round.id,
          academic_year: round.academic_year,
          semester: round.semester,
          name: round.name
        },
        summary: {
          total_committee: totalCommittee,
          threshold_required: threshold
        },
        winners
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Get vote summary error:', error);
    return res.status(500).json({ message: 'Error fetching vote summary' });
  }
});

/**
 * GET /api/admin/vote-detail - Committee vote detail per ticket
 */
router.get('/vote-detail', requireAdminAuth, async (req, res) => {
  try {
    const client = await pool.connect();
    try {
      const year = Number.parseInt(req.query.academic_year, 10);
      const semester = Number.parseInt(req.query.semester, 10);
      const ticketId = Number.parseInt(req.query.ticket_id, 10);
      if (Number.isNaN(year) || ![1, 2].includes(semester)) {
        return res.status(400).json({ message: 'Invalid academic year or semester' });
      }

      const round = await getRoundByAcademic(client, year, semester);
      if (!round) {
        return res.status(404).json({ message: 'Round not found' });
      }

      const committeeMembers = await getCommitteeMembers(client);
      const committeeById = new Map(committeeMembers.map((m) => [m.id, m]));

      const ticketFilterSql = Number.isNaN(ticketId) ? '' : ' AND t.id = $2';
      const ticketsResult = await client.query(
        `SELECT
           t.id,
           t.award_type,
           t.form_data,
           u.fullname AS owner_fullname,
           u.ku_id AS owner_ku_id,
           u.faculty AS owner_faculty,
           u.department AS owner_department
         FROM tickets t
         JOIN users u ON u.id = t.user_id
         WHERE t.round_id = $1
           AND t.status = 'approved'${ticketFilterSql}
         ORDER BY t.created_at ASC`,
        Number.isNaN(ticketId) ? [round.id] : [round.id, ticketId]
      );

      const votesResult = await client.query(
        `SELECT ticket_id, user_id, vote, voted_at
         FROM votes
         WHERE ticket_id IN (
           SELECT id FROM tickets WHERE round_id = $1 AND status = 'approved'${Number.isNaN(ticketId) ? '' : ' AND id = $2'}
         )`,
        Number.isNaN(ticketId) ? [round.id] : [round.id, ticketId]
      );

      const votesByTicket = new Map();
      for (const row of votesResult.rows) {
        if (!votesByTicket.has(row.ticket_id)) {
          votesByTicket.set(row.ticket_id, new Map());
        }
        votesByTicket.get(row.ticket_id).set(row.user_id, {
          vote: row.vote,
          voted_at: row.voted_at
        });
      }

      const tickets = ticketsResult.rows.map((row) => {
        const formData = row.form_data || {};
        const ticketVotes = votesByTicket.get(row.id) || new Map();
        const committeeVotes = committeeMembers.map((member) => {
          const voteInfo = ticketVotes.get(member.id);
          return {
            user_id: member.id,
            fullname: member.fullname || member.email,
            email: member.email,
            role: member.role,
            vote: voteInfo ? voteInfo.vote : null,
            voted_at: voteInfo ? voteInfo.voted_at : null
          };
        });

        return {
          ticket_id: row.id,
          award_type: row.award_type,
          fullname: formData.full_name || row.owner_fullname || '-',
          ku_id: formData.student_code || row.owner_ku_id || '-',
          faculty: formData.faculty || row.owner_faculty || '-',
          department: formData.department || row.owner_department || '-',
          votes: committeeVotes
        };
      });

      return res.status(200).json({
        round: {
          id: round.id,
          academic_year: round.academic_year,
          semester: round.semester,
          name: round.name
        },
        committee: committeeMembers.map((m) => ({
          id: m.id,
          fullname: m.fullname || m.email,
          email: m.email,
          role: m.role
        })),
        tickets
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Get vote detail error:', error);
    return res.status(500).json({ message: 'Error fetching vote detail' });
  }
});

/**
 * GET /api/admin/vote-progress - Get detailed voting progress for all award types
 */
router.get('/vote-progress', requireAdminAuth, async (req, res) => {
  try {
    const client = await pool.connect();
    try {
      // Get all voting phases
      const phasesResult = await client.query(
        'SELECT award_type, status, start_at, end_at FROM voting_phase ORDER BY award_type',
        []
      );

      // Get committee count
      const committeeCountResult = await client.query(
        `SELECT COUNT(DISTINCT ur.user_id) as total_committee
         FROM user_roles ur
         JOIN roles r ON ur.role_id = r.id
         WHERE r.name IN ($1, $2)`,
        [ROLES.COMMITTEE, ROLES.COMMITTEE_PRESIDENT]
      );

      const totalCommittee = committeeCountResult.rows[0]?.total_committee || 0;
      const threshold = Math.floor(totalCommittee / 2) + 1;

      const progress = [];

      for (const phase of phasesResult.rows) {
        // Get tickets for this award type
        const ticketsResult = await client.query(
          `SELECT t.id, t.ku_id, t.fullname, t.faculty, t.department,
                  COUNT(v.id) as vote_count,
                  COUNT(CASE WHEN v.vote_result = $1 THEN 1 END) as approve_count,
                  t.status as ticket_status
           FROM tickets t
           LEFT JOIN vote v ON t.id = v.ticket_id
           WHERE t.award_type = $2 AND t.status = $3
           GROUP BY t.id, t.status`,
          ['approved', phase.award_type, TICKET_STATUS.APPROVED]
        );

        const tickets = ticketsResult.rows.map(ticket => ({
          id: ticket.id,
          ku_id: ticket.ku_id,
          fullname: ticket.fullname,
          faculty: ticket.faculty,
          department: ticket.department,
          voted: parseInt(ticket.vote_count),
          approve_count: parseInt(ticket.approve_count),
          threshold_met: parseInt(ticket.approve_count) >= threshold,
          status: parseInt(ticket.approve_count) >= threshold ? 'WINNER' : 'IN_PROGRESS',
          ticket_status: ticket.ticket_status
        }));

        progress.push({
          award_type: phase.award_type,
          phase_status: phase.status,
          start_at: phase.start_at,
          end_at: phase.end_at,
          total_committee: totalCommittee,
          threshold_required: threshold,
          tickets: tickets,
          winners_count: tickets.filter(t => t.threshold_met).length,
          pending_votes: tickets.filter(t => t.voted < totalCommittee).length
        });
      }

      return res.status(200).json({
        voting_progress: progress,
        summary: {
          total_committee: totalCommittee,
          threshold_required: threshold
        }
      });

    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Get voting progress error:', error);
    res.status(500).json({ message: 'Error fetching voting progress' });
  }
});

/**
 * POST /api/admin/announce-winners
 * Announce winners and mark tickets when export is triggered
 */
router.post('/announce-winners', requireAdminAuth, async (req, res) => {
  try {
    const result = await transaction(async (client) => {
      const round = await resolveRound(client, req.body || {});
      if (!round) {
        throw new Error('Round not found');
      }

      const phaseInfo = await getCurrentPhaseForRound(client, round.id);
      if (!phaseInfo || phaseInfo.phase !== PHASES.CERTIFICATE) {
        throw new Error(`Announce is allowed only in CERTIFICATE phase (current phase: ${phaseInfo?.phase || 'NONE'})`);
      }

      const voteResult = await getRoundVoteWinners(client, round.id);
      const winnerIdSet = new Set(voteResult.winners);
      const candidatesResult = await client.query(
        `SELECT id, form_data
         FROM tickets
         WHERE round_id = $1
           AND status = $2`,
        [round.id, TICKET_STATUS.APPROVED]
      );

      const nowIso = new Date().toISOString();
      let updatedCount = 0;
      for (const row of candidatesResult.rows) {
        const formData = row.form_data || {};
        if (formData.proclamation_result) {
          continue;
        }

        const isWinner = winnerIdSet.has(row.id);
        const statusLog = Array.isArray(formData.status_log) ? formData.status_log : [];
        statusLog.push({
          action: 'announce',
          status: 'announced',
          actor_id: req.session.user_id,
          actor_role: ROLES.ADMIN,
          timestamp: nowIso,
          remark: 'Announced on export.'
        });

        const nextFormData = {
          ...formData,
          workflow_status: 'announced',
          proclamation_result: isWinner ? 'winner' : 'not_selected',
          result_announced_at: nowIso,
          announced_at: isWinner ? nowIso : (formData.announced_at || null),
          status_log: statusLog
        };

        await client.query(
          `UPDATE tickets
           SET form_data = $1,
               updated_at = NOW()
           WHERE id = $2`,
          [JSON.stringify(nextFormData), row.id]
        );
        updatedCount += 1;
      }

      await createAuditLog(client, req.session.user_id, LOG_ACTIONS.ADMIN_ACTION, {
        resourceType: 'ticket',
        resourceId: round.id,
        newValues: {
          action: 'announce_winners',
          round_id: round.id,
          updated_count: updatedCount,
          winner_ids: voteResult.winners
        }
      });

      return {
        round,
        updated_count: updatedCount,
        winner_count: voteResult.winners.length
      };
    });

    return res.status(200).json({
      success: true,
      message: 'Announced winners successfully',
      round: {
        id: result.round.id,
        academic_year: result.round.academic_year,
        semester: result.round.semester
      },
      updated_count: result.updated_count,
      winner_count: result.winner_count
    });
  } catch (error) {
    console.error('Announce winners error:', error);
    return res.status(400).json({ message: error.message || 'Error announcing winners' });
  }
});

/**
 * GET /api/admin/audit-logs - Get audit logs with filtering
 */
router.get('/audit-logs', requireAdminAuth, async (req, res) => {
  const { limit = 100, offset = 0, action, user_id, resource_type } = req.query;

  try {
    const client = await pool.connect();
    try {
      // Build WHERE clause dynamically
      let whereClause = 'WHERE 1=1';
      const params = [];
      let paramIndex = 1;

      if (action) {
        whereClause += ` AND action = $${paramIndex}`;
        params.push(action);
        paramIndex++;
      }

      if (user_id) {
        whereClause += ` AND user_id = $${paramIndex}`;
        params.push(parseInt(user_id));
        paramIndex++;
      }

      if (resource_type) {
        whereClause += ` AND resource_type = $${paramIndex}`;
        params.push(resource_type);
        paramIndex++;
      }

      // Get total count
      const countResult = await client.query(
        `SELECT COUNT(*) as total FROM audit_logs ${whereClause}`,
        params
      );

      // Get audit logs with pagination
      const logsResult = await client.query(
        `SELECT al.*, u.email, u.fullname
         FROM audit_logs al
         LEFT JOIN users u ON al.user_id = u.id
         ${whereClause}
         ORDER BY al.timestamp DESC
         LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        [...params, parseInt(limit), parseInt(offset)]
      );

      return res.status(200).json({
        audit_logs: logsResult.rows,
        pagination: {
          total: parseInt(countResult.rows[0].total),
          limit: parseInt(limit),
          offset: parseInt(offset),
          has_more: logsResult.rows.length === parseInt(limit)
        },
        filters: {
          action,
          user_id,
          resource_type
        }
      });

    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Get audit logs error:', error);
    res.status(500).json({ message: 'Error fetching audit logs' });
  }
});


module.exports = router;
