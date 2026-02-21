const express = require('express');
const router = express.Router();

// GET /api/votes/tickets - Votable tickets
router.get('/tickets', (req, res) => {
  // TODO: List votable tickets
  res.json({});
});

// POST /api/votes/:ticketId/submit - Submit vote
router.post('/:ticketId/submit', (req, res) => {
  // TODO: Submit vote
  res.json({});
});

// GET /api/votes/my-votes - My votes
router.get('/my-votes', (req, res) => {
  // TODO: List my votes
  res.json({});
});

// GET /api/votes/:ticketId/results - Results (admin)
router.get('/:ticketId/results', (req, res) => {
  // TODO: Get vote results
  res.json({});
});

module.exports = router;
