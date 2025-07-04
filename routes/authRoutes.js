const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

router.post('/users', authController.createUser);
router.post('/login', authController.login);
router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ success: true, message: 'Logged out successfully' });
});

module.exports = router;