const { Sale, Harvest, Loss, Product, Customer, User, SaleItem, sequelize } = require('../models');
const { Op, Sequelize } = require('sequelize');

const chartsController = {
    // Página principal dos gráficos
    async getChartsPage(req, res) {
        try {
            res.render('charts/index', {
                title: 'Gráficos e Relatórios',
                user: req.user,
                isAuthenticated: true
            });
        } catch (error) {
            console.error('Erro ao carregar página de gráficos:', error);
            res.status(500).render('error', {
                message: 'Erro interno do servidor ao carregar gráficos.',
                user: req.user,
                isAuthenticated: true
            });
        }
    },

    // API para dados de vendas por dia
    async getSalesChartData(req, res) {
        try {
            const { period = '30' } = req.query;
            const days = parseInt(period);
            
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - days);
            
            const salesData = await Sale.findAll({
                where: {
                    sale_date: {
                        [Op.gte]: startDate
                    }
                },
                attributes: [
                    [Sequelize.fn('DATE_FORMAT', Sequelize.col('sale_date'), '%Y-%m-%d'), 'day'],
                    [Sequelize.fn('SUM', Sequelize.col('total_amount')), 'total'],
                    [Sequelize.fn('COUNT', Sequelize.col('id')), 'count']
                ],
                group: [Sequelize.fn('DATE_FORMAT', Sequelize.col('sale_date'), '%Y-%m-%d')],
                order: [[Sequelize.fn('DATE_FORMAT', Sequelize.col('sale_date'), '%Y-%m-%d'), 'ASC']]
            });

            const labels = salesData.map(item => {
                const [year, month, day] = item.dataValues.day.split('-');
                const date = new Date(year, month - 1, day);
                return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
            });

            const data = salesData.map(item => parseFloat(item.dataValues.total));
            const counts = salesData.map(item => parseInt(item.dataValues.count));

            res.json({
                labels,
                datasets: [
                    {
                        label: 'Faturamento (R$)',
                        data,
                        backgroundColor: 'rgba(40, 167, 69, 0.6)',
                        borderColor: 'rgba(40, 167, 69, 1)',
                        borderWidth: 2,
                        yAxisID: 'y'
                    },
                    {
                        label: 'Quantidade de Vendas',
                        data: counts,
                        backgroundColor: 'rgba(0, 123, 255, 0.6)',
                        borderColor: 'rgba(0, 123, 255, 1)',
                        borderWidth: 2,
                        type: 'line',
                        yAxisID: 'y1'
                    }
                ]
            });
        } catch (error) {
            console.error('Erro ao buscar dados de vendas:', error);
            res.status(500).json({ error: 'Erro ao buscar dados de vendas' });
        }
    },

    // API para dados de produtos mais vendidos
    async getTopProductsData(req, res) {
        try {
            const { limit = '10', period = '30' } = req.query;
            const days = parseInt(period);
            
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - days);
            
            const topProducts = await SaleItem.findAll({
                include: [
                    {
                        model: Product,
                        as: 'product',
                        attributes: ['name']
                    },
                    {
                        model: Sale,
                        as: 'sale',
                        attributes: [],
                        where: {
                            sale_date: {
                                [Op.gte]: startDate
                            }
                        }
                    }
                ],
                attributes: [
                    'product_id',
                    [Sequelize.fn('SUM', Sequelize.col('quantity')), 'total_quantity'],
                    [Sequelize.fn('SUM', Sequelize.col('subtotal')), 'total_revenue']
                ],
                group: ['product_id', 'product.id'],
                order: [[Sequelize.fn('SUM', Sequelize.col('quantity')), 'DESC']],
                limit: parseInt(limit)
            });

            const labels = topProducts.map(item => item.product?.name || 'Produto não informado');
            const quantities = topProducts.map(item => parseFloat(item.dataValues.total_quantity));
            const revenues = topProducts.map(item => parseFloat(item.dataValues.total_revenue));

            res.json({
                labels,
                datasets: [
                    {
                        label: 'Quantidade Vendida',
                        data: quantities,
                        backgroundColor: 'rgba(255, 193, 7, 0.6)',
                        borderColor: 'rgba(255, 193, 7, 1)',
                        borderWidth: 2
                    },
                    {
                        label: 'Receita (R$)',
                        data: revenues,
                        backgroundColor: 'rgba(220, 53, 69, 0.6)',
                        borderColor: 'rgba(220, 53, 69, 1)',
                        borderWidth: 2,
                        type: 'line',
                        yAxisID: 'y1'
                    }
                ]
            });
        } catch (error) {
            console.error('Erro ao buscar produtos mais vendidos:', error);
            res.status(500).json({ error: 'Erro ao buscar produtos mais vendidos' });
        }
    },

    // API para dados de colheitas por mês
    async getHarvestsChartData(req, res) {
        try {
            const { period = '30' } = req.query;
            const days = parseInt(period);
            
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - days);
            
            const harvestsData = await Harvest.findAll({
                where: {
                    harvest_date: {
                        [Op.gte]: startDate
                    }
                },
                attributes: [
                    [Sequelize.fn('DATE_FORMAT', Sequelize.col('harvest_date'), '%Y-%m-%d'), 'day'],
                    [Sequelize.fn('SUM', Sequelize.col('quantity')), 'total_quantity']
                ],
                group: [Sequelize.fn('DATE_FORMAT', Sequelize.col('harvest_date'), '%Y-%m-%d')],
                order: [[Sequelize.fn('DATE_FORMAT', Sequelize.col('harvest_date'), '%Y-%m-%d'), 'ASC']]
            });

            const labels = harvestsData.map(item => {
                const [year, month, day] = item.dataValues.day.split('-');
                const date = new Date(year, month - 1, day);
                return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
            });

            const data = harvestsData.map(item => parseFloat(item.dataValues.total_quantity));

            res.json({
                labels,
                datasets: [
                    {
                        label: 'Quantidade Colhida (kg)',
                        data,
                        backgroundColor: 'rgba(40, 167, 69, 0.6)',
                        borderColor: 'rgba(40, 167, 69, 1)',
                        borderWidth: 2,
                        fill: true
                    }
                ]
            });
        } catch (error) {
            console.error('Erro ao buscar dados de colheitas:', error);
            res.status(500).json({ error: 'Erro ao buscar dados de colheitas' });
        }
    },

    // API para dados de perdas por mês
    async getLossesChartData(req, res) {
        try {
            const { period = '30' } = req.query;
            const days = parseInt(period);
            
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - days);
            
            const lossesData = await Loss.findAll({
                where: {
                    loss_date: {
                        [Op.gte]: startDate
                    }
                },
                attributes: [
                    [Sequelize.fn('DATE_FORMAT', Sequelize.col('loss_date'), '%Y-%m-%d'), 'day'],
                    [Sequelize.fn('SUM', Sequelize.col('quantity')), 'total_quantity']
                ],
                group: [Sequelize.fn('DATE_FORMAT', Sequelize.col('loss_date'), '%Y-%m-%d')],
                order: [[Sequelize.fn('DATE_FORMAT', Sequelize.col('loss_date'), '%Y-%m-%d'), 'ASC']]
            });

            const labels = lossesData.map(item => {
                const [year, month, day] = item.dataValues.day.split('-');
                const date = new Date(year, month - 1, day);
                return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
            });

            const data = lossesData.map(item => parseFloat(item.dataValues.total_quantity));

            res.json({
                labels,
                datasets: [
                    {
                        label: 'Quantidade Perdida (kg)',
                        data,
                        backgroundColor: 'rgba(220, 53, 69, 0.6)',
                        borderColor: 'rgba(220, 53, 69, 1)',
                        borderWidth: 2,
                        fill: true
                    }
                ]
            });
        } catch (error) {
            console.error('Erro ao buscar dados de perdas:', error);
            res.status(500).json({ error: 'Erro ao buscar dados de perdas' });
        }
    }
};

module.exports = chartsController;