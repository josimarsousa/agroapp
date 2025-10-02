const { User } = require('../models');
const bcrypt = require('bcryptjs');

const saltRounds = 10;

// Listar todos os usuários
exports.getAllUsers = async (req, res) => {
    try {
        const users = await User.findAll({
            attributes: ['id', 'username', 'role', 'created_at'] // Não retornar a senha
        });
        res.render('users/index', { title: 'Gerenciar Usuários', users });
    } catch (error) {
        console.error('Erro ao buscar usuários:', error);
        res.status(500).render('error', { message: 'Erro ao carregar usuários.' });
    }
};

// Exibir formulário de criação de usuário
exports.getCreateUserForm = (req, res) => {
    res.render('users/form', { title: 'Novo Usuário', user: {}, isEdit: false });
};

// Criar um novo usuário
exports.createUser = async (req, res) => {
    const { username, password, role } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        await User.create({ username, password: hashedPassword, role });
        res.redirect('/users');
    } catch (error) {
        console.error('Erro ao criar usuário:', error);
        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.render('users/form', { title: 'Novo Usuário', user: req.body, isEdit: false, error: 'Nome de usuário já existe.' });
        }
        res.status(500).render('users/form', { title: 'Novo Usuário', user: req.body, isEdit: false, error: 'Erro ao criar usuário.' });
    }
};

// Exibir formulário de edição de usuário
exports.getEditUserForm = async (req, res) => {
    try {
        const user = await User.findByPk(req.params.id, {
            attributes: ['id', 'username', 'role'] // Não trazer a senha para a edição
        });
        if (!user) {
            return res.status(404).render('error', { message: 'Usuário não encontrado.' });
        }
        res.render('users/form', { title: 'Editar Usuário', user, isEdit: true });
    } catch (error) {
        console.error('Erro ao buscar usuário para edição:', error);
        res.status(500).render('error', { message: 'Erro ao carregar usuário para edição.' });
    }
};

// Atualizar usuário
exports.updateUser = async (req, res) => {
    const { id } = req.params;
    const { username, password, role } = req.body;
    try {
        const user = await User.findByPk(id);
        if (!user) {
            return res.status(404).render('error', { message: 'Usuário não encontrado.' });
        }

        user.username = username;
        user.role = role;
        if (password) { // Atualiza a senha apenas se uma nova for fornecida
            user.password = await bcrypt.hash(password, saltRounds);
        }
        await user.save();
        res.redirect('/users');
    } catch (error) {
        console.error('Erro ao atualizar usuário:', error);
        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.render('users/form', { title: 'Editar Usuário', user: req.body, isEdit: true, error: 'Nome de usuário já existe.' });
        }
        res.status(500).render('users/form', { title: 'Editar Usuário', user: req.body, isEdit: true, error: 'Erro ao atualizar usuário.' });
    }
};

// Excluir usuário
exports.deleteUser = async (req, res) => {
    try {
        const result = await User.destroy({ where: { id: req.params.id } });
        if (result === 0) {
            return res.status(404).render('error', { message: 'Usuário não encontrado para exclusão.' });
        }
        res.redirect('/users');
    } catch (error) {
        console.error('Erro ao excluir usuário:', error);
        res.status(500).render('error', { message: 'Erro ao excluir usuário.' });
    }
};