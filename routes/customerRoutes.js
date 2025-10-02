const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');
const { authMiddleware } = require('../middleware/authMiddleware');

// Todas as rotas de cliente exigem autenticação
router.use(authMiddleware);

router.get('/', customerController.getAllCustomers);
router.get('/new', customerController.getCreateCustomerForm);
router.post('/', customerController.createCustomer);
router.get('/edit/:id', customerController.getEditCustomerForm);
router.post('/edit/:id', customerController.updateCustomer);
router.post('/delete/:id', customerController.deleteCustomer);

module.exports = router;