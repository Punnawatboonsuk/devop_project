const express = require('express');
const { pool, transaction } = require('../config/database');
const { ROLES, PHASES, TICKET_STATUS, LOG_ACTIONS } = require('../utils/constants');
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
 * POST /api/admin/phase/end-nomination - End nomination phase
 * Moves system from NOMINATION to REVIEW_END phase
 */
router.post('/phase/end-nomination', requireAdminAuth, async (req, res) => {
  try {
    const result = await transaction(async (client) => {
      // Check current phase
      const currentPhaseResult = await client.query(
        'SELECT phase FROM system_phase WHERE id = 1',
        []
      );

      if (currentPhaseResult.rows.length === 0) {
        throw new Error('System phase not initialized');
      }

      const currentPhase = currentPhaseResult.rows[0].phase;

      if (currentPhase !== PHASES.NOMINATION) {
        throw new Error(`Cannot end nomination. Current phase is ${currentPhase}`);
      }

      // Update to REVIEW_END phase
      await client.query(
        'UPDATE system_phase SET phase = $1, updated_at = NOW() WHERE id = 1',
        [PHASES.REVIEW_END]
      );

      // Create audit log
      await createAuditLog(client, req.session.user_id, LOG_ACTIONS.PHASE_CHANGE, {
        resourceType: 'system_phase',
        resourceId: 1,
        newValues: { old_phase: PHASES.NOMINATION, new_phase: PHASES.REVIEW_END }
      });

      return { success: true, new_phase: PHASES.REVIEW_END };
    });

    return res.status(200).json({
      message: 'Nomination phase ended successfully',
      success: true,
      new_phase: result.new_phase
    });

  } catch (error) {
    console.error('End nomination error:', error);
    return res.status(400).json({ message: error.message });
  }
});

/**
 * POST /api/admin/phase/start-vote - Start voting for specific award type
 * Moves specific award type from REVIEW_END to VOTING phase
 */
router.post('/phase/start-vote', requireAdminAuth, async (req, res) => {
  const { award_type } = req.body;

  if (!award_type) {
    return res.status(400).json({ message: 'Award type is required' });
  }

  try {
    const result = await transaction(async (client) => {
      // Check if voting phase already exists for this award type
      const existingPhase = await client.query(
        'SELECT id, status FROM voting_phase WHERE award_type = $1',
        [award_type]
      );

      if (existingPhase.rows.length > 0) {
        const currentStatus = existingPhase.rows[0].status;
        if (currentStatus === 'voting') {
          throw new Error(`Voting is already open for ${award_type}`);
        } else if (currentStatus === 'closed') {
          throw new Error(`Voting for ${award_type} has already been closed`);
        }
      }

      // Check current system phase
      const systemPhaseResult = await client.query(
        'SELECT phase FROM system_phase WHERE id = 1',
        []
      );

      const currentSystemPhase = systemPhaseResult.rows[0]?.phase;

      if (currentSystemPhase !== PHASES.REVIEW_END) {
        throw new Error(`Cannot start voting. System is in ${currentSystemPhase} phase`);
      }

      // Create or update voting phase
      if (existingPhase.rows.length > 0) {
        await client.query(
          'UPDATE voting_phase SET status = $1, start_at = NOW(), end_at = NULL WHERE award_type = $2',
          ['voting', award_type]
        );
      } else {
        await client.query(
          'INSERT INTO voting_phase (award_type, status, start_at) VALUES ($1, $2, NOW())',
          [award_type, 'voting']
        );
      }

      // Create audit log
      await createAuditLog(client, req.session.user_id, LOG_ACTIONS.PHASE_CHANGE, {
        resourceType: 'voting_phase',
        resourceId: award_type,
        newValues: { award_type, status: 'voting', action: 'start_vote' }
      });

      return { success: true, award_type };
    });

    return res.status(200).json({
      message: `Voting started for ${award_type}`,
      success: true,
      award_type: result.award_type
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
  const { award_type } = req.body;

  if (!award_type) {
    return res.status(400).json({ message: 'Award type is required' });
  }

  try {
    const result = await transaction(async (client) => {
      // Check if voting phase exists and is open
      const votingPhaseResult = await client.query(
        'SELECT id, status FROM voting_phase WHERE award_type = $1',
        [award_type]
      );

      if (votingPhaseResult.rows.length === 0) {
        throw new Error(`No voting phase found for ${award_type}`);
      }

      const phase = votingPhaseResult.rows[0];

      if (phase.status !== 'voting') {
        throw new Error(`Voting is not open for ${award_type}. Current status: ${phase.status}`);
      }

      // Get total committee count for threshold calculation
      const committeeCountResult = await client.query(
        `SELECT COUNT(DISTINCT ur.user_id) as total_committee
         FROM user_roles ur
         JOIN roles r ON ur.role_id = r.id
         WHERE r.name IN ($1, $2)`,
        [ROLES.COMMITTEE, ROLES.COMMITTEE_PRESIDENT]
      );

      const totalCommittee = committeeCountResult.rows[0]?.total_committee || 0;
      const threshold = Math.floor(totalCommittee / 2) + 1;

      // Get all tickets for this award type that are in approved status
      const ticketsResult = await client.query(
        `SELECT t.id, t.ku_id, t.fullname, t.faculty, t.department,
                COUNT(v.id) as vote_count,
                COUNT(CASE WHEN v.vote_result = $1 THEN 1 END) as approve_count
         FROM tickets t
         LEFT JOIN vote v ON t.id = v.ticket_id
         WHERE t.award_type = $2 AND t.status = $3
         GROUP BY t.id`,
        ['approved', award_type, TICKET_STATUS.APPROVED]
      );

      const winners = [];
      const losers = [];

      // Process each ticket and determine winners/losers
      for (const ticket of ticketsResult.rows) {
        const approveCount = parseInt(ticket.approve_count);
        const voteCount = parseInt(ticket.vote_count);

        if (approveCount >= threshold) {
          // Winner - update ticket status to approved
          await client.query(
            'UPDATE tickets SET status = $1 WHERE id = $2',
            [TICKET_STATUS.APPROVED, ticket.id]
          );

          winners.push({
            id: ticket.id,
            ku_id: ticket.ku_id,
            fullname: ticket.fullname,
            faculty: ticket.faculty,
            department: ticket.department,
            approve_count: approveCount,
            total_votes: voteCount,
            threshold_met: true
          });
        } else {
          // Loser - update ticket status to not_approved
          await client.query(
            'UPDATE tickets SET status = $1 WHERE id = $2',
            [TICKET_STATUS.NOT_APPROVED, ticket.id]
          );

          losers.push({
            id: ticket.id,
            ku_id: ticket.ku_id,
            fullname: ticket.fullname,
            faculty: ticket.faculty,
            department: ticket.department,
            approve_count: approveCount,
            total_votes: voteCount,
            threshold_met: false
          });
        }
      }

      // Update voting phase to closed
      await client.query(
        'UPDATE voting_phase SET status = $1, end_at = NOW() WHERE id = $2',
        ['closed', phase.id]
      );

      // Create audit log
      await createAuditLog(client, req.session.user_id, LOG_ACTIONS.PHASE_CHANGE, {
        resourceType: 'voting_phase',
        resourceId: award_type,
        newValues: { 
          award_type, 
          status: 'closed', 
          action: 'end_vote',
          winners_count: winners.length,
          losers_count: losers.length,
          total_committee: totalCommittee,
          threshold_required: threshold
        }
      });

      return {
        success: true,
        award_type,
        winners,
        losers,
        total_committee,
        threshold
      };
    });

    return res.status(200).json({
      message: `Voting ended for ${award_type}`,
      success: true,
      results: {
        award_type: result.award_type,
        winners: result.winners,
        losers: result.losers,
        total_committee: result.total_committee,
        threshold_required: result.threshold
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
      const result = await client.query(
        'SELECT phase FROM system_phase WHERE id = 1',
        []
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ message: 'System phase not initialized' });
      }

      return res.status(200).json({
        current_phase: result.rows[0].phase
      });

    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Get current phase error:', error);
    res.status(500).json({ message: 'Error fetching current phase' });
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
