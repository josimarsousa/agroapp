const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authMiddleware, authorizeRole } = require('../middleware/authMiddleware');

// Todas as rotas de usuário exigem autenticação
router.use(authMiddleware);
// Apenas administradores podem gerenciar usuários
router.use(authorizeRole(['admin']));

router.get('/', userController.getAllUsers); // Listar usuários
router.get('/new', userController.getCreateUserForm); // Formulário de criação
router.post('/', userController.createUser); // Criar usuário
router.get('/edit/:id', userController.getEditUserForm); // Formulário de edição
router.post('/edit/:id', userController.updateUser); // Atualizar usuário
router.post('/delete/:id', userController.deleteUser); // Excluir usuário (POST para evitar CSRF)

module.exports = router;