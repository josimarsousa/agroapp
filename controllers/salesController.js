// controllers/salesController.js

const { Sale, SaleItem, Product, Customer, User, sequelize,} = require('../models')
const { Op, fn, col, literal } = require('sequelize');
const PDFDocument = require('pdfkit'); // <-- MANTENHA APENAS ESTA IMPORTAÇÃO PARA PDFKIT
const fs = require('fs');
const path = require('path');

// Renderiza a página de relatórios de vendas
exports.getSalesReportsPage = async (req, res) => {
    try {
        res.render('sales/reports', {
            title: 'Relatórios de Vendas',
            isAuthenticated: res.locals.isAuthenticated,
            user: res.locals.user,
            successMessage: req.flash('success'),
            errorMessage: req.flash('error')
        });
    } catch (error) {
        console.error('Erro ao carregar a página de relatórios de vendas:', error);
        req.flash('error', 'Erro ao carregar a página de relatórios.');
        res.redirect('/dashboard');
    }
};

// Fornece os dados agregados de vendas para o gráfico
exports.getSalesDataForChart = async (req, res) => {
    try {
        const { period } = req.query; // 'daily', 'monthly', 'yearly'
        let groupByFormat;
        let whereClause = {};

        // Define o formato de agrupamento com base no período
        if (period === 'daily') {
            groupByFormat = fn('DATE', col('Sale.sale_date'));
        } else if (period === 'monthly') {
            groupByFormat = fn('DATE_FORMAT', col('Sale.sale_date'), '%Y-%m');
        } else if (period === 'yearly') {
            groupByFormat = fn('YEAR', col('Sale.sale_date'));
        } else {
            // Padrão para diário se nenhum período for especificado ou for inválido
            groupByFormat = fn('DATE', col('Sale.sale_date'));
            period = 'daily'; // Garante que o período seja 'daily'
        }

        const salesData = await Sale.findAll({
            attributes: [
                [groupByFormat, 'date'], // A data agrupada
                [fn('SUM', col('Sale.total_amount')), 'totalSales'] // Soma do total das vendas
            ],
            where: whereClause, // Por enquanto, sem filtro de data, podemos adicionar depois
            group: ['date'], // Agrupa pelos formatos definidos acima
            order: [[literal('date'), 'ASC']] // Ordena por data ascendente
        });

        // Formata os dados para o Chart.js
        const labels = salesData.map(sale => sale.get('date'));
        const data = salesData.map(sale => sale.get('totalSales'));

        res.json({ labels, data, period });

    } catch (error) {
        console.error('Erro ao buscar dados de vendas para o gráfico:', error);
        res.status(500).json({ message: 'Erro ao buscar dados de vendas.' });
    }
};

exports.getAllSales = async (req, res) => {
    let fetchedSales = [];

    try {
        fetchedSales = await Sale.findAll({
            include: [
                {
                    model: Customer,
                    as: 'customer' // <<< VERIFIQUE ESTE APELIDO AQUI! Deve ser 'customer' (minúsculas)
                },
                {
                    model: User,
                    as: 'user'     // Verifique também este, se o usuário não estiver aparecendo
                }
            ],
            order: [['sale_date', 'DESC']]
        });

        res.render('sales/index', {
            title: 'Histórico de Vendas',
            sales: fetchedSales,
            isAuthenticated: res.locals.isAuthenticated,
            user: res.locals.user,
            successMessage: req.flash('success'),
            errorMessage: req.flash('error')
        });

    } catch (error) {
        console.error('Erro fatal ao buscar histórico de vendas:', error);
        req.flash('error', 'Erro ao carregar o histórico de vendas: ' + error.message);
        res.redirect('/dashboard');
    }
};
// Renderizar a tela de PDV
exports.getPdvPage = async (req, res) => {
    try {
        const customers = await Customer.findAll({ attributes: ['id', 'name'] });
        res.render('sales/pdv', { title: 'Vendas - PDV', customers });
    } catch (error) {
        console.error('Erro ao carregar página de PDV:', error);
        res.status(500).render('error', { message: 'Erro ao carregar página de PDV.' });
    }
};

// Finalizar uma venda (API endpoint)
exports.finalizeSale = async (req, res) => {
    const transaction = await sequelize.transaction(); // Inicia uma transação

    const { customer_id, items } = req.body;
    const user_id = req.user.id;

    if (!items || items.length === 0) {
        await transaction.rollback(); // Rollback antes de sair
        
        // Verifica se é uma requisição AJAX
        if (req.xhr || req.headers.accept.indexOf('json') > -1) {
            return res.status(400).json({
                success: false,
                message: 'Nenhum item na venda. Adicione produtos para finalizar.'
            });
        }
        
        req.flash('error', 'Nenhum item na venda. Adicione produtos para finalizar.');
        return res.redirect('/sales/pdv'); // Redireciona de volta para o PDV
    }

    try {
        let total_amount = 0;
        const saleItemsForCreation = [];

        for (const item of items) {
            const product = await Product.findByPk(item.product_id, { transaction });

            if (!product) {
                await transaction.rollback();
                
                // Verifica se é uma requisição AJAX
                if (req.xhr || req.headers.accept.indexOf('json') > -1) {
                    return res.status(400).json({
                        success: false,
                        message: `Produto com ID ${item.product_id} não encontrado.`
                    });
                }
                
                req.flash('error', `Produto com ID ${item.product_id} não encontrado.`);
                return res.redirect('/sales/pdv'); // Redireciona em caso de erro de produto
            }

            if (product.stock_quantity < item.quantity) {
                await transaction.rollback();
                
                // Verifica se é uma requisição AJAX
                if (req.xhr || req.headers.accept.indexOf('json') > -1) {
                    return res.status(400).json({
                        success: false,
                        message: `Estoque insuficiente para o produto: ${product.name}. Disponível: ${product.stock_quantity}, Solicitado: ${item.quantity}.`
                    });
                }
                
                req.flash('error', `Estoque insuficiente para o produto: ${product.name}. Disponível: ${product.stock_quantity}, Solicitado: ${item.quantity}.`);
                return res.redirect('/sales/pdv'); // Redireciona em caso de estoque insuficiente
            }

            const subtotal = product.price * item.quantity;
            total_amount += subtotal;

            saleItemsForCreation.push({
                product_id: product.id,
                quantity: item.quantity,
                unit_price: product.price,
                subtotal: subtotal
            });

            // Atualizar estoque do produto
            product.stock_quantity -= item.quantity;
            await product.save({ transaction });
        }

        const newSale = await Sale.create({
            customer_id: customer_id || null,
            user_id: user_id,
            total_amount: total_amount,
            status: 'finalizada'
        }, { transaction });

        saleItemsForCreation.forEach(item => {
            item.sale_id = newSale.id;
        });

        await SaleItem.bulkCreate(saleItemsForCreation, { transaction });

        await transaction.commit(); // Confirma a transação APENAS AQUI

        return res.status(200).json({
            success: true,
            message: 'Venda finalizada com sucesso!',
            saleId: newSale.id,
        });


    } catch (error) {
        // Tenta dar rollback APENAS se a transação ainda não foi finalizada.
        if (transaction && !transaction.finished) {
            await transaction.rollback();
        }
        
        console.error('Erro ao finalizar venda:', error);
        
        // Verifica se é uma requisição AJAX
        if (req.xhr || req.headers.accept.indexOf('json') > -1) {
            return res.status(500).json({
                success: false,
                message: 'Erro interno do servidor ao finalizar venda: ' + error.message
            });
        }
        
        req.flash('error', 'Erro ao finalizar venda. Detalhes: ' + error.message);
        return res.redirect('/sales/pdv'); // Redireciona de volta para o PDV em caso de erro
    }
};
// Visualizar detalhes de uma venda
exports.getSaleDetails = async (req, res) => {

    try {

        const saleId = req.params.id; // <<< GARANTA QUE ESTA LINHA ESTÁ PRESENTE E CORRETA

        // Verifica se o ID é válido antes de consultar o banco de dados
        if (!saleId || isNaN(saleId)) {
            console.error('ID da venda inválido:', saleId);
            req.flash('error', 'ID da venda inválido.');
            // Redireciona para uma rota segura, sem usar 'sales'
            return res.redirect('/dashboard');
        }

        const sale = await Sale.findByPk(saleId, {
            include: [
                {
                    model: SaleItem,
                    as: 'items', // OK: Sale tem muitos SaleItems, usando alias 'items'
                    include: [{
                        model: Product,
                        as: 'product' // OK: SaleItem pertence a um Product, usando alias 'product'
                    }]
                },
                {
                    model: Customer,
                    as: 'customer' // OK: Sale pertence a um Customer, usando alias 'customer'
                },
                {
                    model: User,
                    as: 'user' // OK: Sale pertence a um User, usando alias 'user'
                }
            ]
        });
        if (!sale) {
            req.flash('error', 'Venda não encontrada.');
            return res.redirect('/sales'); // Redireciona de volta para o histórico, se não encontrar a venda
        }

        res.render('sales/details', {
            title: `Detalhes da Venda #${sale.id}`,
            sale: sale,
            isAuthenticated: res.locals.isAuthenticated,
            user: res.locals.user,
            successMessage: req.flash('success'),
            errorMessage: req.flash('error')
        });
    } catch (error) {
        console.error('Erro ao buscar detalhes da venda:', error);
        req.flash('error', 'Erro ao carregar detalhes da venda: ' + error.message);
        return res.redirect('/sales/pdv');
    }
};

exports.generateSalePdf = async (req, res) => {
    try {
        const saleId = req.params.id;

        const sale = await Sale.findByPk(saleId, {
            include: [
                {
                    model: SaleItem,
                    as: 'items', // <<< ALIAS PARA SALEITEM (DEFINIDO EM Sale.js)
                    include: [{
                        model: Product,
                        as: 'product' // <<< ALIAS PARA PRODUCT (DEFINIDO EM SaleItem.js)
                    }]
                },
                {
                    model: Customer,
                    as: 'customer' // <<< ALIAS PARA CUSTOMER (DEFINIDO EM Sale.js)
                },
                {
                    model: User,
                    as: 'user' // <<< ALIAS PARA USER (DEFINIDO EM Sale.js)
                }
            ]
        });

        if (!sale) {
            req.flash('error', 'Venda nao encontrada para gerar pdf')
            return res.redirect(`/sales/${saleId}`);
            //return res.status(404).send('Venda não encontrada.');
        }

        sale.total_amount = parseFloat(sale.total_amount);
        if (sale.items && sale.items.length > 0) {
            sale.items.forEach(item => {
                item.subtotal = parseFloat(item.subtotal);
                item.unit_price = parseFloat(item.unit_price);
            });
        }

        const doc = new PDFDocument({ 
            size: 'A5',
            margin: 30,
            info: {
                Title: `Comprovante de Venda #${sale.id}`,
                Author: 'agroApp',
                Subject: 'Comprovante de Venda',
                Keywords: 'venda, comprovante, agroapp'
            }
        });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="venda_${sale.id}.pdf"`);

        doc.pipe(res);

        // === CABEÇALHO PROFISSIONAL ===
        const pageWidth = doc.page.width;
        const margin = 30;
        const contentWidth = pageWidth - (margin * 2);
        
        let currentY = margin;

        // Logo/Ícone da empresa (círculo com iniciais)
        doc.circle(margin + 25, currentY + 25, 20)
           .fillAndStroke('#4a7c59', '#2c5530')
           .fontSize(14)
           .font('Helvetica-Bold')
           .fillColor('#ffffff')
           .text('AG', margin + 18, currentY + 18);

        // Nome da empresa e informações
        doc.fillColor('#000000')
           .fontSize(18)
           .font('Helvetica-Bold')
           .text('AGROAPP', margin + 60, currentY + 5);

        doc.fontSize(10)
           .font('Helvetica')
           .fillColor('#666666')
           .text('Sistema de Gestão Agrícola', margin + 60, currentY + 25)
           .text('contato@agroapp.com | (37) 99961-3950', margin + 60, currentY + 40);

        currentY += 80;

        // Linha separadora
        doc.moveTo(margin, currentY)
           .lineTo(margin + contentWidth, currentY)
           .stroke('#000000');

        currentY += 15;
        
        // Título do documento (mais compacto)
        doc.fontSize(14)
           .font('Helvetica-Bold')
           .text('COMPROVANTE DE VENDA', margin, currentY, { align: 'center' });
        
        doc.fontSize(8)
           .font('Helvetica')
           .fillColor('#666666')
           .text('(Não é cupom fiscal)', margin, currentY + 18, { align: 'center' });

        doc.fillColor('#000000');
        currentY += 40;

        // Caixa com informações da venda (mais compacta)
        doc.rect(margin, currentY, contentWidth, 60)
           .stroke('#cccccc')
           .lineWidth(1);

        currentY += 10;

        // Informações em duas colunas (mais compactas)
        const leftColX = margin + 15;
        const rightColX = margin + (contentWidth / 2) + 10;

        doc.fontSize(10)
           .font('Helvetica-Bold')
           .text(`Venda #${sale.id}`, leftColX, currentY);

        doc.fontSize(8)
           .font('Helvetica')
           .text(`Data: ${new Date(sale.sale_date).toLocaleDateString('pt-BR')}`, leftColX, currentY + 15)
           .text(`Operador: ${sale.user ? sale.user.username : 'N/A'}`, leftColX, currentY + 28);

        // Dados do cliente (lado direito, mais compacto)
        doc.fontSize(9)
           .font('Helvetica-Bold')
           .text('Cliente:', rightColX, currentY);

        if (sale.customer) {
            doc.fontSize(8)
               .font('Helvetica')
               .text(`${sale.customer.name}`, rightColX, currentY + 12)
               .text(`${sale.customer.email || 'Email não informado'}`, rightColX, currentY + 24)
               .text(`${sale.customer.phone || 'Tel. não informado'}`, rightColX, currentY + 36);
        } else {
            doc.fontSize(8)
               .font('Helvetica')
               .text('Cliente Avulso', rightColX, currentY + 12);
        }

        currentY += 75;

        // === TABELA DE ITENS COMPACTA ===
        doc.fontSize(11)
           .font('Helvetica-Bold')
           .text('Itens da Venda', margin, currentY);

        currentY += 20;

        // Cabeçalho da tabela (mais compacto)
        const tableTop = currentY;
        const productNameX = margin;
        const qtyX = margin + 160;
        const unitPriceX = margin + 210;
        const subtotalX = margin + 280;

        // Fundo do cabeçalho da tabela
        doc.rect(margin, tableTop - 3, contentWidth, 18)
           .fill('#f8f9fa')
           .stroke('#dee2e6');

        doc.fillColor('#000000')
           .fontSize(9)
           .font('Helvetica-Bold')
           .text('Produto', productNameX + 5, tableTop + 3)
           .text('Qtd', qtyX, tableTop + 3)
           .text('Preço', unitPriceX, tableTop + 3)
           .text('Subtotal', subtotalX, tableTop + 3);

        currentY = tableTop + 20;

        // Itens da venda (mais compactos)
        doc.font('Helvetica')
           .fontSize(8);

        sale.items.forEach((item, index) => {
            // Linha alternada
            if (index % 2 === 0) {
                doc.rect(margin, currentY - 3, contentWidth, 15)
                   .fill('#f8f9fa')
                   .stroke();
            }

            // Truncar nome do produto se muito longo
            const productName = item.product ? item.product.name : 'Produto Removido';
            const truncatedName = productName.length > 20 ? productName.substring(0, 20) + '...' : productName;

            doc.fillColor('#000000')
               .text(truncatedName, productNameX + 5, currentY)
               .text(item.quantity.toString(), qtyX, currentY)
               .text(`R$ ${item.unit_price.toFixed(2).replace('.', ',')}`, unitPriceX, currentY)
               .text(`R$ ${item.subtotal.toFixed(2).replace('.', ',')}`, subtotalX, currentY);

            currentY += 15;
        });

        // Linha de separação
        doc.moveTo(margin, currentY + 5)
           .lineTo(margin + contentWidth, currentY + 5)
           .stroke('#cccccc');

        currentY += 15;

        // === TOTAL COMPACTO ===
        doc.rect(margin + contentWidth - 150, currentY, 150, 30)
           .fill('#2c5530')
           .stroke();

        doc.fontSize(12)
           .font('Helvetica-Bold')
           .fillColor('#ffffff')
           .text(`TOTAL: R$ ${sale.total_amount.toFixed(2).replace('.', ',')}`, 
                  margin + contentWidth - 140, currentY + 8);

        currentY += 50;

        // === RODAPÉ COMPACTO ===
        doc.fillColor('#000000')
           .fontSize(10)
           .font('Helvetica-Bold')
           .text('Obrigado pela sua compra!', margin, currentY, { align: 'center' });

        doc.fontSize(8)
           .font('Helvetica')
           .fillColor('#666666')
           .text('Documento gerado automaticamente pelo agroApp', margin, currentY + 15, { align: 'center' })
           .text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, margin, currentY + 27, { align: 'center' });

        // Linha decorativa no rodapé
        doc.rect(margin, doc.page.height - margin - 25, contentWidth, 1)
           .fill('#4a7c59');

        doc.fontSize(7)
           .fillColor('#999999')
           .text('agroApp - Sistema de Gestão Agrícola', 
                  margin, doc.page.height - margin - 15, { align: 'center' });

        doc.end();

    } catch (error) {
        console.error('Erro ao gerar PDF da venda:', error);
        res.status(500).send('Erro ao gerar o PDF da venda. Detalhes: ' + error.message);
    }
};