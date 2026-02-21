const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.json({ message: 'List tickets - coming soon' });
});

router.post('/', (req, res) => {
  res.json({ message: 'Create ticket - coming soon' });
});

module.exports = router;