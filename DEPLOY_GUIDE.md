# Guia de Deploy para Produção - AgroApp

## 📋 Pré-requisitos

### Servidor
- Node.js >= 16.0.0
- npm >= 8.0.0
- MySQL 8.0+
- Nginx (recomendado para proxy reverso)
- SSL/TLS certificado (Let's Encrypt recomendado)

### Variáveis de Ambiente
Copie o arquivo `.env.production` para `.env` no servidor e configure:

```bash
# Banco de Dados
DB_HOST=seu_host_mysql
DB_USER=seu_usuario_mysql
DB_PASSWORD=sua_senha_mysql_segura
DB_NAME=agroapp_production

# Segurança
JWT_SECRET=seu_jwt_secret_super_seguro_gerado
SESSION_SECRET=seu_session_secret_super_seguro_gerado

# Servidor
PORT=3001
NODE_ENV=production

# CORS (domínios permitidos separados por vírgula)
CORS_ORIGINS=https://seudominio.com,https://www.seudominio.com

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Sessão
SESSION_MAX_AGE=86400000
SESSION_SECURE=true
SESSION_HTTP_ONLY=true
SESSION_SAME_SITE=strict

# CSP (Content Security Policy)
CSP_SCRIPT_SRC=https://cdn.jsdelivr.net
CSP_STYLE_SRC=https://cdn.jsdelivr.net
CSP_CONNECT_SRC=https://cdn.jsdelivr.net
CSP_IMG_SRC=data: https:
CSP_FONT_SRC=https://cdn.jsdelivr.net
```

## 🚀 Processo de Deploy

### 1. Preparação do Servidor
```bash
# Clone o repositório
git clone <seu-repositorio> agroapp
cd agroapp

# Instale as dependências
npm install --production

# Configure as variáveis de ambiente
cp .env.production .env
# Edite o arquivo .env com suas configurações
```

### 2. Configuração do Banco de Dados
```bash
# Execute as migrações
npm run prod:setup

# Ou manualmente:
NODE_ENV=production npm run migrate
```

### 3. Configuração do Nginx
Crie o arquivo `/etc/nginx/sites-available/agroapp`:

```nginx
server {
    listen 80;
    server_name seudominio.com www.seudominio.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name seudominio.com www.seudominio.com;

    ssl_certificate /path/to/your/certificate.pem;
    ssl_certificate_key /path/to/your/private.key;

    # Configurações SSL recomendadas
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;

    # Headers de segurança
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload";

    # Proxy para a aplicação
    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Cache para arquivos estáticos
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

### 4. Configuração do PM2 (Gerenciador de Processos)
```bash
# Instale o PM2 globalmente
npm install -g pm2

# Crie o arquivo ecosystem.config.js
```

Arquivo `ecosystem.config.js`:
```javascript
module.exports = {
  apps: [{
    name: 'agroapp',
    script: 'app.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    max_memory_restart: '1G',
    node_args: '--max-old-space-size=1024'
  }]
};
```

### 5. Inicialização
```bash
# Crie o diretório de logs
mkdir -p logs

# Inicie a aplicação com PM2
pm2 start ecosystem.config.js

# Configure para iniciar automaticamente
pm2 startup
pm2 save
```

## 🔍 Monitoramento

### Health Check
A aplicação possui um endpoint de health check em `/health`:
```bash
curl https://seudominio.com/health
```

### Logs
```bash
# Visualizar logs em tempo real
npm run logs

# Ou com PM2
pm2 logs agroapp
```

### Comandos Úteis
```bash
# Verificar status da aplicação
npm run health

# Reiniciar aplicação
pm2 restart agroapp

# Parar aplicação
pm2 stop agroapp

# Monitorar recursos
pm2 monit
```

## 🔒 Segurança Pós-Deploy

### 1. Firewall
```bash
# Configure o UFW (Ubuntu)
ufw allow ssh
ufw allow 80
ufw allow 443
ufw enable
```

### 2. Backup do Banco de Dados
Configure backups automáticos:
```bash
# Exemplo de script de backup
mysqldump -u $DB_USER -p$DB_PASSWORD $DB_NAME > backup_$(date +%Y%m%d_%H%M%S).sql
```

### 3. Monitoramento de Segurança
- Configure alertas para tentativas de login suspeitas
- Monitore logs de acesso do Nginx
- Use ferramentas como Fail2Ban para proteção contra ataques

## 📊 Performance

### Otimizações Implementadas
- ✅ Compressão gzip
- ✅ Cache de arquivos estáticos
- ✅ Rate limiting
- ✅ Slow down para requisições excessivas
- ✅ Headers de cache apropriados

### Monitoramento de Performance
```bash
# Verificar uso de memória
pm2 show agroapp

# Monitorar em tempo real
pm2 monit
```

## 🚨 Troubleshooting

### Problemas Comuns

1. **Erro de conexão com banco de dados**
   - Verifique as credenciais no `.env`
   - Confirme se o MySQL está rodando
   - Teste a conexão manualmente

2. **Erro 502 Bad Gateway**
   - Verifique se a aplicação está rodando (`pm2 status`)
   - Confirme se a porta está correta no Nginx

3. **Problemas de CORS**
   - Verifique a configuração `CORS_ORIGINS` no `.env`
   - Confirme se o domínio está correto

### Logs de Debug
```bash
# Logs da aplicação
pm2 logs agroapp --lines 100

# Logs do Nginx
tail -f /var/log/nginx/error.log
tail -f /var/log/nginx/access.log
```

## 📝 Checklist Final

- [ ] Variáveis de ambiente configuradas
- [ ] Banco de dados migrado
- [ ] SSL/TLS configurado
- [ ] Nginx configurado
- [ ] PM2 configurado e rodando
- [ ] Firewall configurado
- [ ] Backup configurado
- [ ] Health check funcionando
- [ ] Logs sendo gerados
- [ ] Monitoramento ativo

## 📞 Suporte

Para suporte técnico, consulte:
- Logs da aplicação: `npm run logs`
- Health check: `npm run health`
- Status do PM2: `pm2 status`