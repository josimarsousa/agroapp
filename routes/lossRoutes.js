const express = require('express');
const router = express.Router();
const lossController = require('../controllers/lossController');
const { isAuthenticated, authMiddleware} = require('../middleware/authMiddleware');

router.get('/', authMiddleware, lossController.listLosses);
router.get('/new', authMiddleware, lossController.newLossForm);
router.post('/', authMiddleware, lossController.createLoss);
router.get('/:id/edit', authMiddleware, lossController.editLossForm);
router.post('/:id', authMiddleware, lossController.updateLoss); // Ou router.put('/:id', ...)
router.post('/:id/delete', authMiddleware, lossController.deleteLoss); // Ou router.delete('/:id', ...)
router.get('/export-pdf', authMiddleware, lossController.exportLossesPdf); // Se quiser um PDF de perdas

module.exports = router;