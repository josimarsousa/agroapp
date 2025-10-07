// controllers/settlementController.js
const { Sale, SaleItem, Loss, Product, Category, User, Customer } = require('../models');
const { Op, Sequelize } = require('sequelize');
const PDFDocument = require('pdfkit');
const fs = require('fs');

// Exibir filtros
exports.settlementView = async (req, res) => {
    try {
        let { start_date, end_date } = req.query;
        let salesData = null;
        let lossesData = null;
        let summary = {
            totalSalesAmount: 0,
            totalLossesValue: 0,
            netResult: 0,
            profitMargin: 0
        };
        
        // Se há filtros de data, buscar os dados
        if (start_date || end_date) {
            let whereClause = {};
            
            // Construir cláusula WHERE para o período
            if (start_date) {
                const parsedStartDate = new Date(start_date + 'T00:00:00');
                whereClause.createdAt = {
                    [Op.gte]: parsedStartDate
                };
            }
            
            if (end_date) {
                const parsedEndDate = new Date(end_date + 'T00:00:00');
                parsedEndDate.setDate(parsedEndDate.getDate() + 1);
                
                if (whereClause.createdAt) {
                    whereClause.createdAt[Op.lt] = parsedEndDate;
                } else {
                    whereClause.createdAt = {
                        [Op.lt]: parsedEndDate
                    };
                }
            }
            
            // Buscar vendas do período com itens
            const sales = await Sale.findAll({
                where: {
                    sale_date: whereClause.createdAt || {}
                },
                include: [
                    {
                        model: SaleItem,
                        as: 'items',
                        include: [{
                            model: Product,
                            as: 'product'
                        }]
                    },
                    {
                        model: Customer,
                        as: 'customer',
                        required: false
                    }
                ],
                order: [['sale_date', 'DESC']]
            });
            
            // Buscar perdas do período
            const losses = await Loss.findAll({
                where: {
                    loss_date: whereClause.createdAt || {}
                },
                include: [{
                    model: Product,
                    as: 'product',
                    include: [{
                        model: Category,
                        as: 'category',
                        required: false
                    }]
                }],
                order: [['loss_date', 'DESC']]
            });
            
            // Processar dados das vendas
            salesData = {
                sales: sales,
                totalAmount: sales.reduce((sum, sale) => sum + parseFloat(sale.total_amount || 0), 0),
                totalQuantity: sales.reduce((sum, sale) => {
                    return sum + sale.items.reduce((itemSum, item) => itemSum + parseInt(item.quantity || 0), 0);
                }, 0),
                byProduct: {}
            };

            // Agrupar vendas por produto
            sales.forEach(sale => {
                sale.items.forEach(item => {
                    const productName = item.product ? item.product.name : 'Produto não encontrado';
                    if (!salesData.byProduct[productName]) {
                        salesData.byProduct[productName] = {
                            quantity: 0,
                            amount: 0
                        };
                    }
                    salesData.byProduct[productName].quantity += parseInt(item.quantity || 0);
                    salesData.byProduct[productName].amount += parseFloat(item.subtotal || 0);
                });
            });

            // Processar dados das perdas
            lossesData = {
                losses: losses,
                totalQuantity: losses.reduce((sum, loss) => sum + parseFloat(loss.quantity || 0), 0),
                totalValue: losses.reduce((sum, loss) => {
                    const quantity = parseFloat(loss.quantity || 0);
                    if (loss.product && loss.product.price) {
                        return sum + (quantity * parseFloat(loss.product.price));
                    }
                    return sum;
                }, 0),
                byProduct: {}
            };

            // Agrupar perdas por produto
            losses.forEach(loss => {
                const quantity = parseFloat(loss.quantity || 0);
                const productName = loss.product ? loss.product.name : 'Produto não encontrado';
                if (!lossesData.byProduct[productName]) {
                    lossesData.byProduct[productName] = {
                        quantity: 0,
                        estimatedValue: 0
                    };
                }
                lossesData.byProduct[productName].quantity += quantity;
                
                if (loss.product && loss.product.price) {
                    const estimatedValue = quantity * parseFloat(loss.product.price);
                    lossesData.byProduct[productName].estimatedValue += estimatedValue;
                }
            });
            
            // Calcular resumo geral
            summary = {
                totalSalesAmount: salesData.totalAmount,
                totalLossesValue: lossesData.totalValue,
                netResult: salesData.totalAmount - lossesData.totalValue,
                profitMargin: salesData.totalAmount > 0 ? ((salesData.totalAmount - lossesData.totalValue) / salesData.totalAmount) * 100 : 0
            };
        }
        
        res.render('settlement/index', {
            salesData,
            lossesData,
            summary,
            start_date: start_date || '',
            end_date: end_date || '',
            messages: req.flash()
        });
        
    } catch (error) {
        console.error('Erro ao carregar view de acerto:', error);
        req.flash('error', 'Erro ao carregar dados do acerto.');
        res.redirect('/dashboard');
    }
};

// Exportar relatório de acerto para PDF
exports.exportSettlementPDF = async (req, res) => {
    try {
        const { start_date, end_date } = req.query;
        
        if (!start_date || !end_date) {
            return res.status(400).json({ error: 'Datas de início e fim são obrigatórias' });
        }
        
        // Usar a mesma lógica de filtro da função settlementView
        let whereClause = {};
        
        // Construir cláusula WHERE para o período
        if (start_date) {
            const parsedStartDate = new Date(start_date + 'T00:00:00');
            whereClause.createdAt = {
                [Op.gte]: parsedStartDate
            };
        }
        
        if (end_date) {
            const parsedEndDate = new Date(end_date + 'T00:00:00');
            parsedEndDate.setDate(parsedEndDate.getDate() + 1);
            
            if (whereClause.createdAt) {
                whereClause.createdAt[Op.lt] = parsedEndDate;
            } else {
                whereClause.createdAt = {
                    [Op.lt]: parsedEndDate
                };
            }
        }
        
        let salesData = { sales: [], totalAmount: 0, byProduct: {} };
        let lossesData = { losses: [], totalValue: 0, byProduct: {} };
        
        // Buscar vendas do período com itens
        const sales = await Sale.findAll({
            where: {
                sale_date: whereClause.createdAt || {}
            },
            include: [
                {
                    model: SaleItem,
                    as: 'items',
                    include: [
                        {
                            model: Product,
                            as: 'product'
                        }
                    ]
                },
                {
                    model: Customer,
                    as: 'customer'
                }
            ]
        });
        
        // Buscar perdas do período
        const losses = await Loss.findAll({
            where: whereClause,
            include: [
                {
                    model: Product,
                    as: 'product',
                    include: [
                        {
                            model: Category,
                            as: 'category'
                        }
                    ]
                }
            ]
        });
        
        // Processar dados de vendas
        salesData = {
            sales: sales,
            totalAmount: 0,
            byProduct: {}
        };
        
        sales.forEach(sale => {
            salesData.totalAmount += parseFloat(sale.total_amount);
            
            sale.items.forEach(item => {
                const productName = item.product ? item.product.name : 'Produto não encontrado';
                if (!salesData.byProduct[productName]) {
                    salesData.byProduct[productName] = {
                        quantity: 0,
                        amount: 0
                    };
                }
                salesData.byProduct[productName].quantity += parseFloat(item.quantity);
                salesData.byProduct[productName].amount += parseFloat(item.subtotal);
            });
        });
        
        // Processar dados de perdas
        lossesData = {
            losses: losses,
            totalValue: 0,
            byProduct: {}
        };
        
        losses.forEach(loss => {
            const productPrice = loss.product ? parseFloat(loss.product.price) : 0;
            const lossValue = parseFloat(loss.quantity) * productPrice;
            lossesData.totalValue += lossValue;
            
            const productName = loss.product ? loss.product.name : 'Produto não encontrado';
            if (!lossesData.byProduct[productName]) {
                lossesData.byProduct[productName] = {
                    quantity: 0,
                    value: 0
                };
            }
            lossesData.byProduct[productName].quantity += parseFloat(loss.quantity);
            lossesData.byProduct[productName].value += lossValue;
        });
        
        // Criar resumo consolidado por produto
        const productSummary = {};
        
        // Adicionar dados de vendas ao resumo consolidado
        Object.keys(salesData.byProduct).forEach(productName => {
            if (!productSummary[productName]) {
                productSummary[productName] = {
                    salesQuantity: 0,
                    salesAmount: 0,
                    lossQuantity: 0,
                    lossValue: 0
                };
            }
            productSummary[productName].salesQuantity = salesData.byProduct[productName].quantity;
            productSummary[productName].salesAmount = salesData.byProduct[productName].amount;
        });
        
        // Adicionar dados de perdas ao resumo consolidado
        Object.keys(lossesData.byProduct).forEach(productName => {
            if (!productSummary[productName]) {
                productSummary[productName] = {
                    salesQuantity: 0,
                    salesAmount: 0,
                    lossQuantity: 0,
                    lossValue: 0
                };
            }
            productSummary[productName].lossQuantity = lossesData.byProduct[productName].quantity;
            productSummary[productName].lossValue = lossesData.byProduct[productName].value;
        });
        
        // Calcular resumo
        const summary = {
            totalSales: salesData.totalAmount,
            totalLosses: lossesData.totalValue,
            netResult: salesData.totalAmount - lossesData.totalValue,
            profitMargin: salesData.totalAmount > 0 ? ((salesData.totalAmount - lossesData.totalValue) / salesData.totalAmount) * 100 : 0
        };
        
        // === Geração de PDF com PDFKit (sem Chromium) ===
        const doc = new PDFDocument({ size: 'A4', margin: 40 });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=\"relatorio-acerto-${start_date}-${end_date}.pdf\"`);
        doc.pipe(res);

        // Cabeçalho
        doc.fontSize(18).font('Helvetica-Bold').text('Relatório de Acerto de Contas', { align: 'center' });
        doc.moveDown(0.3);
        doc.fontSize(11).font('Helvetica').text(`Período: ${new Date(start_date).toLocaleDateString('pt-BR')} a ${new Date(end_date).toLocaleDateString('pt-BR')}`, { align: 'center' });
        doc.moveDown(1);

        // Resumo
        doc.fontSize(12).font('Helvetica-Bold').text('Resumo');
        doc.moveDown(0.2);
        const resumo = [
            [`Total de Vendas`, `R$ ${summary.totalSales.toFixed(2).replace('.', ',')}`],
            [`Total de Perdas`, `R$ ${summary.totalLosses.toFixed(2).replace('.', ',')}`],
            [`Resultado Líquido`, `R$ ${summary.netResult.toFixed(2).replace('.', ',')}`],
            [`Margem de Lucro`, `${summary.profitMargin.toFixed(1).replace('.', ',')}%`]
        ];
        doc.fontSize(11).font('Helvetica');
        resumo.forEach(([k, v]) => doc.text(`${k}: ${v}`));
        doc.moveDown(0.8);

        // Título da tabela
        doc.fontSize(12).font('Helvetica-Bold').text('Resumo Total por Produto');
        doc.moveDown(0.4);

        // Cabeçalhos simples
        doc.font('Helvetica-Bold').fontSize(10);
        doc.text('Produto | Qtd. Vendida | Valor Vendas | Qtd. Perdida | Valor Perdas | Resultado Líquido');
        doc.moveDown(0.2);
        doc.font('Helvetica').fontSize(10);

        const productNames = Object.keys(productSummary);
        if (productNames.length === 0) {
            doc.text('Nenhum dado encontrado para o período.');
        } else {
            productNames.forEach(productName => {
                const p = productSummary[productName];
                const net = p.salesAmount - p.lossValue;
                const line = [
                    productName,
                    p.salesQuantity.toFixed(2).replace('.', ','),
                    `R$ ${p.salesAmount.toFixed(2).replace('.', ',')}`,
                    p.lossQuantity.toFixed(2).replace('.', ','),
                    `R$ ${p.lossValue.toFixed(2).replace('.', ',')}`,
                    `R$ ${net.toFixed(2).replace('.', ',')}`
                ].join(' | ');
                doc.text(line);
            });
        }

        doc.end();
    } catch (error) {
        console.error('Erro ao gerar PDF:', error);
        res.status(500).json({ error: 'Erro ao gerar PDF' });
    }
};