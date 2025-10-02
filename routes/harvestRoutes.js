// routes/harvestRoutes.js

const express = require('express');
const router = express.Router();
const harvestController = require('../controllers/harvestController');
const { isAuthenticated, authMiddleware} = require('../middleware/authMiddleware');

router.get('/harvests/new', authMiddleware, harvestController.newHarvestForm);
router.post('/harvests', authMiddleware, harvestController.createHarvest);
router.get('/harvests', authMiddleware, harvestController.listHarvests);
router.get('/harvests/edit/:id', authMiddleware, harvestController.editHarvestForm);
router.post('/harvests/:id', authMiddleware, harvestController.updateHarvest);
router.get('/harvests/export-pdf', authMiddleware, harvestController.exportHarvestsPdf)

module.exports = router;