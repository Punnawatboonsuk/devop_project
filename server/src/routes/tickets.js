const express = require('express');
const router = express.Router();

// GET /api/tickets - List all (admin/staff)
router.get('/', (req, res) => {
  // TODO: List all tickets
  res.json({});
});

// GET /api/tickets/me - My tickets
router.get('/me', (req, res) => {
  // TODO: List my tickets
  res.json({});
});

// GET /api/tickets/:id - View detail
router.get('/:id', (req, res) => {
  // TODO: View ticket detail
  res.json({});
});

// POST /api/tickets - Create
router.post('/', (req, res) => {
  // TODO: Create ticket
  res.json({});
});

// PATCH /api/tickets/:id - Update
router.patch('/:id', (req, res) => {
  // TODO: Update ticket
  res.json({});
});

// DELETE /api/tickets/:id - Delete draft
router.delete('/:id', (req, res) => {
  // TODO: Delete draft ticket
  res.json({});
});

// PATCH /api/tickets/:id/accept - Accept
router.patch('/:id/accept', (req, res) => {
  // TODO: Accept ticket
  res.json({});
});

// PATCH /api/tickets/:id/reject - Reject
router.patch('/:id/reject', (req, res) => {
  // TODO: Reject ticket
  res.json({});
});

// GET /api/tickets/:id/history - History
router.get('/:id/history', (req, res) => {
  // TODO: Ticket history
  res.json({});
});

// GET /api/tickets/:id/files - List files
router.get('/:id/files', (req, res) => {
  // TODO: List ticket files
  res.json({});
});

module.exports = router;
