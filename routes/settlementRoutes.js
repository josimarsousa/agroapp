const express = require('express');
const router = express.Router();
const settlementController = require('../controllers/settlementController');
const { authMiddleware } = require('../middleware/authMiddleware');

// Rota para a view de acerto
router.get('/', authMiddleware, settlementController.settlementView);

// Rota para exportação PDF
router.get('/export-pdf', authMiddleware, settlementController.exportSettlementPDF);

module.exports = router;