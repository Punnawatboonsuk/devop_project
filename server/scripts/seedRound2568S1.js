/**
 * Seed round 2568 S1 in VOTING phase with votes already cast (voting still open).
 * Run: npm run seed-round-2568s1 (from server/)
 */

require('dotenv').config();
const { pool } = require('../src/config/database');
const { hashpw, gensalt } = require('../src/utils/ripcrypt');

const PASSWORD = '123456789';
const FACULTY = 'คณะวิทยาศาสตร์';
const DEPT_A = 'วิทยาการคอมพิวเตอร์';
const DEPT_B = 'คณิตศาสตร์';

const USERS = [
  { email: 'student1@ku.th', ku_id: '661000001', role: 'STUDENT', faculty: FACULTY, department: DEPT_A },
  { email: 'student2@ku.th', ku_id: '661000002', role: 'STUDENT', faculty: FACULTY, department: DEPT_A },
  { email: 'student3@ku.th', ku_id: '661000003', role: 'STUDENT', faculty: FACULTY, department: DEPT_B },
  { email: 'student4@ku.th', ku_id: '661000004', role: 'STUDENT', faculty: FACULTY, department: DEPT_B },
  { email: 'staff1@ku.th', ku_id: '660900001', role: 'STAFF', faculty: FACULTY, department: DEPT_A },
  { email: 'staff2@ku.th', ku_id: '660900002', role: 'STAFF', faculty: FACULTY, department: DEPT_B },
  { email: 'subdean1@ku.th', ku_id: '660900003', role: 'SUB_DEAN', faculty: FACULTY, department: DEPT_A },
  { email: 'subdean2@ku.th', ku_id: '660900004', role: 'SUB_DEAN', faculty: FACULTY, department: DEPT_B },
  { email: 'dean1@ku.th', ku_id: '660900005', role: 'DEAN', faculty: FACULTY, department: DEPT_A },
  { email: 'dean2@ku.th', ku_id: '660900006', role: 'DEAN', faculty: FACULTY, department: DEPT_B },
  { email: 'committee1@ku.th', ku_id: '660800001', role: 'COMMITTEE' },
  { email: 'committee2@ku.th', ku_id: '660800002', role: 'COMMITTEE' },
  { email: 'committee3@ku.th', ku_id: '660800003', role: 'COMMITTEE' },
  { email: 'committee4@ku.th', ku_id: '660800004', role: 'COMMITTEE' },
  { email: 'committeepresident1@ku.th', ku_id: '660800005', role: 'COMMITTEE_PRESIDENT' },
  { email: 'admin1@ku.th', ku_id: '660700001', role: 'ADMIN' }
];

const ROLE_DESCRIPTIONS = {
  STUDENT: 'Student',
  STAFF: 'Staff',
  SUB_DEAN: 'Sub Dean',
  DEAN: 'Dean',
  COMMITTEE: 'Committee',
  COMMITTEE_PRESIDENT: 'Committee President',
  ADMIN: 'Admin'
};

const AWARD_TYPES = ['activity_enrichment', 'creativity_innovation', 'good_behavior'];

function nowMinusDays(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

async function ensureRoles(client) {
  for (const [name, desc] of Object.entries(ROLE_DESCRIPTIONS)) {
    await client.query(
      `INSERT INTO roles (name, description)
       VALUES ($1, $2)
       ON CONFLICT (name) DO NOTHING`,
      [name, desc]
    );
  }
}

async function upsertUser(client, user) {
  const salt = gensalt();
  const passwordHash = hashpw(PASSWORD, salt);
  const fullname = user.email;

  const result = await client.query(
    `INSERT INTO users (ku_id, email, fullname, faculty, department, password_hash, sso_enabled)
     VALUES ($1, $2, $3, $4, $5, $6, true)
     ON CONFLICT (email) DO UPDATE SET
       ku_id = EXCLUDED.ku_id,
       fullname = EXCLUDED.fullname,
       faculty = EXCLUDED.faculty,
       department = EXCLUDED.department,
       password_hash = EXCLUDED.password_hash,
       sso_enabled = EXCLUDED.sso_enabled
     RETURNING id`,
    [
      user.ku_id || null,
      user.email,
      fullname,
      user.faculty || null,
      user.department || null,
      passwordHash
    ]
  );

  return result.rows[0].id;
}

async function assignRole(client, userId, roleName) {
  const roleResult = await client.query('SELECT id FROM roles WHERE name = $1', [roleName]);
  const roleId = roleResult.rows[0]?.id;
  if (!roleId) throw new Error(`Role not found: ${roleName}`);

  await client.query(
    `INSERT INTO user_roles (user_id, role_id)
     VALUES ($1, $2)
     ON CONFLICT (user_id, role_id) DO NOTHING`,
    [userId, roleId]
  );
}

async function upsertRound(client) {
  await client.query(
    `INSERT INTO selection_round (academic_year, semester, name)
     VALUES ($1, $2, $3)
     ON CONFLICT (academic_year, semester)
     DO UPDATE SET name = EXCLUDED.name`,
    [2568, 1, 'Nisit Deeden 2568 S1']
  );
}

async function getRoundId(client) {
  const result = await client.query(
    `SELECT id
     FROM selection_round
     WHERE academic_year = 2568 AND semester = 1`
  );
  return result.rows[0]?.id || null;
}

async function resetRoundData(client, roundId) {
  await client.query(
    `DELETE FROM votes
     WHERE ticket_id IN (
       SELECT id FROM tickets WHERE round_id = $1
     )`,
    [roundId]
  );
  await client.query('DELETE FROM tickets WHERE round_id = $1', [roundId]);
  await client.query('DELETE FROM round_phase_history WHERE round_id = $1', [roundId]);
}

async function seedPhases(client, roundId) {
  const phases = [
    ['NOMINATION', 40, 30],
    ['REVIEW_END', 30, 20],
    ['VOTING', 20, null]
  ];

  for (const [phase, startDays, endDays] of phases) {
    const startedAt = nowMinusDays(startDays);
    const endedAt = endDays === null ? null : nowMinusDays(endDays);
    await client.query(
      `INSERT INTO round_phase_history (round_id, phase, started_at, ended_at, notes)
       VALUES ($1, $2::phase_status, $3, $4, 'seed-2568s1')`,
      [roundId, phase, startedAt, endedAt]
    );
  }
}

function buildTicketSeed(roundId) {
  const students = [
    { email: 'student1@ku.th', name: 'student1@ku.th', ku_id: '661000001', faculty: FACULTY, department: DEPT_A, gender: 'male' },
    { email: 'student2@ku.th', name: 'student2@ku.th', ku_id: '661000002', faculty: FACULTY, department: DEPT_A, gender: 'female' },
    { email: 'student3@ku.th', name: 'student3@ku.th', ku_id: '661000003', faculty: FACULTY, department: DEPT_B, gender: 'male' },
    { email: 'student4@ku.th', name: 'student4@ku.th', ku_id: '661000004', faculty: FACULTY, department: DEPT_B, gender: 'female' }
  ];

  const awardPlan = [
    { award_type: AWARD_TYPES[0] },
    { award_type: AWARD_TYPES[1] },
    { award_type: AWARD_TYPES[2] },
    { award_type: AWARD_TYPES[0] }
  ];

  return students.map((student, index) => {
    const plan = awardPlan[index];
    const seedKey = `SEED-2568-1-${index + 1}`;
    return {
      roundId,
      academicYear: '2568',
      semester: 1,
      awardType: plan.award_type,
      seedKey,
      student
    };
  });
}

async function seedTickets(client, roundId) {
  const userIdMap = new Map();
  for (const user of USERS.filter((u) => u.role === 'STUDENT')) {
    const result = await client.query('SELECT id FROM users WHERE email = $1', [user.email]);
    if (result.rows[0]) userIdMap.set(user.email, result.rows[0].id);
  }

  const tickets = buildTicketSeed(roundId);
  for (const ticket of tickets) {
    const userId = userIdMap.get(ticket.student.email);
    const submittedAt = nowMinusDays(18);
    const formData = {
      workflow_status: 'approved',
      submitted_at: submittedAt.toISOString(),
      full_name_thai: ticket.student.name,
      student_code: ticket.student.ku_id,
      gender: ticket.student.gender,
      faculty: ticket.student.faculty,
      department: ticket.student.department,
      academic_year: ticket.academicYear,
      gpa: '3.45',
      portfolio_description: `Example portfolio for ${ticket.seedKey}`,
      achievements: `Example achievements for ${ticket.seedKey}`,
      activity_hours: ticket.awardType === 'activity_enrichment' ? '45' : '',
      seed_key: ticket.seedKey
    };

    await client.query(
      `INSERT INTO tickets
       (user_id, award_type, academic_year, semester, status, form_data, round_id, submitted_at)
       VALUES ($1, $2::award_type, $3, $4, 'approved'::ticket_status, $5, $6, $7)`,
      [
        userId,
        ticket.awardType,
        ticket.academicYear,
        ticket.semester,
        formData,
        ticket.roundId,
        submittedAt
      ]
    );
  }
}

async function seedVotes(client, roundId) {
  const committeeEmails = ['committee1@ku.th', 'committee2@ku.th', 'committee3@ku.th', 'committee4@ku.th'];
  const committeeRows = await client.query(
    'SELECT id, email FROM users WHERE email = ANY($1)',
    [committeeEmails]
  );
  const committeeIds = committeeRows.rows.map((row) => row.id);

  const ticketRows = await client.query(
    `SELECT id, round_id, form_data
     FROM tickets
     WHERE round_id = $1 AND form_data->>'seed_key' LIKE 'SEED-2568-1-%'`,
    [roundId]
  );

  for (const ticket of ticketRows.rows) {
    const votes = ['approved', 'approved', 'not_approved', 'not_approved'];

    for (let i = 0; i < committeeIds.length; i += 1) {
      await client.query(
        `INSERT INTO votes (ticket_id, user_id, vote, round_id, notes)
         VALUES ($1, $2, $3::vote_choice, $4, 'seed vote')
         ON CONFLICT (ticket_id, user_id) DO NOTHING`,
        [ticket.id, committeeIds[i], votes[i], ticket.round_id]
      );
    }
  }
}

async function run() {
  const client = await pool.connect();
  try {
    console.log('Seeding 2568 S1 (voting open, votes already cast)...');
    await client.query('BEGIN');

    await ensureRoles(client);

    const userIdByEmail = new Map();
    for (const user of USERS) {
      const id = await upsertUser(client, user);
      userIdByEmail.set(user.email, id);
    }

    for (const user of USERS) {
      await assignRole(client, userIdByEmail.get(user.email), user.role);
    }

    await upsertRound(client);
    const roundId = await getRoundId(client);
    if (!roundId) throw new Error('Round 2568/1 not found or failed to create.');

    await resetRoundData(client, roundId);
    await seedPhases(client, roundId);
    await seedTickets(client, roundId);
    await seedVotes(client, roundId);

    await client.query('COMMIT');
    console.log('Seed completed.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Seed failed:', error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

run();
