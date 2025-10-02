const { Sale, Harvest, Loss, Product, Customer, User } = require('../models');
const { Op } = require('sequelize');

const historyController = {
    // Página principal do histórico
    async getHistoryPage(req, res) {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = 20;
            const offset = (page - 1) * limit;
            const type = req.query.type || 'all';
            const startDate = req.query.startDate;
            const endDate = req.query.endDate;

            let whereClause = {};
            
            // Filtro por data
            if (startDate && endDate) {
                whereClause.createdAt = {
                    [Op.between]: [new Date(startDate), new Date(endDate)]
                };
            }

            let activities = [];

            // Buscar vendas
            if (type === 'all' || type === 'sales') {
                const sales = await Sale.findAll({
                    where: whereClause,
                    include: [
                        { model: Customer, as: 'customer', attributes: ['name'] },
                        { model: User, as: 'user', attributes: ['username'] }
                    ],
                    order: [['created_at', 'DESC']],
                    limit: type === 'sales' ? limit : Math.floor(limit / 3),
                    offset: type === 'sales' ? offset : 0
                });

                sales.forEach(sale => {
                    activities.push({
                        type: 'sale',
                        id: sale.id,
                        date: sale.sale_date || sale.created_at,
                        description: `Venda para ${sale.customer?.name || 'Cliente não informado'}`,
                        value: sale.total_amount,
                        user: sale.user?.username || 'Usuário não informado',
                        details: sale
                    });
                });
            }

            // Buscar colheitas
            if (type === 'all' || type === 'harvests') {
                const harvests = await Harvest.findAll({
                    where: whereClause,
                    include: [
                        { model: Product, as: 'product', attributes: ['name'] },
                        { model: User, as: 'user', attributes: ['username'] }
                    ],
                    order: [['createdAt', 'DESC']],
                    limit: type === 'harvests' ? limit : Math.floor(limit / 3),
                    offset: type === 'harvests' ? offset : 0
                });

                harvests.forEach(harvest => {
                    activities.push({
                        type: 'harvest',
                        id: harvest.id,
                        date: harvest.harvest_date || harvest.created_at,
                        description: `Colheita de ${harvest.product?.name || 'Produto não informado'}`,
                        value: harvest.quantity,
                        unit: 'kg',
                        user: harvest.user?.username || 'Usuário não informado',
                        details: harvest
                    });
                });
            }

            // Buscar perdas
            if (type === 'all' || type === 'losses') {
                const losses = await Loss.findAll({
                    where: whereClause,
                    include: [
                        { model: Product, as: 'product', attributes: ['name'] },
                        { model: User, as: 'user', attributes: ['username'] }
                    ],
                    order: [['createdAt', 'DESC']],
                    limit: type === 'losses' ? limit : Math.floor(limit / 3),
                    offset: type === 'losses' ? offset : 0
                });

                losses.forEach(loss => {
                    activities.push({
                        type: 'loss',
                        id: loss.id,
                        date: loss.loss_date || loss.created_at,
                        description: `Perda de ${loss.product?.name || 'Produto não informado'}`,
                        value: loss.quantity,
                        unit: 'kg',
                        reason: loss.reason,
                        user: loss.user?.username || 'Usuário não informado',
                        details: loss
                    });
                });
            }

            // Ordenar todas as atividades por data
            activities.sort((a, b) => new Date(b.date) - new Date(a.date));

            // Paginação manual para atividades combinadas
            if (type === 'all') {
                const totalActivities = activities.length;
                activities = activities.slice(offset, offset + limit);
                
                res.render('history/index', {
                    title: 'Histórico de Atividades',
                    user: req.user,
                    isAuthenticated: true,
                    activities,
                    currentPage: page,
                    totalPages: Math.ceil(totalActivities / limit),
                    type,
                    startDate,
                    endDate
                });
            } else {
                res.render('history/index', {
                    title: 'Histórico de Atividades',
                    user: req.user,
                    isAuthenticated: true,
                    activities,
                    currentPage: page,
                    totalPages: Math.ceil(activities.length / limit),
                    type,
                    startDate,
                    endDate
                });
            }

        } catch (error) {
            console.error('Erro ao buscar histórico:', error);
            res.status(500).render('error', {
                message: 'Erro interno do servidor ao buscar histórico.',
                user: req.user,
                isAuthenticated: true
            });
        }
    }
};

module.exports = historyController;