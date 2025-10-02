const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authMiddleware } = require('../middleware/authMiddleware');

router.get('/login', authController.getLoginForm);
router.post('/login', authController.loginUser);
router.get('/register', authController.getRegisterForm); // Rota para o formulário de registro
router.post('/register', authController.registerUser); // Rota para processar o registro
router.post('/logout', authController.logoutUser); // Protegida por authMiddleware

module.exports = router;