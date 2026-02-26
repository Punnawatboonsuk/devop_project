const express = require('express');
const { pool, transaction } = require('../config/database');
const { ROLES, PHASES, TICKET_STATUS, VOTE_CHOICES, VOTE_THRESHOLD, LOG_ACTIONS } = require('../utils/constants');
const router = express.Router();

/* ==================== Helper Functions ==================== */

/**
 * Check if user has voting rights
 */
function canVote(userRoles) {
  return userRoles.includes(ROLES.COMMITTEE) || userRoles.includes(ROLES.COMMITTEE_PRESIDENT);
}

/**
 * Check if user is admin
 */
function isAdmin(userRoles) {
  return userRoles.includes(ROLES.ADMIN);
}

/**
 * Check if voting is open for an award type
 */
async function isVotingOpen(client, awardType) {
  const result = await client.query(
    'SELECT status FROM voting_phase WHERE award_type = $1',
    [awardType]
  );
  
  const phase = result.rows[0];
  return phase && phase.status === 'voting';
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

/* ==================== Middleware ==================== */

/**
 * Verify user is authenticated and has voting rights
 */
async function requireCommitteeAuth(req, res, next) {
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

    if (!canVote(roles)) {
      return res.status(403).json({ message: 'Access denied. Committee members only' });
    }

    next();
  } catch (error) {
    console.error('Auth error:', error);
    res.status(500).json({ message: 'Authentication error' });
  } finally {
    client.release();
  }
}

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

/**
 * GET /api/votes/tickets
 * Get list of votable tickets for committee members
 * Shows tickets that are approved and in voting phase
 */
router.get('/tickets', requireCommitteeAuth, async (req, res) => {
  try {
    const client = await pool.connect();
    try {
      // Get all award types that are currently in voting phase
      const votingPhases = await client.query(
        'SELECT award_type FROM voting_phase WHERE status = $1',
        ['voting']
      );

      const awardTypes = votingPhases.rows.map(row => row.award_type);
      
      if (awardTypes.length === 0) {
        return res.status(200).json({
          message: 'No voting phase active',
          tickets: [],
          votingPhases: []
        });
      }

      // Get tickets that are approved and belong to active voting phases
      const ticketsResult = await client.query(
        `SELECT t.id, t.ku_id, t.fullname, t.faculty, t.department, 
                t.award_type, t.status, t.created_at,
                COUNT(v.id) as vote_count,
                COUNT(CASE WHEN v.vote_result = $1 THEN 1 END) as approve_count
         FROM tickets t
         LEFT JOIN vote v ON t.id = v.ticket_id
         WHERE t.status = $2 AND t.award_type = ANY($3)
         GROUP BY t.id
         ORDER BY t.created_at DESC`,
        [VOTE_CHOICES.APPROVED, TICKET_STATUS.APPROVED, awardTypes]
      );

      // Get total committee count for threshold calculation
      const committeeCountResult = await client.query(
        `SELECT COUNT(DISTINCT ur.user_id) as total_committee
         FROM user_roles ur
         JOIN roles r ON ur.role_id = r.id
         WHERE r.name IN ($1, $2)`,
        [ROLES.COMMITTEE, ROLES.COMMITTEE_PRESIDENT]
      );

      const totalCommittee = committeeCountResult.rows[0]?.total_committee || 0;

      const tickets = ticketsResult.rows.map(ticket => ({
        id: ticket.id,
        ku_id: ticket.ku_id,
        fullname: ticket.fullname,
        faculty: ticket.faculty,
        department: ticket.department,
        award_type: ticket.award_type,
        status: ticket.status,
        created_at: ticket.created_at,
        voting_progress: {
          voted: parseInt(ticket.vote_count),
          total: totalCommittee,
          approve_count: parseInt(ticket.approve_count),
          threshold: Math.floor(totalCommittee / 2) + 1
        }
      }));

      return res.status(200).json({
        tickets,
        voting_phases: awardTypes,
        total_committee: totalCommittee
      });

    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Get votable tickets error:', error);
    res.status(500).json({ message: 'Error fetching votable tickets' });
  }
});

/**
 * POST /api/votes/:ticketId/submit
 * Submit a vote for a ticket
 * Committee members can vote approve or not_approve
 */
router.post('/:ticketId/submit', requireCommitteeAuth, async (req, res) => {
  const ticketId = parseInt(req.params.ticketId);
  const { vote_result } = req.body;

  if (!vote_result || ![VOTE_CHOICES.APPROVED, VOTE_CHOICES.NOT_APPROVED].includes(vote_result)) {
    return res.status(400).json({ message: 'Invalid vote choice. Use "approved" or "not_approved"' });
  }

  try {
    const result = await transaction(async (client) => {
      // Check if ticket exists and is in approved status
      const ticketResult = await client.query(
        'SELECT * FROM tickets WHERE id = $1 AND status = $2',
        [ticketId, TICKET_STATUS.APPROVED]
      );

      if (ticketResult.rows.length === 0) {
        throw new Error('Ticket not found or not eligible for voting');
      }

      const ticket = ticketResult.rows[0];

      // Check if voting is open for this award type
      const votingOpen = await isVotingOpen(client, ticket.award_type);
      if (!votingOpen) {
        throw new Error('Voting is not open for this award type');
      }

      // Check if user has already voted for this ticket
      const existingVote = await client.query(
        'SELECT id FROM vote WHERE ticket_id = $1 AND committee_id = $2',
        [ticketId, req.session.user_id]
      );

      if (existingVote.rows.length > 0) {
        throw new Error('You have already voted for this ticket');
      }

      // Insert vote
      await client.query(
        `INSERT INTO vote (ticket_id, committee_id, vote_result, voted_at)
         VALUES ($1, $2, $3, NOW())`,
        [ticketId, req.session.user_id, vote_result]
      );

      // Create audit log
      await createAuditLog(client, req.session.user_id, LOG_ACTIONS.VOTE_SUBMIT, {
        resourceType: 'vote',
        resourceId: ticketId,
        newValues: { vote_result, ticket_id: ticketId }
      });

      return { success: true };
    });

    return res.status(200).json({
      message: 'Vote submitted successfully',
      success: true
    });

  } catch (error) {
    console.error('Submit vote error:', error);
    return res.status(400).json({ message: error.message });
  }
});

/**
 * GET /api/votes/my-votes
 * Get all votes submitted by the current committee member
 */
router.get('/my-votes', requireCommitteeAuth, async (req, res) => {
  try {
    const client = await pool.connect();
    try {
      const votesResult = await client.query(
        `SELECT v.id, v.ticket_id, v.vote_result, v.voted_at,
                t.ku_id, t.fullname, t.faculty, t.department, t.award_type
         FROM vote v
         JOIN tickets t ON v.ticket_id = t.id
         WHERE v.committee_id = $1
         ORDER BY v.voted_at DESC`,
        [req.session.user_id]
      );

      const votes = votesResult.rows.map(vote => ({
        id: vote.id,
        ticket_id: vote.ticket_id,
        vote_result: vote.vote_result,
        voted_at: vote.voted_at,
        ticket: {
          ku_id: vote.ku_id,
          fullname: vote.fullname,
          faculty: vote.faculty,
          department: vote.department,
          award_type: vote.award_type
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
    res.status(500).json({ message: 'Error fetching your votes' });
  }
});

/**
 * GET /api/votes/:ticketId/results
 * Get voting results for a specific ticket (Admin only)
 * Shows vote counts and whether threshold is met
 */
router.get('/:ticketId/results', requireAdminAuth, async (req, res) => {
  const ticketId = parseInt(req.params.ticketId);

  try {
    const client = await pool.connect();
    try {
      // Get ticket info
      const ticketResult = await client.query(
        'SELECT * FROM tickets WHERE id = $1',
        [ticketId]
      );

      if (ticketResult.rows.length === 0) {
        return res.status(404).json({ message: 'Ticket not found' });
      }

      const ticket = ticketResult.rows[0];

      // Get vote counts
      const voteCounts = await client.query(
        `SELECT vote_result, COUNT(*) as count
         FROM vote
         WHERE ticket_id = $1
         GROUP BY vote_result`,
        [ticketId]
      );

      // Get total committee count
      const committeeCountResult = await client.query(
        `SELECT COUNT(DISTINCT ur.user_id) as total_committee
         FROM user_roles ur
         JOIN roles r ON ur.role_id = r.id
         WHERE r.name IN ($1, $2)`,
        [ROLES.COMMITTEE, ROLES.COMMITTEE_PRESIDENT]
      );

      const totalCommittee = committeeCountResult.rows[0]?.total_committee || 0;
      const threshold = Math.floor(totalCommittee / 2) + 1;

      // Process vote counts
      const voteStats = {
        approved: 0,
        not_approved: 0,
        total_votes: 0
      };

      voteCounts.rows.forEach(row => {
        if (row.vote_result === VOTE_CHOICES.APPROVED) {
          voteStats.approved = parseInt(row.count);
        } else if (row.vote_result === VOTE_CHOICES.NOT_APPROVED) {
          voteStats.not_approved = parseInt(row.count);
        }
        voteStats.total_votes += parseInt(row.count);
      });

      // Determine if threshold is met
      const thresholdMet = voteStats.approved >= threshold;
      const status = thresholdMet ? 'WINNER' : 'NOT_WINNER';

      return res.status(200).json({
        ticket: {
          id: ticket.id,
          ku_id: ticket.ku_id,
          fullname: ticket.fullname,
          faculty: ticket.faculty,
          department: ticket.department,
          award_type: ticket.award_type,
          status: ticket.status
        },
        voting_results: {
          approved_votes: voteStats.approved,
          not_approved_votes: voteStats.not_approved,
          total_votes: voteStats.total_votes,
          total_committee: totalCommittee,
          threshold_required: threshold,
          threshold_met: thresholdMet,
          status: status
        }
      });

    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Get vote results error:', error);
    res.status(500).json({ message: 'Error fetching vote results' });
  }
});

/**
 * GET /api/votes/progress
 * Get overall voting progress for all award types (Admin only)
 */
router.get('/progress', requireAdminAuth, async (req, res) => {
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
                  COUNT(CASE WHEN v.vote_result = $1 THEN 1 END) as approve_count
           FROM tickets t
           LEFT JOIN vote v ON t.id = v.ticket_id
           WHERE t.award_type = $2 AND t.status = $3
           GROUP BY t.id`,
          [VOTE_CHOICES.APPROVED, phase.award_type, TICKET_STATUS.APPROVED]
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
          status: parseInt(ticket.approve_count) >= threshold ? 'WINNER' : 'IN_PROGRESS'
        }));

        progress.push({
          award_type: phase.award_type,
          phase_status: phase.status,
          start_at: phase.start_at,
          end_at: phase.end_at,
          total_committee: totalCommittee,
          threshold_required: threshold,
          tickets: tickets,
          winners_count: tickets.filter(t => t.threshold_met).length
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

module.exports = router;