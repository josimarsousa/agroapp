const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { authMiddleware } = require('../middleware/authMiddleware');

// Todas as rotas de produto exigem autenticação
router.use(authMiddleware);

router.get('/', productController.getAllProducts);
router.get('/new', productController.getCreateProductForm);
router.post('/', productController.createProduct);
router.get('/edit/:id', productController.getEditProductForm);
router.post('/edit/:id', productController.updateProduct);
router.post('/delete/:id', productController.deleteProduct);

// Rotas para a API (PDV)
router.get('/api/search', productController.searchProducts); // Para autocompletar produtos
router.get('/api/:id', productController.getProductById); // Para buscar um produto específico

module.exports = router;