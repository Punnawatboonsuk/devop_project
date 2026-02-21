const express = require('express');
const router = express.Router();

router.post('/generate', (req, res) => {
  res.json({ message: 'Generate certificates - coming soon' });
});

module.exports = router;