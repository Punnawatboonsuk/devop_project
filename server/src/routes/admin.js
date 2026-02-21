const express = require('express');
const router = express.Router();

router.get('/statistics', (req, res) => {
  res.json({ message: 'Admin statistics - coming soon' });
});

module.exports = router;