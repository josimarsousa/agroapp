const express = require('express');
const router = express.Router();
const { sequelize } = require('../models');

// Health check endpoint para monitoramento
router.get('/health', async (req, res) => {
    try {
        // Verifica conexão com o banco de dados
        await sequelize.authenticate();
        
        const healthStatus = {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            environment: process.env.NODE_ENV || 'development',
            version: require('../package.json').version,
            database: 'connected',
            memory: {
                used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB',
                total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + ' MB'
            }
        };
        
        res.status(200).json(healthStatus);
    } catch (error) {
        const healthStatus = {
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            environment: process.env.NODE_ENV || 'development',
            version: require('../package.json').version,
            database: 'disconnected',
            error: error.message
        };
        
        res.status(503).json(healthStatus);
    }
});

module.exports = router;