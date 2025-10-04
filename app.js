// app.js
const rateLimit = require('express-rate-limit');
const express = require('express');
const path = require('path');
const methodOverride = require('method-override');
const session = require('express-session'); // Importa express-session
const flash = require('connect-flash');     // Importa connect-flash
require('dotenv').config(); // Garante que as variáveis de ambiente sejam carregadas
const cookieParser = require('cookie-parser');
const cors = require('cors');
const compression = require('compression'); // Para compressão gzip
const slowDown = require('express-slow-down'); // Para slow down de requisições

const helmet = require('helmet');

const { authMiddleware, authorizeRole } = require('./middleware/authMiddleware');

const app = express();

// Configuração para funcionar com proxies como ngrok
app.set('trust proxy', 1);

// Middleware de compressão (deve vir antes de outros middlewares)
app.use(compression({
    level: process.env.NODE_ENV === 'production' ? 6 : 1, // Nível de compressão mais alto em produção
    threshold: 1024, // Só comprime arquivos maiores que 1KB
    filter: (req, res) => {
        // Não comprime se o cliente não suporta
        if (req.headers['x-no-compression']) {
            return false;
        }
        // Usa o filtro padrão do compression
        return compression.filter(req, res);
    }
}));

// Middleware para aceitar qualquer host (necessário para ngrok)
app.use((req, res, next) => {
    // Permite qualquer host para funcionar com ngrok
    req.headers.host = req.headers.host || 'localhost:3001';
    next();
});

// Rate limiting configurável por ambiente
const authLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 5,
    message: 'Muitas tentativas de login/registro a partir deste IP, por favor aguarde!',
    standardHeaders: true,
    legacyHeaders: false,
});

const apiLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
    message: 'Muitas requisições a partir deste IP, por favor aguarde!',
    standardHeaders: true,
    legacyHeaders: false,
});

// Slow down middleware para reduzir velocidade após muitas requisições
const speedLimiter = slowDown({
    windowMs: 15 * 60 * 1000, // 15 minutos
    delayAfter: 50, // Permite 50 requisições por janela sem delay
    delayMs: 500, // Adiciona 500ms de delay para cada requisição após o limite
    maxDelayMs: 20000, // Delay máximo de 20 segundos
    skipFailedRequests: false,
    skipSuccessfulRequests: false,
});

// Configuração CORS baseada no ambiente
const corsOptions = {
    origin: function (origin, callback) {
        if (process.env.NODE_ENV === 'production') {
            // Em produção, usar apenas origens específicas
            const allowedOrigins = process.env.CORS_ORIGIN ? 
                process.env.CORS_ORIGIN.split(',') : 
                ['https://your-domain.com'];
            
            if (!origin || allowedOrigins.includes(origin)) {
                callback(null, true);
            } else {
                callback(new Error('Não permitido pelo CORS'));
            }
        } else {
            // Em desenvolvimento, permite localhost e ngrok
            const allowedOrigins = [
                'http://localhost:3001',
                'http://127.0.0.1:3001',
                /https:\/\/.*\.ngrok\.io$/,
                /https:\/\/.*\.ngrok-free\.app$/
            ];
            
            if (!origin || allowedOrigins.some(allowed => 
                typeof allowed === 'string' ? allowed === origin : allowed.test(origin)
            )) {
                callback(null, true);
            } else {
                callback(null, true); // Permite todos em desenvolvimento
            }
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

app.use(cors(corsOptions));

// Configuração CSP baseada no ambiente
const cspDirectives = {
    defaultSrc: ["'self'"],
    scriptSrc: process.env.CSP_SCRIPT_SRC ? 
        process.env.CSP_SCRIPT_SRC.split(',').map(src => src.trim()) : 
        ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
    styleSrc: process.env.CSP_STYLE_SRC ? 
        process.env.CSP_STYLE_SRC.split(',').map(src => src.trim()) : 
        ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
    connectSrc: process.env.CSP_CONNECT_SRC ? 
        process.env.CSP_CONNECT_SRC.split(',').map(src => src.trim()) : 
        ["'self'", "https://cdn.jsdelivr.net"],
    imgSrc: process.env.CSP_IMG_SRC ? 
        process.env.CSP_IMG_SRC.split(',').map(src => src.trim()) : 
        ["'self'", "data:", "https:"],
    fontSrc: process.env.CSP_FONT_SRC ? 
        process.env.CSP_FONT_SRC.split(',').map(src => src.trim()) : 
        ["'self'", "https://cdn.jsdelivr.net"]
};

// Em desenvolvimento, adiciona ngrok aos CSP
if (process.env.NODE_ENV !== 'production') {
    Object.keys(cspDirectives).forEach(key => {
        if (Array.isArray(cspDirectives[key])) {
            cspDirectives[key].push("*.ngrok.io", "*.ngrok-free.app");
        }
    });
}

app.use(helmet({
    contentSecurityPolicy: {
        directives: cspDirectives
    }
}));

app.use(cookieParser());

// Sincroniza os modelos com o banco de dados (certifique-se de que isso esteja acontecendo)
const { sequelize } = require('./models');
if (process.env.NODE_ENV !== 'production') {
    sequelize.sync()
        .catch(err => console.error('Erro ao sincronizar banco de dados:', err));
}

// Configuração do View Engine (EJS)
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');



// Middlewares
app.use(speedLimiter); // Aplica slow down globalmente
app.use(express.urlencoded({ extended: true })); // Para parsear dados de formulários HTML
app.use(express.json()); // Para parsear JSON de requisições
app.use(express.static(path.join(__dirname, 'public'), {
    maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0, // Cache de 1 dia em produção
    etag: true,
    lastModified: true
})); // Servir arquivos estáticos com cache
app.use(methodOverride('_method')); // Para permitir DELETE e PUT de formulários

// Configuração da Sessão (ESSENCIAL PARA req.flash)
app.use(session({
    secret: process.env.SESSION_SECRET || 'seu_segredo_muito_secreto_para_sessao',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        maxAge: parseInt(process.env.SESSION_MAX_AGE) || 1000 * 60 * 60 * 24, // 1 dia por padrão
        secure: process.env.NODE_ENV === 'production' ? 
            (process.env.SESSION_SECURE === 'true') : false, // HTTPS em produção
        httpOnly: process.env.SESSION_HTTP_ONLY !== 'false', // true por padrão
        sameSite: process.env.SESSION_SAME_SITE || 
            (process.env.NODE_ENV === 'production' ? 'strict' : 'lax')
    }
}));
app.use(flash());

// Configuração do Connect-Flash (DEVE VIR DEPOIS DO express-session)
app.use(flash());

app.use(async (req, res, next) => {
    // 1. Mensagens Flash (já tínhamos isso)
   res.locals.successMessage = req.flash('success');
   res.locals.errorMessage = req.flash('error');

    // 2. Lógica de autenticação para 'isAuthenticated' e 'user'
    // Se você estiver usando JWT via cookies:
    const token = req.cookies.token; // Assume que o token JWT está em um cookie chamado 'token'
    res.locals.isAuthenticated = false;
    res.locals.user = null; // Define user como nulo por padrão

    if (token) {
        try {
            const jwt = require('jsonwebtoken');
            const JWT_SECRET = process.env.JWT_SECRET
            const {User} = require('./models');

            const decoded = jwt.verify(token, JWT_SECRET);
            res.locals.isAuthenticated = true;
            res.locals.user = await User.findByPk(decoded.id, {attributes: ['id', 'username', 'role']});

        } catch (error) {
            // Token inválido ou expirado
            console.warn('Token JWT inválido ou expirado:', error.message);
            res.clearCookie('token'); // Limpa o cookie inválido
            res.locals.isAuthenticated = false;
            res.locals.user = null;
        }
    }else{
        res.locals.isAuthenticated = false;
        res.locals.user = null;
    }

    next();
});

// Middleware para disponibilizar 'flash messages' e informações de usuário nas views
app.use((req, res, next) => {
    res.locals.successMessage = req.flash('success');
    res.locals.errorMessage = req.flash('error');
    //res.locals.user = req.user || null; // Se você tiver um middleware que popula req.user
    next();
});


// Importação e uso das rotas
const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const userRoutes = require('./routes/userRoutes');
const customerRoutes = require('./routes/customerRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const salesRoutes = require('./routes/salesRoutes'); // Suas rotas de vendas
const harvestRoutes = require('./routes/harvestRoutes');
const lossRoutes = require('./routes/lossRoutes');
const settlementRoutes = require('./routes/settlementRoutes');
const healthRoutes = require('./routes/health'); // Health check routes
const historyController = require('./controllers/historyController');
const chartsController = require('./controllers/chartsController');

// Health check route (sem autenticação para monitoramento)
app.use('/', healthRoutes);

app.use('/auth', authRoutes);
app.use('/products', apiLimiter, productRoutes);
app.use('/users', apiLimiter, userRoutes);
app.use('/customers', apiLimiter, customerRoutes);
app.use('/categories', apiLimiter, categoryRoutes);
app.use('/sales', authMiddleware, apiLimiter, salesRoutes); // Suas rotas de vendas
app.use('/sales/reports', authMiddleware, authorizeRole(['admin', 'manager']));
app.use('/', authMiddleware, authorizeRole(['admin', 'manager']), harvestRoutes);
app.use('/losses', lossRoutes);
app.use('/settlement', authMiddleware, settlementRoutes);

// Rotas para History e Charts
app.get('/history', authMiddleware, authorizeRole(['admin', 'manager']), historyController.getHistoryPage);
app.get('/charts', authMiddleware, authorizeRole(['admin', 'manager']), chartsController.getChartsPage);
app.get('/charts/api/sales-data', authMiddleware, authorizeRole(['admin', 'manager']), chartsController.getSalesChartData);
app.get('/charts/api/top-products', authMiddleware, authorizeRole(['admin', 'manager']), chartsController.getTopProductsData);
app.get('/charts/api/harvests-data', authMiddleware, authorizeRole(['admin', 'manager']), chartsController.getHarvestsChartData);
app.get('/charts/api/losses-data', authMiddleware, authorizeRole(['admin', 'manager']), chartsController.getLossesChartData);

// Rota para o dashboard/página inicial (requer autenticação)


app.get('/dashboard', authMiddleware, authLimiter, async (req, res) => {
    try {
        const { Sale, Harvest, Product, Customer, User, SaleItem } = require('./models');
        const { Op } = require('sequelize');
        const { sequelize: dbInstance } = require('./models');
        
        // Buscar a última venda
        const lastSale = await Sale.findOne({
            order: [['sale_date', 'DESC']],
            include: [
                {
                    model: Customer,
                    as: 'customer',
                    attributes: ['name']
                },
                {
                    model: User,
                    as: 'user',
                    attributes: ['username']
                }
            ]
        });

        // Buscar a última colheita
        const lastHarvest = await Harvest.findOne({
            order: [['harvest_date', 'DESC']],
            include: [
                {
                    model: Product,
                    as: 'product',
                    attributes: ['name']
                },
                {
                    model: User,
                    as: 'user',
                    attributes: ['username']
                }
            ]
        });

        // Calcular estatísticas
        // Data de hoje (início e fim do dia) - usando fuso horário local brasileiro
        const today = new Date();
        
        // Criar início e fim do dia no fuso horário brasileiro
        const startOfDay = new Date(today);
        startOfDay.setHours(0, 0, 0, 0);
        
        const endOfDay = new Date(today);
        endOfDay.setHours(23, 59, 59, 999);
        
        // Converter para UTC para comparação com o banco (que armazena em UTC)
        const startOfDayUTC = new Date(startOfDay.getTime() + (3 * 60 * 60 * 1000)); // +3 horas para UTC
        const endOfDayUTC = new Date(endOfDay.getTime() + (3 * 60 * 60 * 1000)); // +3 horas para UTC
        
        console.log('Período de hoje (Brasil):', startOfDay.toLocaleString('pt-BR'), 'até', endOfDay.toLocaleString('pt-BR'));
        console.log('Período de hoje (UTC):', startOfDayUTC.toISOString(), 'até', endOfDayUTC.toISOString());

        // Contar vendas de hoje usando intervalo de tempo
        const salesToday = await Sale.count({
            where: {
                sale_date: {
                    [Op.gte]: startOfDayUTC,
                    [Op.lte]: endOfDayUTC
                }
            }
        });

        // Contar produtos vendidos hoje usando intervalo de tempo
        const totalProducts = await SaleItem.sum('quantity', {
            include: [{
                model: Sale,
                as: 'sale',
                where: {
                    sale_date: {
                        [Op.gte]: startOfDayUTC,
                        [Op.lte]: endOfDayUTC
                    }
                },
                attributes: [] // Não selecionar atributos da tabela Sale para evitar erro de GROUP BY
            }]
        }) || 0;

        // Contar todos os clientes cadastrados no banco de dados
        const totalCustomers = await Customer.count();

        res.render('dashboard', {
            title: 'Dashboard',
            user: req.user,
            lastSale: lastSale,
            lastHarvest: lastHarvest,
            salesToday: salesToday,
            totalProducts: totalProducts,
            totalCustomers: totalCustomers,
            successMessage: res.locals.successMessage,
            errorMessage: res.locals.errorMessage
        });
    } catch (error) {
        console.error('Erro ao buscar dados do dashboard:', error);
        res.render('dashboard', {
            title: 'Dashboard',
            user: req.user,
            lastSale: null,
            lastHarvest: null,
            salesToday: 0,
            totalProducts: 0,
            totalCustomers: 0,
            successMessage: res.locals.successMessage,
            errorMessage: res.locals.errorMessage
        });
    }
});

// Rota padrão - redireciona para dashboard se autenticado, senão para login
app.get('/', (req, res) => {
    console.log('Rota / acessada');
    
    // Usa a mesma lógica de autenticação JWT do middleware global
    const token = req.cookies.token;
    console.log('Token exists:', !!token);
    
    if (token) {
        try {
            const jwt = require('jsonwebtoken');
            const JWT_SECRET = process.env.JWT_SECRET;
            const decoded = jwt.verify(token, JWT_SECRET);
            console.log('Token válido, redirecionando para dashboard');
            res.redirect('/dashboard');
        } catch (error) {
            console.log('Token inválido ou expirado, redirecionando para login');
            res.clearCookie('token'); // Limpa o cookie inválido
            res.redirect('/auth/login');
        }
    } else {
        console.log('Nenhum token encontrado, redirecionando para login');
        res.redirect('/auth/login');
    }
});

// Tratamento de erros 404 (Rota não encontrada)
app.use((req, res, next) => {
    res.status(404).render('error', { message: 'Página não encontrada.' });
});

// Tratamento de erros globais
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).render('error', { message: 'Ocorreu um erro no servidor.', error: err });
});

// Iniciar o servidor (apenas quando rodando localmente)
const PORT = process.env.PORT || 3001;
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Servidor rodando na porta ${PORT}`);
    });
}

// Exportar o app para ser utilizado por plataformas serverless (como Vercel)
module.exports = app;