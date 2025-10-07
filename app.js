// app.js
const rateLimit = require('express-rate-limit');
const express = require('express');
const path = require('path');
const methodOverride = require('method-override');
const session = require('express-session');
const flash = require('connect-flash');
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}
const cookieParser = require('cookie-parser');
const cors = require('cors');
const compression = require('compression');
const slowDown = require('express-slow-down');
const helmet = require('helmet');
const { Op } = require('sequelize');

const { authMiddleware, authorizeRole } = require('./middleware/authMiddleware');

const app = express();

// Proxies como Railway/Ngrok
app.set('trust proxy', 1);

// Diagnóstico de CORS (apenas em produção)
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    if (process.env.DEBUG_CORS === 'true') {
      console.log('[CORS] Origin:', req.headers.origin);
    }
    next();
  });
}

// Compressão
app.use(
  compression({
    level: process.env.NODE_ENV === 'production' ? 6 : 1,
    threshold: 1024,
    filter: (req, res) => {
      if (req.headers['x-no-compression']) return false;
      return compression.filter(req, res);
    },
  })
);

// Permitir qualquer host para funcionar com ngrok/dev
app.use((req, res, next) => {
  req.headers.host = req.headers.host || 'localhost:3001';
  next();
});

// Rate limits
const authLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 5,
  message:
    'Muitas tentativas de login/registro a partir deste IP, por favor aguarde!',
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

// Slow down
const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000,
  delayAfter: 50,
  delayMs: () => 500,
  maxDelayMs: 20000,
  skipFailedRequests: false,
  skipSuccessfulRequests: false,
});

// CORS
const corsOptions = {
  origin: function (origin, callback) {
    if (process.env.NODE_ENV === 'production') {
      const allowedOrigins = process.env.CORS_ORIGIN
        ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean)
        : ['https://your-domain.com'];
      // Permite requisições sem origin e com origin 'null' (file://, sandboxes)
      if (!origin || origin === 'null' || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Não permitido pelo CORS'));
      }
    } else {
      const allowedOrigins = [
        'http://localhost:3001',
        'http://127.0.0.1:3001',
        /https:\/\/.*\.ngrok\.io$/,
        /https:\/\/.*\.ngrok-free\.app$/,
      ];
      if (
        !origin ||
        allowedOrigins.some((allowed) =>
          typeof allowed === 'string' ? allowed === origin : allowed.test(origin)
        )
      ) {
        callback(null, true);
      } else {
        callback(null, true);
      }
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
};

// Definir locals padrão cedo para evitar undefined em views de erro
app.use((req, res, next) => {
  res.locals.isAuthenticated = false;
  res.locals.user = null;
  next();
});

app.use(cors(corsOptions));

// CSP
const cspDirectives = {
  defaultSrc: ["'self'"],
  scriptSrc: process.env.CSP_SCRIPT_SRC
    ? process.env.CSP_SCRIPT_SRC.split(',').map((src) => src.trim())
    : ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net'],
  styleSrc: process.env.CSP_STYLE_SRC
    ? process.env.CSP_STYLE_SRC.split(',').map((src) => src.trim())
    : ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net'],
  connectSrc: process.env.CSP_CONNECT_SRC
    ? process.env.CSP_CONNECT_SRC.split(',').map((src) => src.trim())
    : ["'self'", 'https://cdn.jsdelivr.net'],
  imgSrc: process.env.CSP_IMG_SRC
    ? process.env.CSP_IMG_SRC.split(',').map((src) => src.trim())
    : ["'self'", 'data:', 'https:'],
  fontSrc: process.env.CSP_FONT_SRC
    ? process.env.CSP_FONT_SRC.split(',').map((src) => src.trim())
    : ["'self'", 'https://cdn.jsdelivr.net'],
};

if (process.env.NODE_ENV !== 'production') {
  Object.keys(cspDirectives).forEach((key) => {
    if (Array.isArray(cspDirectives[key])) {
      cspDirectives[key].push('*.ngrok.io', '*.ngrok-free.app');
    }
  });
}

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: cspDirectives,
    },
  })
);

app.use(cookieParser());

// DB connect and sync
const { sequelize, connectDB, Sale, SaleItem, Customer, User } = require('./models');
// Conecta ao banco para falhar cedo se houver problema
if (connectDB && typeof connectDB === 'function') {
  connectDB();
}
// Sync só em dev por padrão
if (process.env.NODE_ENV !== 'production') {
  sequelize.sync().catch((err) =>
    console.error('Erro ao sincronizar banco de dados:', err)
  );
}
// Em produção, permitir sincronização opcional via env
if (process.env.NODE_ENV === 'production' && process.env.ENABLE_DB_SYNC === 'true') {
  const alter = process.env.DB_SYNC_ALTER === 'true';
  sequelize
    .sync({ alter })
    .then(() => console.log('Sincronização de modelos em produção concluída.'))
    .catch((err) => console.error('Erro ao sincronizar modelos em produção:', err));
}

// View engine
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Middlewares
app.use(speedLimiter);
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(
  express.static(path.join(__dirname, 'public'), {
    maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0,
    etag: true,
    lastModified: true,
  })
);
app.use(methodOverride('_method'));

// Sessão
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'seu_segredo_muito_secreto_para_sessao',
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: parseInt(process.env.SESSION_MAX_AGE) || 1000 * 60 * 60 * 24,
      secure:
        process.env.NODE_ENV === 'production'
          ? process.env.SESSION_SECURE === 'true'
          : false,
      httpOnly: process.env.SESSION_HTTP_ONLY !== 'false',
      sameSite:
        process.env.SESSION_SAME_SITE ||
        (process.env.NODE_ENV === 'production' ? 'strict' : 'lax'),
    },
  })
);
app.use(flash());

// Autenticação via cookie JWT -> locals
app.use(async (req, res, next) => {
  res.locals.successMessage = req.flash('success');
  res.locals.errorMessage = req.flash('error');

  const token = req.cookies.token;
  res.locals.isAuthenticated = false;
  res.locals.user = null;

  if (token) {
    try {
      const jwt = require('jsonwebtoken');
      const JWT_SECRET = process.env.JWT_SECRET;
      const { User } = require('./models');
      const decoded = jwt.verify(token, JWT_SECRET);
      res.locals.isAuthenticated = true;
      res.locals.user = await User.findByPk(decoded.id, {
        attributes: ['id', 'username', 'role'],
      });
    } catch (error) {
      console.warn('Token JWT inválido ou expirado:', error.message);
      res.clearCookie('token');
      res.locals.isAuthenticated = false;
      res.locals.user = null;
    }
  }

  next();
});

// Flash locals novamente
app.use((req, res, next) => {
  res.locals.successMessage = req.flash('success');
  res.locals.errorMessage = req.flash('error');
  next();
});

// Rotas
const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const userRoutes = require('./routes/userRoutes');
const customerRoutes = require('./routes/customerRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const salesRoutes = require('./routes/salesRoutes');
const harvestRoutes = require('./routes/harvestRoutes');
const lossRoutes = require('./routes/lossRoutes');
const settlementRoutes = require('./routes/settlementRoutes');
const healthRoutes = require('./routes/health');
const historyController = require('./controllers/historyController');
const chartsController = require('./controllers/chartsController');

// Health
app.use('/', healthRoutes);

app.use('/auth', authRoutes);
app.use('/products', apiLimiter, productRoutes);
app.use('/users', apiLimiter, userRoutes);
app.use('/customers', apiLimiter, customerRoutes);
app.use('/categories', apiLimiter, categoryRoutes);
app.use('/sales', authMiddleware, apiLimiter, salesRoutes);
app.use('/sales/reports', authMiddleware, authorizeRole(['admin', 'manager']));
app.use('/', authMiddleware, authorizeRole(['admin', 'manager']), harvestRoutes);
app.use('/losses', lossRoutes);
app.use('/settlement', authMiddleware, settlementRoutes);

// History/Charts
app.get(
  '/history',
  authMiddleware,
  authorizeRole(['admin', 'manager']),
  historyController.getHistoryPage
);
app.get(
  '/charts',
  authMiddleware,
  authorizeRole(['admin', 'manager']),
  chartsController.getChartsPage
);
app.get(
  '/charts/api/sales-data',
  authMiddleware,
  authorizeRole(['admin', 'manager']),
  chartsController.getSalesChartData
);
app.get(
  '/charts/api/top-products',
  authMiddleware,
  authorizeRole(['admin', 'manager']),
  chartsController.getTopProductsData
);
app.get(
  '/charts/api/harvests-data',
  authMiddleware,
  authorizeRole(['admin', 'manager']),
  chartsController.getHarvestsChartData
);
app.get(
  '/charts/api/losses-data',
  authMiddleware,
  authorizeRole(['admin', 'manager']),
  chartsController.getLossesChartData
);

// Dashboard
app.get(
  '/dashboard',
  authMiddleware,
  authorizeRole(['admin', 'manager']),
  async (req, res) => {
    try {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);

      const [lastSale, salesToday, totalProducts, totalCustomers] = await Promise.all([
        Sale.findOne({
          order: [['sale_date', 'DESC']],
          include: [
            { model: Customer, as: 'customer' },
            { model: User, as: 'user' },
          ],
        }),
        Sale.count({
          where: {
            sale_date: {
              [Op.between]: [startOfDay, endOfDay],
            },
          },
        }),
        SaleItem.sum('quantity', {
          include: [
            {
              model: Sale,
              as: 'sale',
              attributes: [], // não selecionar colunas de Sale para evitar ONLY_FULL_GROUP_BY
              where: {
                sale_date: {
                  [Op.between]: [startOfDay, endOfDay],
                },
              },
              required: true,
            },
          ],
          // garantir que nada além do aggregate seja selecionado
          attributes: [],
        }),
        Customer.count(),
      ]);

      return res.render('dashboard', {
        title: 'Dashboard',
        isAuthenticated: res.locals.isAuthenticated,
        user: res.locals.user,
        successMessage: res.locals.successMessage,
        errorMessage: res.locals.errorMessage,
        lastSale: lastSale || null,
        salesToday: salesToday || 0,
        totalProducts: totalProducts || 0,
        totalCustomers: totalCustomers || 0,
      });
    } catch (error) {
      console.error('Erro ao carregar o dashboard:', error);
      req.flash('error', 'Não foi possível carregar o dashboard.');
      return res.redirect('/');
    }
  }
);

// Dashboard/login redirect
app.get('/', (req, res) => {
  const token = req.cookies.token;
  if (token) {
    try {
      const jwt = require('jsonwebtoken');
      const JWT_SECRET = process.env.JWT_SECRET;
      jwt.verify(token, JWT_SECRET);
      return res.redirect('/dashboard');
    } catch (error) {
      res.clearCookie('token');
      return res.redirect('/auth/login');
    }
  }
  return res.redirect('/auth/login');
});

// 404
app.use((req, res, next) => {
  const acceptsJson = typeof req.headers.accept === 'string' ? req.headers.accept.includes('json') : false;
  if (req.xhr || acceptsJson || (req.path && req.path.startsWith('/api/'))) {
    return res.status(404).json({
      success: false,
      message: 'Página não encontrada.'
    });
  }
  res.status(404).render('error', {
    message: 'Página não encontrada.',
    isAuthenticated: res.locals.isAuthenticated,
    user: res.locals.user,
    successMessage: res.locals.successMessage,
    errorMessage: res.locals.errorMessage,
  });
});

// Erros
app.use((err, req, res, next) => {
  console.error(err);
  const acceptsJson = typeof req.headers.accept === 'string' ? req.headers.accept.includes('json') : false;
  if (req.xhr || acceptsJson || (req.path && req.path.startsWith('/api/'))) {
    return res.status(500).json({
      success: false,
      message: err && err.message ? err.message : 'Ocorreu um erro no servidor.',
      ...(process.env.NODE_ENV === 'production' ? {} : { error: { message: err.message, stack: err.stack } })
    });
  }
  res.status(500).render('error', {
    message: 'Ocorreu um erro no servidor.',
    error: process.env.NODE_ENV === 'production' ? {} : err,
    isAuthenticated: res.locals.isAuthenticated,
    user: res.locals.user,
    successMessage: res.locals.successMessage,
    errorMessage: res.locals.errorMessage,
  });
});

// Server
const PORT = process.env.PORT || 3001;
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
  });
}

module.exports = app;