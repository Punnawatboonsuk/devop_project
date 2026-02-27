const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { pool, transaction } = require('../config/database');
const { ROLES, PHASES, TICKET_STATUS, VOTE_CHOICES, LOG_ACTIONS } = require('../utils/constants');
const { getRoundById, getCurrentPhaseForRound, getActiveRound } = require('../services/roundPhase');

const router = express.Router();

function canVote(userRoles) {
  return userRoles.includes(ROLES.COMMITTEE) || userRoles.includes(ROLES.COMMITTEE_PRESIDENT);
}

function canPublish(userRoles) {
  return userRoles.includes(ROLES.COMMITTEE_PRESIDENT);
}

function isAdmin(userRoles) {
  return userRoles.includes(ROLES.ADMIN);
}

const signatureDir = path.resolve(process.cwd(), 'uploads', 'signatures');
if (!fs.existsSync(signatureDir)) {
  fs.mkdirSync(signatureDir, { recursive: true });
}

const signatureUpload = multer({
  dest: signatureDir,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!String(file.mimetype || '').toLowerCase().startsWith('image/')) {
      return cb(new Error('Signature file must be an image.'));
    }
    return cb(null, true);
  }
});

function uploadSignatureMiddleware(req, res, next) {
  signatureUpload.single('signature')(req, res, (err) => {
    if (!err) return next();
    return res.status(400).json({ message: err.message || 'Invalid signature file upload.' });
  });
}

async function createAuditLog(client, userId, action, data = {}) {
  await client.query(
    `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, new_values)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, action, data.resourceType || null, data.resourceId || null, JSON.stringify(data.newValues || {})]
  );
}

async function requireCommitteeAuth(req, res, next) {
  if (!req.session.user_id) {
    return res.status(401).json({ message: 'Authentication required' });
  }

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
    if (!canVote(req.userRoles)) {
      return res.status(403).json({ message: 'Access denied. Committee members only' });
    }

    return next();
  } catch (error) {
    console.error('Committee auth error:', error);
    return res.status(500).json({ message: 'Authentication error' });
  } finally {
    client.release();
  }
}

async function requirePublisherAuth(req, res, next) {
  if (!req.session.user_id) {
    return res.status(401).json({ message: 'Authentication required' });
  }

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
    if (!canPublish(req.userRoles)) {
      return res.status(403).json({ message: 'Access denied. Committee president only' });
    }

    return next();
  } catch (error) {
    console.error('Publisher auth error:', error);
    return res.status(500).json({ message: 'Authentication error' });
  } finally {
    client.release();
  }
}

async function requireAdminAuth(req, res, next) {
  if (!req.session.user_id) {
    return res.status(401).json({ message: 'Authentication required' });
  }

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
    if (!isAdmin(req.userRoles)) {
      return res.status(403).json({ message: 'Access denied. Admin only' });
    }

    return next();
  } catch (error) {
    console.error('Admin auth error:', error);
    return res.status(500).json({ message: 'Authentication error' });
  } finally {
    client.release();
  }
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

async function resolveRound(client, requestedRoundId) {
  const parsed = Number.parseInt(requestedRoundId, 10);
  if (!Number.isNaN(parsed) && parsed > 0) {
    return getRoundById(client, parsed);
  }

  const active = await getActiveRound(client);
  if (active) {
    return active;
  }

  const latest = await client.query(
    `SELECT id, academic_year, semester, name, created_at
     FROM selection_round
     ORDER BY academic_year DESC, semester DESC, created_at DESC
     LIMIT 1`
  );
  return latest.rows[0] || null;
}

async function getRoundCandidates(client, { roundId, userId = null }) {
  const params = [VOTE_CHOICES.APPROVED, VOTE_CHOICES.NOT_APPROVED, roundId, TICKET_STATUS.APPROVED];
  const myVoteSelect = userId
    ? `MAX(CASE WHEN v.user_id = $5 THEN v.vote END) AS my_vote,
       MAX(CASE WHEN v.user_id = $5 THEN v.voted_at END) AS my_voted_at`
    : `NULL::text AS my_vote,
       NULL::timestamp AS my_voted_at`;

  const query = `
    SELECT
      t.id,
      t.round_id,
      t.award_type,
      t.created_at,
      t.form_data,
      u.fullname AS owner_fullname,
      u.ku_id AS owner_ku_id,
      u.faculty AS owner_faculty,
      u.department AS owner_department,
      COUNT(v.id)::int AS total_votes,
      COUNT(CASE WHEN v.vote = $1 THEN 1 END)::int AS approved_votes,
      COUNT(CASE WHEN v.vote = $2 THEN 1 END)::int AS not_approved_votes,
      ${myVoteSelect}
    FROM tickets t
    JOIN users u ON t.user_id = u.id
    LEFT JOIN votes v ON v.ticket_id = t.id
    WHERE t.round_id = $3
      AND t.status = $4
    GROUP BY t.id, u.fullname, u.ku_id, u.faculty, u.department
    ORDER BY t.created_at DESC
  `;

  const result = await client.query(query, userId ? [...params, userId] : params);
  return result.rows;
}

function parseAchievements(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter(Boolean).map((item) => String(item).trim()).filter(Boolean);
  return String(raw)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function toCandidateDTO(row, totalCommittee) {
  const formData = row.form_data || {};
  const threshold = Math.floor(totalCommittee / 2) + 1;

  return {
    id: row.id,
    round_id: row.round_id,
    ku_id: formData.student_code || row.owner_ku_id || null,
    fullname: formData.full_name || row.owner_fullname || null,
    faculty: formData.faculty || row.owner_faculty || null,
    department: formData.department || row.owner_department || null,
    award_type: row.award_type,
    gpa: formData.gpa ?? null,
    portfolio_description: formData.portfolio_description || null,
    achievements: parseAchievements(formData.achievements),
    created_at: row.created_at,
    announced_at: formData.announced_at || null,
    voting: {
      approved: row.approved_votes || 0,
      not_approved: row.not_approved_votes || 0,
      total_votes: row.total_votes || 0,
      total_committee: totalCommittee,
      threshold_required: threshold,
      threshold_met: (row.approved_votes || 0) >= threshold
    },
    my_vote: row.my_vote || null,
    my_voted_at: row.my_voted_at || null
  };
}

async function getRoundWinners(client, roundId, totalCommittee) {
  const threshold = Math.floor(totalCommittee / 2) + 1;
  const rows = await getRoundCandidates(client, { roundId });
  const candidates = rows.map((row) => toCandidateDTO(row, totalCommittee));

  const byAward = new Map();
  for (const candidate of candidates) {
    const key = candidate.award_type;
    if (!byAward.has(key)) byAward.set(key, []);
    byAward.get(key).push(candidate);
  }

  const winners = [];
  for (const [, list] of byAward.entries()) {
    const qualified = list
      .filter((item) => item.voting.threshold_met)
      .sort((a, b) => {
        if (b.voting.approved !== a.voting.approved) {
          return b.voting.approved - a.voting.approved;
        }
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });

    if (qualified.length > 0) {
      const winner = qualified[0];
      winners.push({
        ...winner,
        rank: 1
      });
    }
  }

  winners.sort((a, b) => a.award_type.localeCompare(b.award_type));
  return { winners, threshold_required: threshold };
}

router.get('/tickets', requireCommitteeAuth, async (req, res) => {
  try {
    const client = await pool.connect();
    try {
      const round = await resolveRound(client, req.query.round_id);
      if (!round) {
        return res.status(200).json({
          tickets: [],
          summary: {
            total_tickets: 0,
            total_committee: 0
          }
        });
      }

      const phaseInfo = await getCurrentPhaseForRound(client, round.id);
      const totalCommittee = await getCommitteeCount(client);
      const rows = await getRoundCandidates(client, { roundId: round.id, userId: req.session.user_id });
      const tickets = rows.map((row) => toCandidateDTO(row, totalCommittee));

      const categoryMap = new Map();
      for (const ticket of tickets) {
        const key = ticket.award_type;
        if (!categoryMap.has(key)) {
          categoryMap.set(key, { award_type: key, candidates: 0 });
        }
        categoryMap.get(key).candidates += 1;
      }

      const pending_vote = tickets.filter((ticket) => !ticket.my_vote).length;

      return res.status(200).json({
        round: {
          id: round.id,
          academic_year: round.academic_year,
          semester: round.semester,
          name: round.name
        },
        phase: phaseInfo?.phase || null,
        tickets,
        summary: {
          total_tickets: tickets.length,
          total_committee: totalCommittee,
          pending_vote
        },
        categories: Array.from(categoryMap.values()).sort((a, b) => a.award_type.localeCompare(b.award_type))
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Get committee tickets error:', error);
    return res.status(500).json({ message: 'Error fetching committee tickets' });
  }
});

router.get('/tickets/:ticketId', requireCommitteeAuth, async (req, res) => {
  const ticketId = Number.parseInt(req.params.ticketId, 10);
  if (Number.isNaN(ticketId)) {
    return res.status(400).json({ message: 'Invalid ticket id' });
  }

  try {
    const client = await pool.connect();
    try {
      const ticketResult = await client.query(
        `SELECT
           t.id,
           t.user_id,
           t.round_id,
           t.status,
           t.award_type,
           t.form_data,
           t.created_at,
           u.fullname AS owner_fullname,
           u.ku_id AS owner_ku_id,
           u.faculty AS owner_faculty,
           u.department AS owner_department
         FROM tickets t
         JOIN users u ON t.user_id = u.id
         WHERE t.id = $1`,
        [ticketId]
      );

      if (ticketResult.rows.length === 0) {
        return res.status(404).json({ message: 'Ticket not found' });
      }

      const ticket = ticketResult.rows[0];
      if (ticket.status !== TICKET_STATUS.APPROVED) {
        return res.status(400).json({ message: 'Ticket is not eligible for committee voting' });
      }

      const totalCommittee = await getCommitteeCount(client);
      const voteStats = await client.query(
        `SELECT
           COUNT(*)::int AS total_votes,
           COUNT(CASE WHEN vote = $2 THEN 1 END)::int AS approved_votes,
           COUNT(CASE WHEN vote = $3 THEN 1 END)::int AS not_approved_votes,
           MAX(CASE WHEN user_id = $4 THEN vote END) AS my_vote,
           MAX(CASE WHEN user_id = $4 THEN voted_at END) AS my_voted_at
         FROM votes
         WHERE ticket_id = $1`,
        [ticketId, VOTE_CHOICES.APPROVED, VOTE_CHOICES.NOT_APPROVED, req.session.user_id]
      );

      const filesResult = await client.query(
        `SELECT id, original_name, mime_type, file_category, uploaded_at
         FROM ticket_files
         WHERE ticket_id = $1
           AND deleted_at IS NULL
         ORDER BY uploaded_at ASC`,
        [ticketId]
      );

      const combined = {
        ...ticket,
        total_votes: voteStats.rows[0]?.total_votes || 0,
        approved_votes: voteStats.rows[0]?.approved_votes || 0,
        not_approved_votes: voteStats.rows[0]?.not_approved_votes || 0,
        my_vote: voteStats.rows[0]?.my_vote || null,
        my_voted_at: voteStats.rows[0]?.my_voted_at || null
      };
      const candidate = toCandidateDTO(combined, totalCommittee);
      const files = filesResult.rows.map((file) => ({
        ...file,
        download_url: `/api/uploads/file/${file.id}/download`
      }));

      return res.status(200).json({
        candidate,
        files
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Get committee ticket detail error:', error);
    return res.status(500).json({ message: 'Error fetching ticket details' });
  }
});

router.post('/:ticketId/submit', requireCommitteeAuth, async (req, res) => {
  const ticketId = Number.parseInt(req.params.ticketId, 10);
  if (Number.isNaN(ticketId)) {
    return res.status(400).json({ message: 'Invalid ticket id' });
  }

  const { vote_result, notes = null } = req.body || {};
  if (![VOTE_CHOICES.APPROVED, VOTE_CHOICES.NOT_APPROVED].includes(vote_result)) {
    return res.status(400).json({ message: 'Invalid vote choice. Use "approved" or "not_approved"' });
  }

  try {
    const result = await transaction(async (client) => {
      const ticketResult = await client.query(
        `SELECT id, round_id, award_type, status
         FROM tickets
         WHERE id = $1`,
        [ticketId]
      );

      if (ticketResult.rows.length === 0) {
        throw new Error('Ticket not found');
      }

      const ticket = ticketResult.rows[0];
      if (ticket.status !== TICKET_STATUS.APPROVED) {
        throw new Error('Ticket is not eligible for voting');
      }

      if (!ticket.round_id) {
        throw new Error('Ticket is missing round information');
      }

      const phaseInfo = await getCurrentPhaseForRound(client, ticket.round_id);
      if (!phaseInfo || phaseInfo.phase !== PHASES.VOTING) {
        throw new Error(`Voting is closed for this round (current phase: ${phaseInfo?.phase || 'NONE'})`);
      }

      const existingVote = await client.query(
        `SELECT id
         FROM votes
         WHERE ticket_id = $1
           AND user_id = $2`,
        [ticketId, req.session.user_id]
      );
      if (existingVote.rows.length > 0) {
        throw new Error('You have already voted for this candidate');
      }

      await client.query(
        `INSERT INTO votes (ticket_id, user_id, vote, notes, round_id, voted_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
        [ticketId, req.session.user_id, vote_result, notes ? String(notes) : null, ticket.round_id]
      );

      await createAuditLog(client, req.session.user_id, LOG_ACTIONS.VOTE_SUBMIT, {
        resourceType: 'vote',
        resourceId: ticketId,
        newValues: {
          ticket_id: ticketId,
          round_id: ticket.round_id,
          vote: vote_result,
          notes: notes ? String(notes) : null
        }
      });

      return { ticket };
    });

    return res.status(200).json({
      success: true,
      message: 'Vote submitted successfully',
      ticket_id: result.ticket.id,
      round_id: result.ticket.round_id
    });
  } catch (error) {
    console.error('Submit vote error:', error);
    return res.status(400).json({ message: error.message || 'Error submitting vote' });
  }
});

router.get('/my-votes', requireCommitteeAuth, async (req, res) => {
  try {
    const client = await pool.connect();
    try {
      const votesResult = await client.query(
        `SELECT
           v.id,
           v.ticket_id,
           v.vote,
           v.notes,
           v.voted_at,
           v.round_id,
           t.award_type,
           t.form_data,
           u.fullname,
           u.ku_id
         FROM votes v
         JOIN tickets t ON t.id = v.ticket_id
         JOIN users u ON u.id = t.user_id
         WHERE v.user_id = $1
         ORDER BY v.voted_at DESC`,
        [req.session.user_id]
      );

      const votes = votesResult.rows.map((row) => ({
        id: row.id,
        ticket_id: row.ticket_id,
        vote: row.vote,
        notes: row.notes || null,
        voted_at: row.voted_at,
        round_id: row.round_id,
        ticket: {
          award_type: row.award_type,
          fullname: row.form_data?.full_name || row.fullname || null,
          ku_id: row.form_data?.student_code || row.ku_id || null
        }
      }));

      return res.status(200).json({
        votes,
        total_votes: votes.length
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Get my votes error:', error);
    return res.status(500).json({ message: 'Error fetching your votes' });
  }
});

router.get('/proclamation', requireCommitteeAuth, async (req, res) => {
  try {
    const client = await pool.connect();
    try {
      const round = await resolveRound(client, req.query.round_id);
      if (!round) {
        return res.status(200).json({
          round: null,
          phase: null,
          winners: [],
          history: []
        });
      }

      const totalCommittee = await getCommitteeCount(client);
      const phaseInfo = await getCurrentPhaseForRound(client, round.id);
      const current = await getRoundWinners(client, round.id, totalCommittee);

      const historyRoundsResult = await client.query(
        `SELECT id, academic_year, semester, name
         FROM selection_round
         WHERE id <> $1
         ORDER BY academic_year DESC, semester DESC
         LIMIT 5`,
        [round.id]
      );

      const history = [];
      for (const historyRound of historyRoundsResult.rows) {
        const roundResult = await getRoundWinners(client, historyRound.id, totalCommittee);
        history.push({
          round: {
            id: historyRound.id,
            academic_year: historyRound.academic_year,
            semester: historyRound.semester,
            name: historyRound.name
          },
          winners: roundResult.winners
        });
      }

      return res.status(200).json({
        round: {
          id: round.id,
          academic_year: round.academic_year,
          semester: round.semester,
          name: round.name
        },
        phase: phaseInfo?.phase || null,
        permissions: {
          can_publish: canPublish(req.userRoles || []) && phaseInfo?.phase === PHASES.VOTING_END
        },
        winners: current.winners,
        threshold_required: current.threshold_required,
        total_committee: totalCommittee,
        history
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Get proclamation error:', error);
    return res.status(500).json({ message: 'Error fetching proclamation data' });
  }
});

router.post('/proclamation/publish', [requirePublisherAuth, uploadSignatureMiddleware], async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Signature file is required.' });
    }

    const result = await transaction(async (client) => {
      const round = await resolveRound(client, req.body?.round_id);
      if (!round) {
        throw new Error('Round not found');
      }

      const phaseInfo = await getCurrentPhaseForRound(client, round.id);
      if (!phaseInfo || phaseInfo.phase !== PHASES.VOTING_END) {
        throw new Error(`Proclamation is allowed only when admin sets phase to VOTING_END (current phase: ${phaseInfo?.phase || 'NONE'})`);
      }

      const totalCommittee = await getCommitteeCount(client);
      const winnersResult = await getRoundWinners(client, round.id, totalCommittee);
      const winnerIds = winnersResult.winners.map((winner) => winner.id);
      const signatureMeta = {
        filename: req.file.filename,
        original_name: req.file.originalname,
        mime_type: req.file.mimetype,
        file_size: req.file.size,
        file_path: req.file.path
      };

      for (const ticketId of winnerIds) {
        const currentTicket = await client.query(
          `SELECT form_data
           FROM tickets
           WHERE id = $1`,
          [ticketId]
        );
        const formData = currentTicket.rows[0]?.form_data || {};
        const statusLog = Array.isArray(formData.status_log) ? formData.status_log : [];
        statusLog.push({
          action: 'announce',
          status: 'announced',
          actor_id: req.session.user_id,
          actor_role: ROLES.COMMITTEE_PRESIDENT,
          timestamp: new Date().toISOString(),
          remark: 'Published through committee proclamation with president signature',
          signature_file: signatureMeta
        });

        const nextFormData = {
          ...formData,
          workflow_status: 'announced',
          announced_at: new Date().toISOString(),
          proclamation_signature: signatureMeta,
          status_log: statusLog
        };

        await client.query(
          `UPDATE tickets
           SET form_data = $1,
               updated_at = NOW()
           WHERE id = $2`,
          [JSON.stringify(nextFormData), ticketId]
        );
      }

      await createAuditLog(client, req.session.user_id, LOG_ACTIONS.ADMIN_ACTION, {
        resourceType: 'proclamation',
        resourceId: round.id,
        newValues: {
          round_id: round.id,
          winners_count: winnerIds.length,
          winner_ticket_ids: winnerIds,
          signed_by: req.session.user_id,
          signature_file: signatureMeta
        }
      });

      return {
        round,
        winners_count: winnerIds.length,
        signature: signatureMeta
      };
    });

    return res.status(200).json({
      success: true,
      message: 'Proclamation published successfully',
      round: {
        id: result.round.id,
        academic_year: result.round.academic_year,
        semester: result.round.semester
      },
      winners_count: result.winners_count,
      signature: result.signature
    });
  } catch (error) {
    if (req.file?.path) {
      fs.unlink(req.file.path, () => {});
    }
    console.error('Publish proclamation error:', error);
    return res.status(400).json({ message: error.message || 'Error publishing proclamation' });
  }
});

router.get('/:ticketId/results', requireAdminAuth, async (req, res) => {
  const ticketId = Number.parseInt(req.params.ticketId, 10);
  if (Number.isNaN(ticketId)) {
    return res.status(400).json({ message: 'Invalid ticket id' });
  }

  try {
    const client = await pool.connect();
    try {
      const ticketResult = await client.query(
        `SELECT t.id, t.round_id, t.award_type, t.form_data, u.fullname, u.ku_id
         FROM tickets t
         JOIN users u ON u.id = t.user_id
         WHERE t.id = $1`,
        [ticketId]
      );
      if (ticketResult.rows.length === 0) {
        return res.status(404).json({ message: 'Ticket not found' });
      }

      const totalCommittee = await getCommitteeCount(client);
      const statsResult = await client.query(
        `SELECT
           COUNT(*)::int AS total_votes,
           COUNT(CASE WHEN vote = $2 THEN 1 END)::int AS approved_votes,
           COUNT(CASE WHEN vote = $3 THEN 1 END)::int AS not_approved_votes
         FROM votes
         WHERE ticket_id = $1`,
        [ticketId, VOTE_CHOICES.APPROVED, VOTE_CHOICES.NOT_APPROVED]
      );

      const threshold = Math.floor(totalCommittee / 2) + 1;
      const stats = statsResult.rows[0] || {};
      const approvedVotes = stats.approved_votes || 0;

      return res.status(200).json({
        ticket: {
          id: ticketResult.rows[0].id,
          round_id: ticketResult.rows[0].round_id,
          award_type: ticketResult.rows[0].award_type,
          fullname: ticketResult.rows[0].form_data?.full_name || ticketResult.rows[0].fullname || null,
          ku_id: ticketResult.rows[0].form_data?.student_code || ticketResult.rows[0].ku_id || null
        },
        voting_results: {
          approved_votes: approvedVotes,
          not_approved_votes: stats.not_approved_votes || 0,
          total_votes: stats.total_votes || 0,
          total_committee: totalCommittee,
          threshold_required: threshold,
          threshold_met: approvedVotes >= threshold
        }
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Get vote results error:', error);
    return res.status(500).json({ message: 'Error fetching vote results' });
  }
});

module.exports = router;
