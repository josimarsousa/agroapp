// seeders/demo-data.js
const { Sale, Harvest, Loss, Product, Category, User, Customer, SaleItem } = require('../models');

async function createDemoData() {
    try {
        console.log('Criando dados de demonstração...');

        // Verificar se já existem dados
        const existingSales = await Sale.count();
        if (existingSales > 0) {
            console.log('Dados já existem. Pulando criação de dados de demonstração.');
            return;
        }

        // Buscar usuário, produtos e categorias existentes
        const user = await User.findOne();
        const products = await Product.findAll({ limit: 5 });
        const categories = await Category.findAll({ limit: 3 });
        const customers = await Customer.findAll({ limit: 3 });

        if (!user || products.length === 0) {
            console.log('Usuários ou produtos não encontrados. Criando dados básicos primeiro.');
            return;
        }

        // Criar dados dos últimos 12 meses
        const now = new Date();
        const salesData = [];
        const harvestsData = [];
        const lossesData = [];

        for (let i = 11; i >= 0; i--) {
            const date = new Date(now.getFullYear(), now.getMonth() - i, Math.floor(Math.random() * 28) + 1);
            
            // Criar vendas
            for (let j = 0; j < Math.floor(Math.random() * 5) + 1; j++) {
                const product = products[Math.floor(Math.random() * products.length)];
                const customer = customers[Math.floor(Math.random() * customers.length)];
                const quantity = Math.floor(Math.random() * 10) + 1;
                const unitPrice = parseFloat((Math.random() * 50 + 10).toFixed(2));
                const totalAmount = quantity * unitPrice;

                const sale = await Sale.create({
                    customer_id: customer ? customer.id : null,
                    user_id: user.id,
                    total_amount: totalAmount,
                    sale_date: date
                });

                await SaleItem.create({
                    sale_id: sale.id,
                    product_id: product.id,
                    quantity: quantity,
                    unit_price: unitPrice,
                    subtotal: totalAmount
                });
            }

            // Criar colheitas
            for (let j = 0; j < Math.floor(Math.random() * 3) + 1; j++) {
                const product = products[Math.floor(Math.random() * products.length)];
                const category = categories[Math.floor(Math.random() * categories.length)];
                const quantity = parseFloat((Math.random() * 100 + 10).toFixed(2));

                await Harvest.create({
                    product_id: product.id,
                    quantity: quantity,
                    category_id: category ? category.id : null,
                    user_id: user.id,
                    harvest_date: date
                });
            }

            // Criar perdas
            for (let j = 0; j < Math.floor(Math.random() * 2) + 1; j++) {
                const product = products[Math.floor(Math.random() * products.length)];
                const category = categories[Math.floor(Math.random() * categories.length)];
                const quantity = parseFloat((Math.random() * 20 + 1).toFixed(2));

                await Loss.create({
                    product_id: product.id,
                    quantity: quantity,
                    category_id: category ? category.id : null,
                    user_id: user.id,
                    loss_date: date,
                    reason: ['Pragas', 'Clima', 'Transporte', 'Armazenamento'][Math.floor(Math.random() * 4)]
                });
            }
        }

        console.log('Dados de demonstração criados com sucesso!');
    } catch (error) {
        console.error('Erro ao criar dados de demonstração:', error);
    }
}

module.exports = { createDemoData };