// routes/salesRoutes.js

const express = require('express');
const router = express.Router();
const salesController = require('../controllers/salesController');
const { authMiddleware, authorizeRole } = require('../middleware/authMiddleware');

// Todas as rotas de vendas exigem autenticação
router.use(authMiddleware);

// Rota de teste para ver se o router está funcionando
/*router.get('/test', (req, res) => {
    res.send('Rota de teste de vendas OK!');
});*/
//rota para gerar o grafico
router.get('/reports', authMiddleware, authorizeRole(['admin', 'manager']), salesController.getSalesReportsPage);
//fornece os dados para o gráfico
router.get('/api/sales-data', authMiddleware, authorizeRole(['admin', 'manager']), salesController.getSalesDataForChart)

router.get('/', salesController.getAllSales);
router.get('/pdv', salesController.getPdvPage);
router.get('/:id', authMiddleware, salesController.getSaleDetails);
router.post('/finalize',
    authMiddleware, // Seu middleware de autenticação
    salesController.finalizeSale
);
/*router.post('/finalize', salesController.finalizeSale);*/
router.get('/:id/pdf', salesController.generateSalePdf); // DEIXE APENAS ESTA DESCOMENTADA POR ENQUANTO

module.exports = router;