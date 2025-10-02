const { Product, Category } = require('../models');

// Listar todos os produtos
exports.getAllProducts = async (req, res) => {
    try {
        const products = await Product.findAll({
            include: [
                {
                    model: Category,
                    as: 'category' // <<< COLOQUE ESTE APELIDO AQUI! DEVE SER IGUAL AO DO Product.js
                }
            ],
            order: [['name', 'ASC']] // Exemplo de ordenação
        });

        res.render('products/index', { title: 'Gerenciar Produtos', products });
    } catch (error) {
        console.error('Erro ao buscar produtos:', error);
        res.status(500).render('error', { message: 'Erro ao carregar produtos.' });
    }
};

// Exibir formulário de criação de produto
exports.getCreateProductForm = async (req, res) => {
    try {
        const categories = await Category.findAll();
        res.render('products/form', { title: 'Novo Produto', product: {}, categories, isEdit: false });
    } catch (error) {
        console.error('Erro ao carregar formulário de produto:', error);
        res.status(500).render('error', { message: 'Erro ao carregar formulário de produto.' });
    }
};

// Criar um novo produto
exports.createProduct = async (req, res) => {
    const { name, description, price, stock_quantity, category_id } = req.body;
    try {
        await Product.create({ name, description, price, stock_quantity, category_id: category_id || null });
        res.redirect('/products');
    } catch (error) {
        console.error('Erro ao criar produto:', error);
        const categories = await Category.findAll(); // Recarregar categorias para a view
        res.status(500).render('products/form', { title: 'Novo Produto', product: req.body, categories, isEdit: false, error: 'Erro ao criar produto.' });
    }
};

// Exibir formulário de edição de produto
exports.getEditProductForm = async (req, res) => {
    try {
        const product = await Product.findByPk(req.params.id);
        if (!product) {
            return res.status(404).render('error', { message: 'Produto não encontrado.' });
        }
        const categories = await Category.findAll();
        res.render('products/form', { title: 'Editar Produto', product, categories, isEdit: true });
    } catch (error) {
        console.error('Erro ao buscar produto para edição:', error);
        res.status(500).render('error', { message: 'Erro ao carregar produto para edição.' });
    }
};

// Atualizar produto
exports.updateProduct = async (req, res) => {
    const { id } = req.params;
    const { name, description, price, stock_quantity, category_id } = req.body;
    try {
        const product = await Product.findByPk(id);
        if (!product) {
            return res.status(404).render('error', { message: 'Produto não encontrado.' });
        }

        product.name = name;
        product.description = description;
        product.price = parseFloat(price); // Garantir que é um número
        product.stock_quantity = parseInt(stock_quantity, 10); // Garantir que é um número inteiro
        product.category_id = category_id || null;
        await product.save();
        res.redirect('/products');
    } catch (error) {
        console.error('Erro ao atualizar produto:', error);
        const categories = await Category.findAll();
        res.status(500).render('products/form', { title: 'Editar Produto', product: req.body, categories, isEdit: true, error: 'Erro ao atualizar produto.' });
    }
};

// Excluir produto
exports.deleteProduct = async (req, res) => {
    try {
        const result = await Product.destroy({ where: { id: req.params.id } });
        if (result === 0) {
            return res.status(404).render('error', { message: 'Produto não encontrado para exclusão.' });
        }
        res.redirect('/products');
    } catch (error) {
        console.error('Erro ao excluir produto:', error);
        res.status(500).render('error', { message: 'Erro ao excluir produto.' });
    }
};

// API para buscar produto por ID (para a tela de PDV)
exports.getProductById = async (req, res) => {
    try {
        const product = await Product.findByPk(req.params.id);
        if (!product) {
            return res.status(404).json({ success: false, message: 'Produto não encontrado.' });
        }
        res.json({ success: true, product });
    } catch (error) {
        console.error('Erro ao buscar produto por ID:', error);
        res.status(500).json({ success: false, message: 'Erro ao buscar produto.' });
    }
};

// API para buscar produtos por nome (para a tela de PDV - autocomplete/sugestão)
exports.searchProducts = async (req, res) => {
    const { query } = req.query;
    try {
        const products = await Product.findAll({
            where: {
                name: {
                    [require('sequelize').Op.like]: `%${query}%` // Busca por partes do nome
                }
            },
            attributes: ['id', 'name', 'price', 'stock_quantity'],
            limit: 50, // Aumentar limite para mostrar mais resultados
            order: [['name', 'ASC']] // Ordenar por nome para melhor organização
        })

        const productsFormatted = products.map(product => ({
            id: product.id,
            name: product.name,
            price: parseFloat(product.price), // Converte para float (número)
            stock_quantity: product.stock_quantity
        }));

        res.json({ success: true, products: productsFormatted });
    } catch (error) {
        console.error('Erro ao buscar produtos para PDV:', error);
        res.status(500).json({ success: false, message: 'Erro ao buscar produtos.' });
    }
};