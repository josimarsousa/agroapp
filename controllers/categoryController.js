const { Category } = require('../models');

// Listar todas as categorias
exports.getAllCategories = async (req, res) => {
    try {
        const categories = await Category.findAll();
        res.render('categories/index',
            { title: 'Categorias',
                categories: categories,
                errorMessage: req.flash('error'),
                sucessMessage: req.flash('success'),
            });
    } catch (error) {
        console.error('Erro ao buscar categorias:', error);
        //res.status(500).render('error', { message: 'Erro ao carregar categorias.' });
        req.flash('error', 'Erro ao carregar categorias.');
        res.redirect('/dashboard')
    }
};

// Exibir formulário de criação de categoria
exports.getCreateCategoryForm = (req, res) => {
    res.render('categories/form', { title: 'Nova Categoria', category: {}, isEdit: false });
};

// Criar uma nova categoria
exports.createCategory = async (req, res) => {
    const { name, description } = req.body;
    try {
        await Category.create({ name, description });
        res.redirect('/categories');
    } catch (error) {
        console.error('Erro ao criar categoria:', error);
        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.render('categories/form', { title: 'Nova Categoria', category: req.body, isEdit: false, error: 'Nome da categoria já existe.' });
        }
        res.status(500).render('categories/form', { title: 'Nova Categoria', category: req.body, isEdit: false, error: 'Erro ao criar categoria.' });
    }
};

// Exibir formulário de edição de categoria
exports.getEditCategoryForm = async (req, res) => {
    try {
        const category = await Category.findByPk(req.params.id);
        if (!category) {
            return res.status(404).render('error', { message: 'Categoria não encontrada.' });
        }
        res.render('categories/form', { title: 'Editar Categoria', category, isEdit: true });
    } catch (error) {
        console.error('Erro ao buscar categoria para edição:', error);
        res.status(500).render('error', { message: 'Erro ao carregar categoria para edição.' });
    }
};

// Atualizar categoria
exports.updateCategory = async (req, res) => {
    const { id } = req.params;
    const { name, description } = req.body;
    try {
        const category = await Category.findByPk(id);
        if (!category) {
            return res.status(404).render('error', { message: 'Categoria não encontrada.' });
        }

        category.name = name;
        category.description = description;
        await category.save();
        res.redirect('/categories');
    } catch (error) {
        console.error('Erro ao atualizar categoria:', error);
        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.render('categories/form', { title: 'Editar Categoria', category: req.body, isEdit: true, error: 'Nome da categoria já existe.' });
        }
        res.status(500).render('categories/form', { title: 'Editar Categoria', category: req.body, isEdit: true, error: 'Erro ao atualizar categoria.' });
    }
};

// Excluir categoria
exports.deleteCategory = async (req, res) => {
    try {
        const result = await Category.destroy({ where: { id: req.params.id } });
        if (result === 0) {
            return res.status(404).render('error', { message: 'Categoria não encontrada para exclusão.' });
        }
        res.redirect('/categories');
    } catch (error) {
        console.error('Erro ao excluir categoria:', error);
        res.status(500).render('error', { message: 'Erro ao excluir categoria.' });
    }
};