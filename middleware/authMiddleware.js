const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET;

const authMiddleware = (req, res, next) => {
    // Tenta obter o token do cookie (se você o armazenar lá)
    const token = req.cookies.token; // Armazenamos o token na sessão

    if (!token) {
        // Verifica se é uma requisição AJAX/API
        if (req.xhr || req.headers.accept.indexOf('json') > -1 || req.path.startsWith('/api/')) {
            return res.status(401).json({ 
                success: false, 
                message: 'Acesso negado. Faça login novamente.',
                redirect: '/auth/login'
            });
        }
        
        // Para requisições normais, redireciona
        return res.redirect('/auth/login');
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded; // Adiciona os dados do usuário ao objeto req
        next(); // Permite que a requisição continue
    } catch (error) {
        console.error('Token inválido ou expirado:', error.message);
        
        // Verifica se é uma requisição AJAX/API
        if (req.xhr || req.headers.accept.indexOf('json') > -1 || req.path.startsWith('/api/')) {
            return res.status(401).json({ 
                success: false, 
                message: 'Token inválido ou expirado. Faça login novamente.',
                redirect: '/auth/login'
            });
        }
        
        // Para requisições normais, limpa a sessão e redireciona
        req.session.destroy(() => {
            res.redirect('/auth/login');
        });
    }
};

const authorizeRole = (roles) => {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            console.log('Acesso negado: Papel de usuário insuficiente.');
            return res.status(403).render('error', { message: 'Você não tem permissão para acessar esta página.' });
        }
        next();
    };
};

module.exports = { authMiddleware, authorizeRole };