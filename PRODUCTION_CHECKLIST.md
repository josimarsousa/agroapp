# 🚀 Checklist de Produção - AgroApp

## ⚠️ PROBLEMAS CRÍTICOS ENCONTRADOS

### 🔴 ALTA PRIORIDADE - CORRIGIR ANTES DE PRODUÇÃO

1. **Dados Sensíveis Expostos**
   - ❌ Senha do banco de dados hardcoded em `config/config.json`
   - ❌ JWT_SECRET fraco no `.env` (parece ser um token de exemplo)
   - ❌ SESSION_SECRET muito simples

2. **Configurações de Segurança**
   - ❌ `secure: false` nos cookies (deve ser `true` em HTTPS)
   - ❌ CORS permite todos os origins (`callback(null, true)`)
   - ❌ CSP configurado para desenvolvimento (ngrok domains)

3. **Configuração de Banco de Dados**
   - ❌ Mesmas credenciais para dev/test/prod
   - ❌ Credenciais hardcoded no config.json

### 🟡 MÉDIA PRIORIDADE

4. **Logs e Monitoramento**
   - ⚠️ Logs de erro expostos ao usuário em produção
   - ⚠️ Falta de logging estruturado
   - ⚠️ Sequelize logging desabilitado (pode dificultar debug)

5. **Performance e Otimização**
   - ⚠️ Falta de compressão gzip
   - ⚠️ Falta de cache headers para arquivos estáticos
   - ⚠️ Puppeteer pode consumir muita memória

## ✅ CORREÇÕES NECESSÁRIAS

### 1. Variáveis de Ambiente (.env para produção)
```env
# Database
DB_HOST=seu_host_producao
DB_USER=usuario_producao
DB_PASSWORD=senha_super_forte_producao
DB_NAME=agroapp_prod

# Security
JWT_SECRET=jwt_secret_muito_forte_com_pelo_menos_32_caracteres_aleatorios
SESSION_SECRET=session_secret_muito_forte_com_pelo_menos_32_caracteres_aleatorios

# Environment
NODE_ENV=production
PORT=3001

# SSL/TLS
SSL_CERT_PATH=/path/to/cert.pem
SSL_KEY_PATH=/path/to/key.pem
```

### 2. Configuração de Produção (app.js)
```javascript
// Configurações que devem mudar em produção:

// CORS - restringir origins
app.use(cors({
    origin: ['https://seudominio.com', 'https://www.seudominio.com'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Cookies seguros
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { 
        maxAge: 1000 * 60 * 60 * 24,
        secure: true, // HTTPS obrigatório
        httpOnly: true,
        sameSite: 'strict'
    }
}));

// CSP para produção
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "https://cdn.jsdelivr.net"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            connectSrc: ["'self'", "https://cdn.jsdelivr.net"],
            imgSrc: ["'self'", "data:"],
            fontSrc: ["'self'"]
        }
    }
}));

// Tratamento de erros (não expor stack trace)
app.use((err, req, res, next) => {
    console.error(err.stack);
    if (process.env.NODE_ENV === 'production') {
        res.status(500).render('error', { message: 'Erro interno do servidor.' });
    } else {
        res.status(500).render('error', { message: 'Erro interno do servidor.', error: err });
    }
});
```

### 3. Configuração de Banco (config/config.json)
```json
{
  "production": {
    "username": "${DB_USER}",
    "password": "${DB_PASSWORD}",
    "database": "${DB_NAME}",
    "host": "${DB_HOST}",
    "dialect": "mysql",
    "logging": false,
    "pool": {
      "max": 10,
      "min": 2,
      "acquire": 30000,
      "idle": 10000
    }
  }
}
```

### 4. Scripts de Produção (package.json)
```json
{
  "scripts": {
    "start": "NODE_ENV=production node app.js",
    "dev": "NODE_ENV=development nodemon app.js",
    "test": "NODE_ENV=test npm test",
    "migrate": "npx sequelize-cli db:migrate",
    "seed": "npx sequelize-cli db:seed:all"
  }
}
```

### 5. Melhorias de Performance
```javascript
// Adicionar ao app.js
const compression = require('compression');
app.use(compression());

// Cache para arquivos estáticos
app.use(express.static(path.join(__dirname, 'public'), {
    maxAge: '1d',
    etag: true
}));
```

## 🔒 SEGURANÇA ADICIONAL

### Rate Limiting Mais Restritivo
```javascript
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 3, // Máximo 3 tentativas
    message: 'Muitas tentativas de login. Tente novamente em 15 minutos.',
    standardHeaders: true,
    legacyHeaders: false,
});
```

### Validação de Input
- Implementar validação rigorosa em todas as rotas
- Sanitizar dados de entrada
- Usar bibliotecas como `joi` ou `express-validator`

### Logs Estruturados
```javascript
const winston = require('winston');

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.json(),
    transports: [
        new winston.transports.File({ filename: 'error.log', level: 'error' }),
        new winston.transports.File({ filename: 'combined.log' })
    ]
});
```

## 🚀 DEPLOY

### Variáveis de Ambiente Obrigatórias
- `NODE_ENV=production`
- `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
- `JWT_SECRET` (32+ caracteres aleatórios)
- `SESSION_SECRET` (32+ caracteres aleatórios)

### Checklist Final
- [ ] Todas as senhas alteradas
- [ ] HTTPS configurado
- [ ] Certificados SSL válidos
- [ ] Backup do banco configurado
- [ ] Monitoramento configurado
- [ ] Logs centralizados
- [ ] Rate limiting testado
- [ ] Testes de segurança executados

## ⚡ PERFORMANCE

### Recomendações
1. **Usar PM2** para gerenciamento de processos
2. **Nginx** como proxy reverso
3. **Redis** para sessões em produção
4. **CDN** para arquivos estáticos
5. **Monitoramento** com ferramentas como New Relic ou DataDog

---

**⚠️ IMPORTANTE**: Este projeto NÃO está pronto para produção no estado atual. As correções acima são OBRIGATÓRIAS antes do deploy.