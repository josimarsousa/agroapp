const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');
const { authMiddleware } = require('../middleware/authMiddleware');

// Todas as rotas de categoria exigem autenticação
router.use(authMiddleware);

router.get('/', categoryController.getAllCategories);
router.get('/new', categoryController.getCreateCategoryForm);
router.post('/', categoryController.createCategory);
router.get('/edit/:id', categoryController.getEditCategoryForm);
router.post('/edit/:id', categoryController.updateCategory);
router.post('/delete/:id', categoryController.deleteCategory);

module.exports = router;