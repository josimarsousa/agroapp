module.exports = {
  apps: [{
    name: 'agroapp',
    script: 'app.js',
    instances: 'max', // Usa todos os cores disponíveis
    exec_mode: 'cluster', // Modo cluster para melhor performance
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    // Logs
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    
    // Configurações de memória e restart
    max_memory_restart: '1G',
    node_args: '--max-old-space-size=1024',
    
    // Auto restart em caso de crash
    autorestart: true,
    watch: false, // Não usar watch em produção
    
    // Configurações de restart
    max_restarts: 10,
    min_uptime: '10s',
    
    // Configurações de cluster
    kill_timeout: 5000,
    listen_timeout: 3000,
    
    // Variáveis de ambiente específicas
    env_vars: {
      'NODE_OPTIONS': '--max-old-space-size=1024'
    }
  }],

  deploy: {
    production: {
      user: 'deploy',
      host: 'seu-servidor.com',
      ref: 'origin/main',
      repo: 'git@github.com:seu-usuario/agroapp.git',
      path: '/var/www/agroapp',
      'pre-deploy-local': '',
      'post-deploy': 'npm install --production && npm run prod:setup && pm2 reload ecosystem.config.js --env production',
      'pre-setup': ''
    }
  }
};