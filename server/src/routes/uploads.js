const express = require('express');
const router = express.Router();

router.post('/ticket/:ticketId', (req, res) => {
  res.json({ message: 'Upload file - coming soon' });
});

module.exports = router;