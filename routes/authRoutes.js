const express = require('express');
const path = require('path');
const router = express.Router();
const authController = require('../controllers/authController');
const { authMiddleware } = require('../middleware/authMiddleware');

router.get('/login', (req, res) => {
  return res.sendFile(path.join(__dirname, '..', 'views', 'auth', 'login.html'));
});
router.post('/login', authController.loginUser);
router.get('/register', (req, res) => {
  return res.sendFile(path.join(__dirname, '..', 'views', 'auth', 'register.html'));
});
router.post('/register', authController.registerUser); // Rota para processar o registro
router.post('/logout', authController.logoutUser); // Protegida por authMiddleware

module.exports = router;