const express = require('express');
const { pool, transaction } = require('../config/database');
const {
  ROLES,
  PHASES,
  TICKET_STATUS,
  AWARD_TYPES,
  ERROR_MESSAGES
} = require('../utils/constants');
const {
  getRoundById,
  getOrCreateRound,
  ensureInitialNominationPhase
} = require('../services/roundPhase');

const router = express.Router();

const WORKFLOW_STATUS = {
  DRAFT: 'draft',
  SUBMITTED_BY_STUDENT: 'submitted_by_student',
  REVIEWED_BY_STAFF: 'reviewed_by_staff',
  REVIEWED_BY_SUBDEAN: 'reviewed_by_subdean',
  REVIEWED_BY_DEAN: 'reviewed_by_dean',
  APPROVED: 'approved',
  ANNOUNCED: 'announced',
  RETURNED: 'returned',
  REJECTED: 'rejected',
  EXPIRED: 'expired',
  DQ: 'DQ'
};

const EDITABLE_STUDENT_STATUSES = new Set([
  WORKFLOW_STATUS.DRAFT,
  WORKFLOW_STATUS.RETURNED
]);

const REVIEW_ACTIONS = new Set(['accept', 'return', 'reject']);

const BASE_REQUIRED_FILE_CATEGORIES = ['transcript', 'profile_photo'];
const OPTIONAL_FILE_CATEGORIES = ['certificates', 'recommendation_letter'];
const ALLOWED_FILE_CATEGORIES = [...BASE_REQUIRED_FILE_CATEGORIES, 'portfolio', 'activity_hours_proof', ...OPTIONAL_FILE_CATEGORIES];

const AWARD_REQUIRED_FIELDS = {
  [AWARD_TYPES.ACTIVITY_ENRICHMENT]: ['activity_hours'],
  [AWARD_TYPES.CREATIVITY_INNOVATION]: [],
  [AWARD_TYPES.GOOD_BEHAVIOR]: []
};

const AWARD_REQUIRED_FILE_CATEGORIES = {
  [AWARD_TYPES.ACTIVITY_ENRICHMENT]: [...BASE_REQUIRED_FILE_CATEGORIES, 'portfolio', 'activity_hours_proof'],
  [AWARD_TYPES.CREATIVITY_INNOVATION]: [...BASE_REQUIRED_FILE_CATEGORIES, 'portfolio'],
  [AWARD_TYPES.GOOD_BEHAVIOR]: [...BASE_REQUIRED_FILE_CATEGORIES, 'recommendation_letter']
};


function hasRole(userRoles, role) {
  return userRoles.includes(role);
}

function isAdmin(userRoles) {
  return hasRole(userRoles, ROLES.ADMIN);
}

function isStaffOrHigher(userRoles) {
  return userRoles.some((role) => [ROLES.STAFF, ROLES.SUB_DEAN, ROLES.DEAN, ROLES.ADMIN].includes(role));
}

function isCommittee(userRoles) {
  return userRoles.some((role) => [ROLES.COMMITTEE, ROLES.COMMITTEE_PRESIDENT].includes(role));
}

function getCurrentWorkflowStatus(ticket) {
  return ticket?.form_data?.workflow_status || WORKFLOW_STATUS.DRAFT;
}

function getCurrentRoundId(ticket) {
  const parsed = Number.parseInt(ticket?.round_id, 10);
  if (!Number.isNaN(parsed) && parsed > 0) {
    return parsed;
  }

  const legacyRoundRaw = ticket?.form_data?.round_id;
  const legacyParsed = Number.parseInt(legacyRoundRaw, 10);
  return Number.isNaN(legacyParsed) ? null : legacyParsed;
}

function mapWorkflowToDbStatus(workflowStatus) {
  if (
    workflowStatus === WORKFLOW_STATUS.REVIEWED_BY_DEAN ||
    workflowStatus === WORKFLOW_STATUS.APPROVED ||
    workflowStatus === WORKFLOW_STATUS.ANNOUNCED
  ) {
    return TICKET_STATUS.APPROVED;
  }
  if (workflowStatus === WORKFLOW_STATUS.REJECTED) {
    return TICKET_STATUS.REJECTED;
  }
  if (workflowStatus === WORKFLOW_STATUS.EXPIRED) {
    return TICKET_STATUS.EXPIRED;
  }
  if (workflowStatus === WORKFLOW_STATUS.DQ) {
    return TICKET_STATUS.NOT_APPROVED;
  }
  return TICKET_STATUS.PENDING;
}

function validateAwardType(awardType) {
  return Object.values(AWARD_TYPES).includes(awardType);
}

function getRequiredFileCategoriesForAward(awardType) {
  return AWARD_REQUIRED_FILE_CATEGORIES[awardType] || BASE_REQUIRED_FILE_CATEGORIES;
}

function validateGpa(gpa) {
  const parsed = Number.parseFloat(gpa);
  return !Number.isNaN(parsed) && parsed >= 0 && parsed <= 4;
}

function validateGender(gender) {
  return ['male', 'female'].includes(String(gender || '').toLowerCase());
}

async function createAuditLog(client, userId, action, data = {}) {
  await client.query(
    `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, old_values, new_values, notes)
     VALUES ($1, $2::log_action, $3, $4, $5, $6, $7)`,
    [
      userId,
      action,
      data.resourceType || 'ticket',
      data.resourceId || null,
      data.oldValues ? JSON.stringify(data.oldValues) : null,
      data.newValues ? JSON.stringify(data.newValues) : null,
      data.remark || null
    ]
  );
}

async function requireAuth(req, res, next) {
  if (!req.session.user_id) {
    return res.status(401).json({ message: ERROR_MESSAGES.UNAUTHORIZED });
  }
  return next();
}

async function getUserRoles(req, res, next) {
  const client = await pool.connect();
  try {
    const rolesResult = await client.query(
      `SELECT r.name
       FROM user_roles ur
       JOIN roles r ON ur.role_id = r.id
       WHERE ur.user_id = $1`,
      [req.session.user_id]
    );
    req.userRoles = rolesResult.rows.map((row) => row.name);
    return next();
  } catch (error) {
    console.error('Get user roles error:', error);
    return res.status(500).json({ message: 'Authentication error' });
  } finally {
    client.release();
  }
}

function requireSsoForStudentAction(req, res, next) {
  const isStudent = hasRole(req.userRoles, ROLES.STUDENT);
  if (isStudent && req.session.sso_authenticated !== true) {
    return res.status(403).json({ message: 'KU SSO authentication is required for ticket submission.' });
  }
  return next();
}

async function findTicketById(client, ticketId) {
  const result = await client.query(
    `SELECT t.*,
            u.fullname AS owner_fullname,
            u.email AS owner_email,
            u.ku_id AS owner_ku_id,
            u.faculty AS owner_faculty,
            u.department AS owner_department
     FROM tickets t
     JOIN users u ON t.user_id = u.id
     WHERE t.id = $1`,
    [ticketId]
  );
  return result.rows[0] || null;
}

async function ensureSingleTicketPerRound(client, userId, roundId) {
  const result = await client.query(
    `SELECT id
     FROM tickets
     WHERE user_id = $1
       AND COALESCE(
             round_id,
             NULLIF(regexp_replace(form_data->>'round_id', '[^0-9]', '', 'g'), '')::int
           ) = $2
     LIMIT 1`,
    [userId, roundId]
  );
  return result.rows.length === 0;
}

async function getTicketFiles(client, ticketId) {
  const result = await client.query(
    `SELECT id, original_name, filename, file_path, file_size, mime_type, file_category, uploaded_at
     FROM ticket_files
     WHERE ticket_id = $1 AND deleted_at IS NULL
     ORDER BY uploaded_at ASC`,
    [ticketId]
  );
  return result.rows;
}


function buildReviewTransition(currentWorkflow, reviewerRole, action) {
  if (!REVIEW_ACTIONS.has(action)) {
    throw new Error('Invalid review action. Use accept, return, or reject.');
  }

  if (action === 'return') {
    return WORKFLOW_STATUS.RETURNED;
  }

  if (action === 'reject') {
    return WORKFLOW_STATUS.REJECTED;
  }

  if (currentWorkflow === WORKFLOW_STATUS.SUBMITTED_BY_STUDENT && reviewerRole === ROLES.STAFF) {
    return WORKFLOW_STATUS.REVIEWED_BY_STAFF;
  }
  if (currentWorkflow === WORKFLOW_STATUS.REVIEWED_BY_STAFF && reviewerRole === ROLES.SUB_DEAN) {
    return WORKFLOW_STATUS.REVIEWED_BY_SUBDEAN;
  }
  if (currentWorkflow === WORKFLOW_STATUS.REVIEWED_BY_SUBDEAN && reviewerRole === ROLES.DEAN) {
    return WORKFLOW_STATUS.REVIEWED_BY_DEAN;
  }

  throw new Error('This role cannot review the ticket at the current stage.');
}

function getReviewerRole(userRoles) {
  if (userRoles.includes(ROLES.STAFF)) return ROLES.STAFF;
  if (userRoles.includes(ROLES.SUB_DEAN)) return ROLES.SUB_DEAN;
  if (userRoles.includes(ROLES.DEAN)) return ROLES.DEAN;
  return null;
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

function canStaffAccessTicketByScope(ticket, req) {
  const reviewerRole = getReviewerRole(req.userRoles || []);
  if (!reviewerRole) return false;

  const ticketFaculty = normalizeText(ticket?.faculty || ticket?.owner_faculty);
  const ticketDepartment = normalizeText(ticket?.department || ticket?.owner_department);
  const sessionFaculty = normalizeText(req.session?.faculty);
  const sessionDepartment = normalizeText(req.session?.department);

  if (reviewerRole === ROLES.STAFF) {
    return Boolean(sessionDepartment) && ticketDepartment === sessionDepartment;
  }

  if ([ROLES.SUB_DEAN, ROLES.DEAN].includes(reviewerRole)) {
    return Boolean(sessionFaculty) && ticketFaculty === sessionFaculty;
  }

  return false;
}

function hydrateTicketResponse(ticket) {
  const workflow_status = getCurrentWorkflowStatus(ticket);
  const round_id = getCurrentRoundId(ticket);

  const formData = ticket.form_data || {};

  return {
    id: ticket.id,
    ticket_id: ticket.id,
    ticket_uuid: formData.ticket_uuid || null,
    student_id: ticket.user_id,
    student_code: formData.student_code || ticket.owner_ku_id || null,
    full_name: formData.full_name || formData.full_name_thai || ticket.owner_fullname || null,
    full_name_thai: formData.full_name_thai || formData.full_name || ticket.owner_fullname || null,
    gender: formData.gender || null,
    faculty: formData.faculty || ticket.owner_faculty || null,
    department: formData.department || ticket.owner_department || null,
    award_type: ticket.award_type,
    academic_year: formData.academic_year || ticket.academic_year,
    gpa: formData.gpa || null,
    portfolio_description: formData.portfolio_description || null,
    achievements: formData.achievements || null,
    activity_hours: formData.activity_hours || null,
    semester: ticket.semester,
    status: workflow_status,
    db_status: ticket.status,
    round_id,
    reason_for_return: formData.reason_for_return || null,
    proclamation_result:
      formData.proclamation_result ||
      (workflow_status === WORKFLOW_STATUS.ANNOUNCED ? 'winner' : null),
    result_announced_at: formData.result_announced_at || formData.announced_at || null,
    submitted_at: formData.submitted_at || ticket.submitted_at,
    reviewed_at: ticket.reviewed_at,
    reviewed_by: ticket.reviewed_by || null,
    status_log: Array.isArray(formData.status_log) ? formData.status_log : [],
    created_at: ticket.created_at,
    updated_at: ticket.updated_at
  };
}

function validateTicketInput(input, { requireAll = false } = {}) {
  const errors = [];

  if (requireAll || input.award_type !== undefined) {
    if (!validateAwardType(input.award_type)) {
      errors.push('Invalid award_type.');
    }
  }

  if (requireAll || input.academic_year !== undefined) {
    const parsed = Number.parseInt(input.academic_year, 10);
    if (Number.isNaN(parsed) || parsed < 2000 || parsed > 3000) {
      errors.push('Invalid academic_year.');
    }
  }

  if (requireAll || input.gpa !== undefined) {
    if (!validateGpa(input.gpa)) {
      errors.push('Invalid gpa. Must be between 0.00 and 4.00.');
    }
  }

  if (requireAll || input.portfolio_description !== undefined) {
    if (!input.portfolio_description || String(input.portfolio_description).trim().length === 0) {
      errors.push('portfolio_description is required.');
    }
  }

  if (requireAll || input.achievements !== undefined) {
    if (!input.achievements || String(input.achievements).trim().length === 0) {
      errors.push('achievements is required.');
    }
  }

  if (requireAll || input.full_name_thai !== undefined) {
    if (!input.full_name_thai || String(input.full_name_thai).trim().length === 0) {
      errors.push('full_name_thai is required.');
    }
  }

  if (requireAll || input.gender !== undefined) {
    if (!validateGender(input.gender)) {
      errors.push('gender is required and must be male or female.');
    }
  }

  if (requireAll || input.faculty !== undefined) {
    if (!input.faculty || String(input.faculty).trim().length === 0) {
      errors.push('faculty is required.');
    }
  }

  if (requireAll || input.department !== undefined) {
    if (!input.department || String(input.department).trim().length === 0) {
      errors.push('department is required.');
    }
  }

  const requiredFields = AWARD_REQUIRED_FIELDS[input.award_type] || [];
  for (const requiredField of requiredFields) {
    if (!input[requiredField] || String(input[requiredField]).trim().length === 0) {
      errors.push(`${requiredField} is required for selected award type.`);
    }
  }

  return errors;
}

async function getAuditHistory(client, ticketId) {
  const result = await client.query(
    `SELECT al.id,
            al.action,
            al.resource_type,
            al.resource_id,
            al.old_values,
            al.new_values,
            al.notes,
            al.created_at AS timestamp,
            al.user_id AS actor_id,
            u.fullname AS actor_name
     FROM audit_logs al
     LEFT JOIN users u ON al.user_id = u.id
     WHERE al.resource_type = 'ticket' AND al.resource_id = $1
     ORDER BY al.created_at DESC`,
    [ticketId]
  );
  return result.rows;
}

router.get('/', [requireAuth, getUserRoles], async (req, res) => {
  const client = await pool.connect();
  try {
    let query = '';
    let params = [];

    if (isAdmin(req.userRoles)) {
      query =
        `SELECT t.*, u.fullname AS owner_fullname, u.email AS owner_email, u.ku_id AS owner_ku_id, u.faculty AS owner_faculty, u.department AS owner_department
         FROM tickets t
         JOIN users u ON t.user_id = u.id
         ORDER BY t.created_at DESC`;
    } else if (isStaffOrHigher(req.userRoles)) {
      const reviewerRole = getReviewerRole(req.userRoles);
      if (reviewerRole === ROLES.STAFF) {
        query =
          `SELECT t.*, u.fullname AS owner_fullname, u.email AS owner_email, u.ku_id AS owner_ku_id, u.faculty AS owner_faculty, u.department AS owner_department
           FROM tickets t
           JOIN users u ON t.user_id = u.id
           WHERE u.department = $1
           ORDER BY t.created_at DESC`;
        params = [req.session.department];
      } else if ([ROLES.SUB_DEAN, ROLES.DEAN].includes(reviewerRole)) {
        query =
          `SELECT t.*, u.fullname AS owner_fullname, u.email AS owner_email, u.ku_id AS owner_ku_id, u.faculty AS owner_faculty, u.department AS owner_department
           FROM tickets t
           JOIN users u ON t.user_id = u.id
           WHERE u.faculty = $1
           ORDER BY t.created_at DESC`;
        params = [req.session.faculty];
      } else {
        return res.status(403).json({ message: ERROR_MESSAGES.FORBIDDEN });
      }
    } else if (isCommittee(req.userRoles)) {
      query =
        `SELECT t.*, u.fullname AS owner_fullname, u.email AS owner_email, u.ku_id AS owner_ku_id, u.faculty AS owner_faculty, u.department AS owner_department
         FROM tickets t
         JOIN users u ON t.user_id = u.id
         WHERE t.status = $1
         ORDER BY t.created_at DESC`;
      params = [TICKET_STATUS.APPROVED];
    } else if (hasRole(req.userRoles, ROLES.STUDENT)) {
      query =
        `SELECT t.*, u.fullname AS owner_fullname, u.email AS owner_email, u.ku_id AS owner_ku_id, u.faculty AS owner_faculty, u.department AS owner_department
         FROM tickets t
         JOIN users u ON t.user_id = u.id
         WHERE t.user_id = $1
         ORDER BY t.created_at DESC`;
      params = [req.session.user_id];
    } else {
      return res.status(403).json({ message: ERROR_MESSAGES.FORBIDDEN });
    }

    const result = await client.query(query, params);

    return res.status(200).json({
      tickets: result.rows.map(hydrateTicketResponse),
      total: result.rows.length
    });
  } catch (error) {
    console.error('List tickets error:', error);
    return res.status(500).json({ message: 'Error fetching tickets.' });
  } finally {
    client.release();
  }
});

router.get('/me', [requireAuth, getUserRoles], async (req, res) => {
  if (!hasRole(req.userRoles, ROLES.STUDENT)) {
    return res.status(403).json({ message: ERROR_MESSAGES.FORBIDDEN });
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT t.*, u.fullname AS owner_fullname, u.email AS owner_email, u.ku_id AS owner_ku_id, u.faculty AS owner_faculty, u.department AS owner_department
       FROM tickets t
       JOIN users u ON t.user_id = u.id
       WHERE t.user_id = $1
       ORDER BY t.created_at DESC`,
      [req.session.user_id]
    );

    return res.status(200).json({
      tickets: result.rows.map(hydrateTicketResponse),
      total: result.rows.length
    });
  } catch (error) {
    console.error('List my tickets error:', error);
    return res.status(500).json({ message: 'Error fetching your tickets.' });
  } finally {
    client.release();
  }
});

router.get('/:id', [requireAuth, getUserRoles], async (req, res) => {
  const ticketId = Number.parseInt(req.params.id, 10);
  if (Number.isNaN(ticketId)) {
    return res.status(400).json({ message: 'Invalid ticket id.' });
  }

  const client = await pool.connect();
  try {
    const ticket = await findTicketById(client, ticketId);
    if (!ticket) {
      return res.status(404).json({ message: ERROR_MESSAGES.TICKET_NOT_FOUND });
    }

    const isOwner = ticket.user_id === req.session.user_id;
    const scopedStaffAccess = isStaffOrHigher(req.userRoles) && canStaffAccessTicketByScope(ticket, req);
    const canView = isOwner || isAdmin(req.userRoles) || scopedStaffAccess || isCommittee(req.userRoles);

    if (!canView) {
      return res.status(403).json({ message: ERROR_MESSAGES.FORBIDDEN });
    }

    const files = await getTicketFiles(client, ticketId);
    const history = await getAuditHistory(client, ticketId);

    return res.status(200).json({
      ticket: hydrateTicketResponse(ticket),
      files,
      history
    });
  } catch (error) {
    console.error('Get ticket detail error:', error);
    return res.status(500).json({ message: 'Error fetching ticket details.' });
  } finally {
    client.release();
  }
});

router.post(
  '/',
  [requireAuth, getUserRoles, requireSsoForStudentAction],
  async (req, res) => {
    if (!hasRole(req.userRoles, ROLES.STUDENT)) {
      return res.status(403).json({ message: ERROR_MESSAGES.FORBIDDEN });
    }

    const {
      award_type,
      full_name_thai,
      gender,
      faculty,
      department,
      academic_year,
      gpa,
      portfolio_description,
      achievements,
      activity_hours,
      round_id,
      semester = 1
    } = req.body;

    const errors = validateTicketInput(
      {
        award_type,
        full_name_thai,
        gender,
        faculty,
        department,
        academic_year,
        gpa,
        portfolio_description,
        achievements,
        activity_hours
      },
      { requireAll: true }
    );
    if (errors.length > 0) {
      return res.status(400).json({ message: errors.join(' ') });
    }

    const semesterValue = Number.parseInt(semester, 10);
    if (![1, 2].includes(semesterValue)) {
      return res.status(400).json({ message: 'semester must be 1 or 2.' });
    }

    try {
      const created = await transaction(async (client) => {
        const academicYearValue = Number.parseInt(academic_year, 10);
        let round = null;

        if (round_id !== undefined && round_id !== null) {
          const roundId = Number.parseInt(round_id, 10);
          if (Number.isNaN(roundId) || roundId < 1) {
            throw new Error('Invalid round_id.');
          }
          round = await getRoundById(client, roundId);
          if (!round) {
            throw new Error('Round not found.');
          }
        } else {
          round = await getOrCreateRound(client, academicYearValue, semesterValue);
        }

        const phaseInfo = await ensureInitialNominationPhase(client, round.id);
        if (phaseInfo.phase !== PHASES.NOMINATION) {
          throw new Error('Ticket creation is allowed only during NOMINATION phase.');
        }

        const canCreate = await ensureSingleTicketPerRound(client, req.session.user_id, round.id);
        if (!canCreate) {
          throw new Error('Student can create only one ticket per round.');
        }

        const formData = {
          workflow_status: WORKFLOW_STATUS.DRAFT,
          round_id: round.id,
          student_code: req.session.ku_id || null,
          full_name: String(full_name_thai || req.session.fullname || '').trim() || null,
          full_name_thai: String(full_name_thai || req.session.fullname || '').trim() || null,
          gender: String(gender || '').trim().toLowerCase() || null,
          faculty: String(faculty || req.session.faculty || '').trim() || null,
          department: String(department || req.session.department || '').trim() || null,
          academic_year: academicYearValue,
          gpa: Number.parseFloat(gpa),
          portfolio_description: String(portfolio_description),
          achievements: String(achievements),
          activity_hours: activity_hours !== undefined ? String(activity_hours) : null,
          status_log: [
            {
              action: 'create',
              status: WORKFLOW_STATUS.DRAFT,
              actor_id: req.session.user_id,
              actor_role: ROLES.STUDENT,
              timestamp: new Date().toISOString(),
              remark: 'Ticket draft created.'
            }
          ]
        };

        const ticketResult = await client.query(
          `INSERT INTO tickets (user_id, award_type, academic_year, semester, round_id, status, form_data, submitted_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, NULL)
           RETURNING *`,
          [
            req.session.user_id,
            award_type,
            String(academic_year),
            round.semester,
            round.id,
            mapWorkflowToDbStatus(WORKFLOW_STATUS.DRAFT),
            JSON.stringify(formData)
          ]
        );

        const ticket = ticketResult.rows[0];

        await createAuditLog(client, req.session.user_id, 'ticket_create', {
          resourceType: 'ticket',
          resourceId: ticket.id,
          newValues: {
            action: 'create',
            workflow_status: WORKFLOW_STATUS.DRAFT,
            actor_id: req.session.user_id,
            actor_role: ROLES.STUDENT,
            round_id: round.id,
            award_type,
            academic_year: round.academic_year,
            semester: round.semester,
            gpa: Number.parseFloat(gpa)
          },
          remark: 'Ticket draft created by student.'
        });

        return ticket;
      });

      return res.status(201).json({
        message: 'Ticket draft created successfully.',
        ticket: hydrateTicketResponse(created)
      });
    } catch (error) {
      console.error('Create ticket error:', error);
      return res.status(400).json({ message: error.message || 'Error creating ticket.' });
    }
  }
);

router.patch(
  '/:id',
  [requireAuth, getUserRoles, requireSsoForStudentAction],
  async (req, res) => {
    const ticketId = Number.parseInt(req.params.id, 10);
    if (Number.isNaN(ticketId)) {
      return res.status(400).json({ message: 'Invalid ticket id.' });
    }

    try {
      const updated = await transaction(async (client) => {
        const ticket = await findTicketById(client, ticketId);
        if (!ticket) {
          throw new Error(ERROR_MESSAGES.TICKET_NOT_FOUND);
        }

        const owner = ticket.user_id === req.session.user_id;
        const admin = isAdmin(req.userRoles);
        if (!owner && !admin) {
          throw new Error(ERROR_MESSAGES.FORBIDDEN);
        }

        const currentWorkflow = getCurrentWorkflowStatus(ticket);
        if (!admin && !EDITABLE_STUDENT_STATUSES.has(currentWorkflow)) {
          throw new Error('Ticket is locked after submission and can only be edited when returned.');
        }

        const payload = req.body || {};

        if (!admin && payload.award_type && payload.award_type !== ticket.award_type && currentWorkflow !== WORKFLOW_STATUS.DRAFT) {
          throw new Error('award_type cannot be changed after submission.');
        }

        const candidateUpdate = {
          award_type: payload.award_type !== undefined ? payload.award_type : ticket.award_type,
          full_name_thai:
            payload.full_name_thai !== undefined
              ? payload.full_name_thai
              : (ticket.form_data?.full_name_thai || ticket.form_data?.full_name || req.session.fullname),
          gender: payload.gender !== undefined ? payload.gender : ticket.form_data?.gender,
          faculty:
            payload.faculty !== undefined
              ? payload.faculty
              : (ticket.form_data?.faculty || req.session.faculty),
          department:
            payload.department !== undefined
              ? payload.department
              : (ticket.form_data?.department || req.session.department),
          academic_year:
            payload.academic_year !== undefined
              ? payload.academic_year
              : (ticket.form_data?.academic_year || ticket.academic_year),
          gpa: payload.gpa !== undefined ? payload.gpa : ticket.form_data?.gpa,
          portfolio_description:
            payload.portfolio_description !== undefined
              ? payload.portfolio_description
              : ticket.form_data?.portfolio_description,
          achievements:
            payload.achievements !== undefined ? payload.achievements : ticket.form_data?.achievements
          ,
          activity_hours:
            payload.activity_hours !== undefined ? payload.activity_hours : ticket.form_data?.activity_hours
        };

        const errors = validateTicketInput(candidateUpdate, { requireAll: false });
        if (errors.length > 0) {
          throw new Error(errors.join(' '));
        }

        const formData = {
          ...(ticket.form_data || {}),
          student_code: ticket.form_data?.student_code || req.session.ku_id || null,
          full_name:
            payload.full_name_thai !== undefined
              ? String(payload.full_name_thai)
              : (ticket.form_data?.full_name || ticket.form_data?.full_name_thai || req.session.fullname || null),
          full_name_thai:
            payload.full_name_thai !== undefined
              ? String(payload.full_name_thai)
              : (ticket.form_data?.full_name_thai || ticket.form_data?.full_name || req.session.fullname || null),
          gender:
            payload.gender !== undefined
              ? String(payload.gender).toLowerCase()
              : (ticket.form_data?.gender || null),
          faculty:
            payload.faculty !== undefined
              ? String(payload.faculty)
              : (ticket.form_data?.faculty || req.session.faculty || null),
          department:
            payload.department !== undefined
              ? String(payload.department)
              : (ticket.form_data?.department || req.session.department || null),
          academic_year:
            payload.academic_year !== undefined
              ? Number.parseInt(payload.academic_year, 10)
              : ticket.form_data?.academic_year,
          gpa: payload.gpa !== undefined ? Number.parseFloat(payload.gpa) : ticket.form_data?.gpa,
          portfolio_description:
            payload.portfolio_description !== undefined
              ? String(payload.portfolio_description)
              : ticket.form_data?.portfolio_description,
          achievements:
            payload.achievements !== undefined
              ? String(payload.achievements)
              : ticket.form_data?.achievements,
          activity_hours:
            payload.activity_hours !== undefined
              ? String(payload.activity_hours)
              : ticket.form_data?.activity_hours,
          updated_by: req.session.user_id,
          updated_at: new Date().toISOString()
        };

        const statusLog = Array.isArray(formData.status_log) ? formData.status_log : [];
        statusLog.push({
          action: admin ? 'admin_override' : 'student_update',
          status: currentWorkflow,
          actor_id: req.session.user_id,
          actor_role: admin ? ROLES.ADMIN : ROLES.STUDENT,
          timestamp: new Date().toISOString(),
          remark: admin ? 'Admin override update.' : 'Student edited ticket.'
        });
        formData.status_log = statusLog;

        const nextAwardType = payload.award_type !== undefined ? payload.award_type : ticket.award_type;
        const nextAcademicYear = payload.academic_year !== undefined ? String(payload.academic_year) : ticket.academic_year;

        const updateResult = await client.query(
          `UPDATE tickets
           SET award_type = $1,
               academic_year = $2,
               form_data = $3,
               status = $4,
               updated_at = NOW()
           WHERE id = $5
           RETURNING *`,
          [
            nextAwardType,
            nextAcademicYear,
            JSON.stringify(formData),
            mapWorkflowToDbStatus(currentWorkflow),
            ticketId
          ]
        );

        await createAuditLog(client, req.session.user_id, 'ticket_update', {
          resourceType: 'ticket',
          resourceId: ticketId,
          oldValues: {
            award_type: ticket.award_type,
            academic_year: ticket.academic_year,
            workflow_status: currentWorkflow
          },
          newValues: {
            award_type: nextAwardType,
            academic_year: nextAcademicYear,
            workflow_status: currentWorkflow,
            actor_role: admin ? ROLES.ADMIN : ROLES.STUDENT
          },
          remark: admin ? 'Admin override update on ticket.' : 'Student updated editable ticket.'
        });

        return updateResult.rows[0];
      });

      return res.status(200).json({
        message: 'Ticket updated successfully.',
        ticket: hydrateTicketResponse(updated)
      });
    } catch (error) {
      console.error('Update ticket error:', error);
      return res.status(400).json({ message: error.message || 'Error updating ticket.' });
    }
  }
);

router.delete('/:id', [requireAuth, getUserRoles, requireSsoForStudentAction], async (req, res) => {
  const ticketId = Number.parseInt(req.params.id, 10);
  if (Number.isNaN(ticketId)) {
    return res.status(400).json({ message: 'Invalid ticket id.' });
  }

  try {
    await transaction(async (client) => {
      const ticket = await findTicketById(client, ticketId);
      if (!ticket) {
        throw new Error(ERROR_MESSAGES.TICKET_NOT_FOUND);
      }

      if (ticket.user_id !== req.session.user_id) {
        throw new Error(ERROR_MESSAGES.FORBIDDEN);
      }

      const workflow = getCurrentWorkflowStatus(ticket);
      if (workflow !== WORKFLOW_STATUS.DRAFT) {
        throw new Error('Only draft ticket can be deleted.');
      }

      await client.query('DELETE FROM ticket_files WHERE ticket_id = $1', [ticketId]);
      await client.query('DELETE FROM tickets WHERE id = $1', [ticketId]);

      await createAuditLog(client, req.session.user_id, 'admin_action', {
        resourceType: 'ticket',
        resourceId: ticketId,
        newValues: {
          action: 'delete_draft',
          actor_role: ROLES.STUDENT,
          workflow_status: workflow
        },
        remark: 'Student deleted draft ticket.'
      });
    });

    return res.status(200).json({ message: 'Draft ticket deleted successfully.' });
  } catch (error) {
    console.error('Delete ticket error:', error);
    return res.status(400).json({ message: error.message || 'Error deleting ticket.' });
  }
});

router.post('/:id/submit', [requireAuth, getUserRoles, requireSsoForStudentAction], async (req, res) => {
  const ticketId = Number.parseInt(req.params.id, 10);
  if (Number.isNaN(ticketId)) {
    return res.status(400).json({ message: 'Invalid ticket id.' });
  }

  try {
    const updated = await transaction(async (client) => {
      const ticket = await findTicketById(client, ticketId);
      if (!ticket) {
        throw new Error(ERROR_MESSAGES.TICKET_NOT_FOUND);
      }

      if (ticket.user_id !== req.session.user_id) {
        throw new Error(ERROR_MESSAGES.FORBIDDEN);
      }

      const ticketRoundId = getCurrentRoundId(ticket);
      if (!ticketRoundId) {
        throw new Error('Ticket is missing round_id.');
      }

      const phaseInfo = await ensureInitialNominationPhase(client, ticketRoundId);
      if (phaseInfo.phase !== PHASES.NOMINATION) {
        throw new Error('Submission deadline passed. Ticket cannot be submitted.');
      }

      const workflow = getCurrentWorkflowStatus(ticket);
      if (!EDITABLE_STUDENT_STATUSES.has(workflow)) {
        throw new Error('Ticket has already been submitted and is immutable.');
      }

      const files = await getTicketFiles(client, ticketId);
      const fileCategories = new Set(files.map((f) => f.file_category));
      const requiredFileCategories = getRequiredFileCategoriesForAward(ticket.award_type);
      const missingRequired = requiredFileCategories.filter((required) => !fileCategories.has(required));
      if (missingRequired.length > 0) {
        throw new Error(`Missing required files: ${missingRequired.join(', ')}`);
      }

      const formData = {
        ...(ticket.form_data || {}),
        workflow_status: WORKFLOW_STATUS.SUBMITTED_BY_STUDENT,
        reason_for_return: null,
        submitted_at: new Date().toISOString(),
        status_log: [
          ...(Array.isArray(ticket.form_data?.status_log) ? ticket.form_data.status_log : []),
          {
            action: 'submit',
            status: WORKFLOW_STATUS.SUBMITTED_BY_STUDENT,
            actor_id: req.session.user_id,
            actor_role: ROLES.STUDENT,
            timestamp: new Date().toISOString(),
            remark: 'Student submitted ticket.'
          }
        ]
      };

      const result = await client.query(
        `UPDATE tickets
         SET status = $1,
             form_data = $2,
             submitted_at = NOW(),
             updated_at = NOW()
         WHERE id = $3
         RETURNING *`,
        [mapWorkflowToDbStatus(WORKFLOW_STATUS.SUBMITTED_BY_STUDENT), JSON.stringify(formData), ticketId]
      );

      await createAuditLog(client, req.session.user_id, 'ticket_update', {
        resourceType: 'ticket',
        resourceId: ticketId,
        oldValues: { workflow_status: workflow },
        newValues: {
          action: 'submit',
          workflow_status: WORKFLOW_STATUS.SUBMITTED_BY_STUDENT,
          actor_role: ROLES.STUDENT
        },
        remark: 'Ticket submitted by student.'
      });

      return result.rows[0];
    });

    return res.status(200).json({
      message: 'Ticket submitted successfully.',
      ticket: hydrateTicketResponse(updated)
    });
  } catch (error) {
    console.error('Submit ticket error:', error);
    return res.status(400).json({ message: error.message || 'Error submitting ticket.' });
  }
});

router.patch('/:id/review', [requireAuth, getUserRoles], async (req, res) => {
  const ticketId = Number.parseInt(req.params.id, 10);
  if (Number.isNaN(ticketId)) {
    return res.status(400).json({ message: 'Invalid ticket id.' });
  }

  const { action, reason } = req.body || {};
  const reviewerRole = getReviewerRole(req.userRoles);
  if (!reviewerRole) {
    return res.status(403).json({ message: ERROR_MESSAGES.FORBIDDEN });
  }

  if (!REVIEW_ACTIONS.has(action)) {
    return res.status(400).json({ message: 'Invalid review action. Use accept, return, or reject.' });
  }

  if (action === 'return' && (!reason || String(reason).trim().length === 0)) {
    return res.status(400).json({ message: 'reason_for_return is required when returning a ticket.' });
  }

  try {
    const updated = await transaction(async (client) => {
      const ticket = await findTicketById(client, ticketId);
      if (!ticket) {
        throw new Error(ERROR_MESSAGES.TICKET_NOT_FOUND);
      }

      if (!isAdmin(req.userRoles) && !canStaffAccessTicketByScope(ticket, req)) {
        throw new Error(ERROR_MESSAGES.FORBIDDEN);
      }

      const currentWorkflow = getCurrentWorkflowStatus(ticket);
      if ([WORKFLOW_STATUS.APPROVED, WORKFLOW_STATUS.ANNOUNCED, WORKFLOW_STATUS.EXPIRED, WORKFLOW_STATUS.DQ].includes(currentWorkflow)) {
        throw new Error('Ticket is immutable at current status.');
      }

      const nextWorkflow = buildReviewTransition(currentWorkflow, reviewerRole, action);

      const formData = {
        ...(ticket.form_data || {}),
        workflow_status: nextWorkflow,
        reason_for_return: action === 'return' ? String(reason) : null,
        status_log: [
          ...(Array.isArray(ticket.form_data?.status_log) ? ticket.form_data.status_log : []),
          {
            action,
            status: nextWorkflow,
            actor_id: req.session.user_id,
            actor_role: reviewerRole,
            timestamp: new Date().toISOString(),
            remark: reason ? String(reason) : null
          }
        ]
      };

      const result = await client.query(
        `UPDATE tickets
         SET status = $1,
             form_data = $2,
             reviewed_by = $3,
             reviewed_at = NOW(),
             review_notes = $4,
             reject_reason = $5,
             updated_at = NOW()
         WHERE id = $6
         RETURNING *`,
        [
          mapWorkflowToDbStatus(nextWorkflow),
          JSON.stringify(formData),
          req.session.user_id,
          reason || null,
          action === 'reject' ? reason || null : null,
          ticketId
        ]
      );

      await createAuditLog(client, req.session.user_id, action === 'reject' ? 'ticket_reject' : 'ticket_update', {
        resourceType: 'ticket',
        resourceId: ticketId,
        oldValues: { workflow_status: currentWorkflow },
        newValues: {
          action,
          workflow_status: nextWorkflow,
          actor_role: reviewerRole,
          remark: reason || null
        },
        remark:
          action === 'return'
            ? 'Ticket returned for revision with reason.'
            : action === 'reject'
              ? 'Ticket rejected by reviewer.'
              : 'Ticket accepted and moved to next review stage.'
      });

      return result.rows[0];
    });

    return res.status(200).json({
      message: 'Ticket reviewed successfully.',
      ticket: hydrateTicketResponse(updated)
    });
  } catch (error) {
    console.error('Review ticket error:', error);
    return res.status(400).json({ message: error.message || 'Error reviewing ticket.' });
  }
});

router.patch('/:id/approve', [requireAuth, getUserRoles], async (req, res) => {
  const ticketId = Number.parseInt(req.params.id, 10);
  if (Number.isNaN(ticketId)) {
    return res.status(400).json({ message: 'Invalid ticket id.' });
  }

  const isAuthorized = isAdmin(req.userRoles) || hasRole(req.userRoles, ROLES.DEAN);
  if (!isAuthorized) {
    return res.status(403).json({ message: ERROR_MESSAGES.FORBIDDEN });
  }

  try {
    const updated = await transaction(async (client) => {
      const ticket = await findTicketById(client, ticketId);
      if (!ticket) {
        throw new Error(ERROR_MESSAGES.TICKET_NOT_FOUND);
      }

      const currentWorkflow = getCurrentWorkflowStatus(ticket);
      if (currentWorkflow !== WORKFLOW_STATUS.REVIEWED_BY_DEAN) {
        throw new Error('Ticket must be in reviewed_by_dean status before approval.');
      }

      const actorRole = isAdmin(req.userRoles) ? ROLES.ADMIN : ROLES.DEAN;
      const formData = {
        ...(ticket.form_data || {}),
        workflow_status: WORKFLOW_STATUS.APPROVED,
        status_log: [
          ...(Array.isArray(ticket.form_data?.status_log) ? ticket.form_data.status_log : []),
          {
            action: 'approve',
            status: WORKFLOW_STATUS.APPROVED,
            actor_id: req.session.user_id,
            actor_role: actorRole,
            timestamp: new Date().toISOString(),
            remark: 'Approved and eligible for voting.'
          }
        ]
      };

      const result = await client.query(
        `UPDATE tickets
         SET status = $1,
             form_data = $2,
             reviewed_by = $3,
             reviewed_at = NOW(),
             updated_at = NOW()
         WHERE id = $4
         RETURNING *`,
        [mapWorkflowToDbStatus(WORKFLOW_STATUS.APPROVED), JSON.stringify(formData), req.session.user_id, ticketId]
      );

      await createAuditLog(client, req.session.user_id, 'ticket_accept', {
        resourceType: 'ticket',
        resourceId: ticketId,
        oldValues: { workflow_status: currentWorkflow },
        newValues: {
          action: 'approve',
          workflow_status: WORKFLOW_STATUS.APPROVED,
          actor_role: actorRole,
          voting_eligible: true
        },
        remark: 'Ticket approved for voting.'
      });

      return result.rows[0];
    });

    return res.status(200).json({
      message: 'Ticket approved for voting.',
      ticket: hydrateTicketResponse(updated)
    });
  } catch (error) {
    console.error('Approve ticket error:', error);
    return res.status(400).json({ message: error.message || 'Error approving ticket.' });
  }
});

router.patch('/:id/announce', [requireAuth, getUserRoles], async (req, res) => {
  const ticketId = Number.parseInt(req.params.id, 10);
  if (Number.isNaN(ticketId)) {
    return res.status(400).json({ message: 'Invalid ticket id.' });
  }

  if (!isAdmin(req.userRoles)) {
    return res.status(403).json({ message: ERROR_MESSAGES.FORBIDDEN });
  }

  try {
    const updated = await transaction(async (client) => {
      const ticket = await findTicketById(client, ticketId);
      if (!ticket) {
        throw new Error(ERROR_MESSAGES.TICKET_NOT_FOUND);
      }

      const currentWorkflow = getCurrentWorkflowStatus(ticket);
      if (currentWorkflow !== WORKFLOW_STATUS.APPROVED) {
        throw new Error('Only approved ticket can be announced.');
      }

      const formData = {
        ...(ticket.form_data || {}),
        workflow_status: WORKFLOW_STATUS.ANNOUNCED,
        status_log: [
          ...(Array.isArray(ticket.form_data?.status_log) ? ticket.form_data.status_log : []),
          {
            action: 'announce',
            status: WORKFLOW_STATUS.ANNOUNCED,
            actor_id: req.session.user_id,
            actor_role: ROLES.ADMIN,
            timestamp: new Date().toISOString(),
            remark: 'Final result announced.'
          }
        ]
      };

      const result = await client.query(
        `UPDATE tickets
         SET status = $1,
             form_data = $2,
             updated_at = NOW()
         WHERE id = $3
         RETURNING *`,
        [mapWorkflowToDbStatus(WORKFLOW_STATUS.ANNOUNCED), JSON.stringify(formData), ticketId]
      );

      await createAuditLog(client, req.session.user_id, 'admin_action', {
        resourceType: 'ticket',
        resourceId: ticketId,
        oldValues: { workflow_status: currentWorkflow },
        newValues: {
          action: 'announce',
          workflow_status: WORKFLOW_STATUS.ANNOUNCED,
          actor_role: ROLES.ADMIN
        },
        remark: 'Final result announced by admin.'
      });

      return result.rows[0];
    });

    return res.status(200).json({
      message: 'Ticket result announced.',
      ticket: hydrateTicketResponse(updated)
    });
  } catch (error) {
    console.error('Announce ticket error:', error);
    return res.status(400).json({ message: error.message || 'Error announcing ticket.' });
  }
});

router.patch('/:id/admin/override', [requireAuth, getUserRoles], async (req, res) => {
  const ticketId = Number.parseInt(req.params.id, 10);
  if (Number.isNaN(ticketId)) {
    return res.status(400).json({ message: 'Invalid ticket id.' });
  }

  if (!isAdmin(req.userRoles)) {
    return res.status(403).json({ message: ERROR_MESSAGES.FORBIDDEN });
  }

  const { status, remark } = req.body || {};
  if (!Object.values(WORKFLOW_STATUS).includes(status)) {
    return res.status(400).json({ message: 'Invalid override status.' });
  }

  try {
    const updated = await transaction(async (client) => {
      const ticket = await findTicketById(client, ticketId);
      if (!ticket) {
        throw new Error(ERROR_MESSAGES.TICKET_NOT_FOUND);
      }

      const oldWorkflow = getCurrentWorkflowStatus(ticket);
      const formData = {
        ...(ticket.form_data || {}),
        workflow_status: status,
        reason_for_return: status === WORKFLOW_STATUS.RETURNED ? (remark || 'Admin override return') : null,
        status_log: [
          ...(Array.isArray(ticket.form_data?.status_log) ? ticket.form_data.status_log : []),
          {
            action: 'override',
            status,
            actor_id: req.session.user_id,
            actor_role: ROLES.ADMIN,
            timestamp: new Date().toISOString(),
            remark: remark || null
          }
        ]
      };

      const result = await client.query(
        `UPDATE tickets
         SET status = $1,
             form_data = $2,
             updated_at = NOW()
         WHERE id = $3
         RETURNING *`,
        [mapWorkflowToDbStatus(status), JSON.stringify(formData), ticketId]
      );

      await createAuditLog(client, req.session.user_id, 'admin_action', {
        resourceType: 'ticket',
        resourceId: ticketId,
        oldValues: { workflow_status: oldWorkflow },
        newValues: {
          action: 'override',
          workflow_status: status,
          actor_role: ROLES.ADMIN,
          remark: remark || null
        },
        remark: 'Admin override ticket status.'
      });

      return result.rows[0];
    });

    return res.status(200).json({
      message: 'Ticket status overridden successfully.',
      ticket: hydrateTicketResponse(updated)
    });
  } catch (error) {
    console.error('Admin override error:', error);
    return res.status(400).json({ message: error.message || 'Error overriding ticket status.' });
  }
});

router.get('/:id/history', [requireAuth, getUserRoles], async (req, res) => {
  const ticketId = Number.parseInt(req.params.id, 10);
  if (Number.isNaN(ticketId)) {
    return res.status(400).json({ message: 'Invalid ticket id.' });
  }

  const client = await pool.connect();
  try {
    const ticket = await findTicketById(client, ticketId);
    if (!ticket) {
      return res.status(404).json({ message: ERROR_MESSAGES.TICKET_NOT_FOUND });
    }

    const isOwner = ticket.user_id === req.session.user_id;
    const scopedStaffAccess = isStaffOrHigher(req.userRoles) && canStaffAccessTicketByScope(ticket, req);
    const canView = isOwner || isAdmin(req.userRoles) || scopedStaffAccess;

    if (!canView) {
      return res.status(403).json({ message: ERROR_MESSAGES.FORBIDDEN });
    }

    const history = await getAuditHistory(client, ticketId);
    return res.status(200).json({ ticket_id: ticketId, history });
  } catch (error) {
    console.error('Get ticket history error:', error);
    return res.status(500).json({ message: 'Error fetching ticket history.' });
  } finally {
    client.release();
  }
});

module.exports = router;
