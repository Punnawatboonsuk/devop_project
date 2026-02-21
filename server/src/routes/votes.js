const express = require('express');
const router = express.Router();

router.get('/tickets', (req, res) => {
  res.json({ message: 'Votable tickets - coming soon' });
});

module.exports = router;