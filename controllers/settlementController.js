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
        
        // === Geração de PDF com PDFKit (padrão dos demais relatórios) ===
        const doc = new PDFDocument({ 
            size: 'A4',
            margin: 40,
            info: {
                Title: 'Relatório de Acerto',
                Author: 'agroApp',
                Subject: 'Relatório de Acerto',
                Keywords: 'acerto, relatório, agroapp'
            }
        });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="relatorio_acerto_${Date.now()}.pdf"`);
        doc.pipe(res);

        const startDateFormatted = new Date(start_date + 'T00:00:00').toLocaleDateString('pt-BR');
        const endDateFormatted = new Date(end_date + 'T00:00:00').toLocaleDateString('pt-BR');
        const periodText = `Período: ${startDateFormatted} até ${endDateFormatted}`;

        // === Cabeçalho no padrão do comprovante de venda ===
        const pageWidth = doc.page.width;
        const margin = doc.page.margins.left;
        const contentWidth = pageWidth - (doc.page.margins.left + doc.page.margins.right);
        let currentY = doc.page.margins.top;

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

        // Título do documento (compacto)
        doc.fontSize(14)
           .font('Helvetica-Bold')
           .fillColor('#000000')
           .text('RELATÓRIO DE ACERTO', margin, currentY, { align: 'center' });

        // Período abaixo do título
        doc.fontSize(9)
           .font('Helvetica')
           .fillColor('#333333')
           .text(periodText, margin, currentY + 18, { align: 'center' });

        // Posicionar cursor abaixo do cabeçalho
        const afterHeaderY = currentY + 45;
        doc.y = afterHeaderY;
        doc.moveDown();

        // === Caixa de resumo (padrão similar ao comprovante de venda) ===
        const summaryBoxTop = doc.y;
        doc.rect(margin, summaryBoxTop, contentWidth, 60)
           .stroke('#cccccc')
           .lineWidth(1);
        const leftColX = margin + 15;
        const rightColX = margin + (contentWidth / 2) + 10;

        doc.fontSize(10)
           .font('Helvetica-Bold')
           .text('Totais do Período', leftColX, summaryBoxTop + 10);

        doc.fontSize(8)
           .font('Helvetica')
           .text(`Vendas: R$ ${summary.totalSales.toFixed(2).replace('.', ',')}`, leftColX, summaryBoxTop + 25)
           .text(`Perdas: R$ ${summary.totalLosses.toFixed(2).replace('.', ',')}`, leftColX, summaryBoxTop + 38);

        doc.fontSize(10)
           .font('Helvetica-Bold')
           .text('Resultado', rightColX, summaryBoxTop + 10);

        doc.fontSize(8)
           .font('Helvetica')
           .text(`Líquido: R$ ${summary.netResult.toFixed(2).replace('.', ',')}`, rightColX, summaryBoxTop + 25)
           .text(`Margem: ${summary.profitMargin.toFixed(2).replace('.', ',')}%`, rightColX, summaryBoxTop + 38);

        doc.y = summaryBoxTop + 75;

        // Tabela com padrão visual consistente
        const table = { headers: [], rows: [] };

        table.headers = ['Produto', 'Qtd. Vendida', 'Valor Vendas', 'Qtd. Perdida', 'Valor Perdas', 'Resultado Líquido'];

        const productNames = Object.keys(productSummary);
        if (productNames.length === 0) {
            table.rows.push(['Nenhum dado encontrado para o período.', '', '', '', '', '']);
        } else {
            productNames.forEach(productName => {
                const p = productSummary[productName];
                const net = p.salesAmount - p.lossValue;
                table.rows.push([
                    productName,
                    (p.salesQuantity || 0).toFixed(2).replace('.', ','),
                    `R$ ${(p.salesAmount || 0).toFixed(2).replace('.', ',')}`,
                    (p.lossQuantity || 0).toFixed(2).replace('.', ','),
                    `R$ ${(p.lossValue || 0).toFixed(2).replace('.', ',')}`,
                    `R$ ${net.toFixed(2).replace('.', ',')}`
                ]);
            });
        }

        let y = doc.y;
        const startX = doc.x;
        const tableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
        if (isNaN(tableWidth) || tableWidth <= 0) {
            throw new Error('Erro crítico: Largura da tabela inválida calculada: ' + tableWidth);
        }

        // Larguras proporcionais das colunas (6 colunas)
        const colWidths = [
            tableWidth * 0.30, // Produto
            tableWidth * 0.12, // Qtd. Vendida
            tableWidth * 0.16, // Valor Vendas
            tableWidth * 0.12, // Qtd. Perdida
            tableWidth * 0.16, // Valor Perdas
            tableWidth * 0.14  // Resultado Líquido
        ];
        if (colWidths.some(isNaN) || colWidths.some(w => w <= 0)) {
            throw new Error('Erro crítico: Uma das larguras de coluna é NaN ou menor/igual a zero.');
        }

        // Cabeçalho da tabela com fundo (padrão venda)
        const headerY = y;
        doc.rect(doc.page.margins.left, headerY - 3, tableWidth, 18)
           .fill('#f8f9fa')
           .stroke('#dee2e6');
        
        doc.fillColor('#000000').fontSize(9).font('Helvetica-Bold');
        let currentX = startX;
        table.headers.forEach((header, i) => {
            doc.text(header, currentX + 5, headerY + 3, { width: colWidths[i] - 5, align: 'left' });
            currentX += colWidths[i];
        });
        
        y = headerY + 20;
        doc.y = y;

        // Corpo da tabela
        const tableBodyFontSize = 8;
        doc.fontSize(tableBodyFontSize).font('Helvetica');

        table.rows.forEach((row, rowIndex) => {
            let rowHeight = 0;

            // Calcula a altura necessária para a linha
            row.forEach((cellText, colIndex) => {
                const width = colWidths[colIndex];
                const text = String(cellText);
                let textHeight = doc.heightOfString(text, { width });
                if (typeof textHeight !== 'number' || isNaN(textHeight) || textHeight < 0) {
                    textHeight = tableBodyFontSize * 1.2;
                }
                rowHeight = Math.max(rowHeight, textHeight);
            });
            if (typeof rowHeight !== 'number' || isNaN(rowHeight) || rowHeight <= 0) {
                rowHeight = tableBodyFontSize * 1.5;
            }

            // Espaçamento vertical baseado na altura calculada
            let calculatedMoveDownValue;
            try {
                calculatedMoveDownValue = rowHeight / tableBodyFontSize * 1.2;
                if (isNaN(calculatedMoveDownValue) || calculatedMoveDownValue <= 0) {
                    calculatedMoveDownValue = tableBodyFontSize * 1.5;
                }
            } catch (calcError) {
                calculatedMoveDownValue = tableBodyFontSize * 1.5;
            }

            // Quebra de página se necessário
            if (y + rowHeight + 10 > doc.page.height - doc.page.margins.bottom) {
                doc.addPage();
                y = doc.y;

                // Redesenhar cabeçalho com fundo (padrão venda)
                const headerY2 = y;
                doc.rect(doc.page.margins.left, headerY2 - 3, tableWidth, 18)
                   .fill('#f8f9fa')
                   .stroke('#dee2e6');

                doc.fillColor('#000000').fontSize(9).font('Helvetica-Bold');
                currentX = startX;
                table.headers.forEach((header, i) => {
                    doc.text(header, currentX + 5, headerY2 + 3, { width: colWidths[i] - 5, align: 'left' });
                    currentX += colWidths[i];
                });
                y = headerY2 + 20;
                doc.y = y;
                doc.fontSize(tableBodyFontSize).font('Helvetica');
            }

            // Linhas alternadas com fundo (padrão venda)
            if (rowIndex % 2 === 0) {
                doc.rect(doc.page.margins.left, y - 3, tableWidth, rowHeight + 6)
                   .fill('#f8f9fa')
                   .stroke();
                doc.fillColor('#000000');
            }

            // Desenha a linha
            currentX = startX;
            row.forEach((cellText, i) => {
                const width = colWidths[i];
                const text = String(cellText);
                doc.text(text, currentX + 5, y, { width: width - 5, align: 'left' });
                currentX += width;
            });
            doc.moveDown(calculatedMoveDownValue);
            y = doc.y;

            // Linha separadora entre linhas
            doc.lineWidth(0.2);
            doc.strokeColor('#eeeeee');
            doc.moveTo(doc.page.margins.left, y).lineTo(doc.page.width - doc.page.margins.right, y).stroke();
            doc.moveDown(0.5);
            y = doc.y;
        });

        doc.end();
    } catch (error) {
        console.error('Erro ao gerar PDF:', error);
        res.status(500).json({ error: 'Erro ao gerar PDF' });
    }
};