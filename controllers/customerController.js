const { Customer } = require('../models');

// Listar todos os clientes
exports.getAllCustomers = async (req, res) => {
    try {
        const customers = await Customer.findAll();
        res.render('customers/index', { title: 'Gerenciar Clientes', customers });
    } catch (error) {
        console.error('Erro ao buscar clientes:', error);
        res.status(500).render('error', { message: 'Erro ao carregar clientes.' });
    }
};

// Exibir formulário de criação de cliente
exports.getCreateCustomerForm = (req, res) => {
    res.render('customers/form', { title: 'Novo Cliente', customer: {}, isEdit: false });
};

// Criar um novo cliente
exports.createCustomer = async (req, res) => {
    const { name, email, phone, address } = req.body;
    try {
        await Customer.create({ name, email, phone, address });
        res.redirect('/customers');
    } catch (error) {
        console.error('Erro ao criar cliente:', error);
        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.render('customers/form', { title: 'Novo Cliente', customer: req.body, isEdit: false, error: 'E-mail já cadastrado.' });
        }
        res.status(500).render('customers/form', { title: 'Novo Cliente', customer: req.body, isEdit: false, error: 'Erro ao criar cliente.' });
    }
};

// Exibir formulário de edição de cliente
exports.getEditCustomerForm = async (req, res) => {
    try {
        const customer = await Customer.findByPk(req.params.id);
        if (!customer) {
            return res.status(404).render('error', { message: 'Cliente não encontrado.' });
        }
        res.render('customers/form', { title: 'Editar Cliente', customer, isEdit: true });
    } catch (error) {
        console.error('Erro ao buscar cliente para edição:', error);
        res.status(500).render('error', { message: 'Erro ao carregar cliente para edição.' });
    }
};

// Atualizar cliente
exports.updateCustomer = async (req, res) => {
    const { id } = req.params;
    const { name, email, phone, address } = req.body;
    try {
        const customer = await Customer.findByPk(id);
        if (!customer) {
            return res.status(404).render('error', { message: 'Cliente não encontrado.' });
        }

        customer.name = name;
        customer.email = email;
        customer.phone = phone;
        customer.address = address;
        await customer.save();
        res.redirect('/customers');
    } catch (error) {
        console.error('Erro ao atualizar cliente:', error);
        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.render('customers/form', { title: 'Editar Cliente', customer: req.body, isEdit: true, error: 'E-mail já cadastrado.' });
        }
        res.status(500).render('customers/form', { title: 'Editar Cliente', customer: req.body, isEdit: true, error: 'Erro ao atualizar cliente.' });
    }
};

// Excluir cliente
exports.deleteCustomer = async (req, res) => {
    try {
        const result = await Customer.destroy({ where: { id: req.params.id } });
        if (result === 0) {
            return res.status(404).render('error', { message: 'Cliente não encontrado para exclusão.' });
        }
        res.redirect('/customers');
    } catch (error) {
        console.error('Erro ao excluir cliente:', error);
        res.status(500).render('error', { message: 'Erro ao excluir cliente.' });
    }
};