// controllers/authController.js

const { User } = require('../models');
const bcrypt = require('bcryptjs'); // Para comparar senhas
const jwt = require('jsonwebtoken'); // Se você estiver usando JWT para autenticação
const { Op } = require('sequelize'); // Importe se precisar de operadores Sequelize para busca
require('dotenv').config();
// Segredo do JWT - DEVE SER UMA VARIÁVEL DE AMBIENTE EM PRODUÇÃO!
const JWT_SECRET = process.env.JWT_SECRET

// Exibir formulário de login
exports.getLoginForm = (req, res) => {

    res.render('auth/login',
        {
            title: 'Login',
            errorMessage: req.flash('error'),
            sucessMessage: req.flash('sucess')
        });
};

// Processar login do usuário
exports.loginUser = async (req, res) => {
    const { username, password } = req.body;

    try {
        // 1. Encontrar o usuário pelo username
        const user = await User.findOne({ where: { username } });

        if (!user) {
            req.flash('error', 'Usuário não encontrado.');
            return res.redirect('/auth/login');
        }

        // 2. Comparar a senha fornecida com o hash salvo no banco de dados
        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            req.flash('error', 'Senha incorreta.');
            return res.redirect('/auth/login');
        }

        // 3. Gerar JWT (ou configurar sessão, dependendo da sua estratégia)
        // Se você estiver usando JWT:
        const token = jwt.sign(
            {
                        id: user.id,
                        username: user.username,
                        role: user.role },

            JWT_SECRET,
            { expiresIn: '1h' } // Token expira em 5 hora
        );

        res.cookie('token', token, {
            httpOnly: true, // Impede acesso via JavaScript do cliente
            secure: process.env.NODE_ENV === 'production', // Apenas em HTTPS em produção
            maxAge: 3600000,// 1 hora em milissegundos
            sameSite: 'lax'
        });

        // Redirecionar para o dashboard ou página principal
        req.flash('success', 'Login realizado com sucesso!');
        res.redirect('/dashboard'); // Ou para a página inicial do sistema

    } catch (error) {
        console.error('Erro no login:', error);
        req.flash('error', 'Ocorreu um erro ao tentar fazer login.');
        res.redirect('/auth/login');
    }
};

// Exibir formulário de registro
exports.getRegisterForm = (req, res) => {
    res.render('auth/register',
        {
            title: 'Registrar',
            // A view espera "error" e opcionalmente "success"
            error: req.flash('error'),
            success: req.flash('success')

        });
};

// Processar registro de usuário
exports.registerUser = async (req, res) => {
    const { username, password, role } = req.body;

    try {
        // Validações básicas
        if (!username || !password) {
            req.flash('error', 'Usuário e senha são obrigatórios.');
            return res.redirect('/auth/register');
        }
        if (password.length < 4) {
            req.flash('error', 'A senha deve ter pelo menos 4 caracteres.');
            return res.redirect('/auth/register');
        }

        // Verificar se o usuário já existe
        const existingUser = await User.findOne({ where: { username } });
        if (existingUser) {
            req.flash('error', 'Nome de usuário já existe.');
            return res.redirect('/auth/register');
        }

        // Hash da senha antes de salvar
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Garantir um valor seguro para role
        const roleValue = (role && typeof role === 'string' && role.trim().length > 0) ? role.trim() : 'user';

        await User.create({ username, password: hashedPassword, role: roleValue });

        req.flash('success', 'Usuário registrado com sucesso! Faça login.');
        res.redirect('/auth/login');

    } catch (error) {
        console.error('Erro no registro:', {
            message: error.message,
            name: error.name,
            errors: error.errors || null,
            stack: error.stack
        });
        req.flash('error', 'Ocorreu um erro ao registrar o usuário.');
        res.redirect('/auth/register');
    }
};

// Logout do usuário
exports.logoutUser = (req, res) => {
    res.cookie('token', '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        expires: new Date(0)
    })

    // Para JWT, basta limpar o cookie do token
    //res.clearCookie('token');
    req.flash('success', 'Você foi desconectado com sucesso.');
    res.redirect('/auth/login');
};