// controllers/settlementController.js
const { Sale, SaleItem, Loss, Product, Category, User, Customer } = require('../models');
const { Op, Sequelize } = require('sequelize');
const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');

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
        
        // Gerar HTML para o PDF
        const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Relatório de Acerto - ${start_date} a ${end_date}</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 20px; }
                .header { text-align: center; margin-bottom: 30px; }
                .summary-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-bottom: 30px; }
                .summary-item { padding: 15px; border: 1px solid #ddd; border-radius: 5px; text-align: center; }
                .summary-item.positive { background-color: #d4edda; border-color: #c3e6cb; }
                .summary-item.negative { background-color: #f8d7da; border-color: #f5c6cb; }
                .summary-item h3 { margin: 0 0 10px 0; font-size: 14px; color: #666; }
                .summary-item .value { font-size: 24px; font-weight: bold; margin: 0; }
                table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
                th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
                th { background-color: #f8f9fa; font-weight: bold; }
                .section-title { font-size: 18px; font-weight: bold; margin: 30px 0 15px 0; }
                .period { text-align: center; color: #666; margin-bottom: 20px; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>Relatório de Acerto de Contas</h1>
                <div class="period">Período: ${new Date(start_date).toLocaleDateString('pt-BR')} a ${new Date(end_date).toLocaleDateString('pt-BR')}</div>
            </div>
            
            <div class="summary-grid">
                <div class="summary-item">
                    <h3>Total de Vendas</h3>
                    <p class="value">R$ ${summary.totalSales.toFixed(2).replace('.', ',')}</p>
                </div>
                <div class="summary-item">
                    <h3>Total de Perdas</h3>
                    <p class="value">R$ ${summary.totalLosses.toFixed(2).replace('.', ',')}</p>
                </div>
                <div class="summary-item ${summary.netResult >= 0 ? 'positive' : 'negative'}">
                    <h3>Resultado Líquido</h3>
                    <p class="value">R$ ${summary.netResult.toFixed(2).replace('.', ',')}</p>
                </div>
                <div class="summary-item ${summary.profitMargin >= 0 ? 'positive' : 'negative'}">
                    <h3>Margem de Lucro</h3>
                    <p class="value">${summary.profitMargin.toFixed(1).replace('.', ',')}%</p>
                </div>
            </div>
            
            <div class="section-title">Resumo Total por Produto</div>
            <table>
                <thead>
                    <tr>
                        <th>Produto</th>
                        <th>Qtd. Vendida</th>
                        <th>Valor Vendas</th>
                        <th>Qtd. Perdida</th>
                        <th>Valor Perdas</th>
                        <th>Resultado Líquido</th>
                    </tr>
                </thead>
                <tbody>
                    ${Object.keys(productSummary).map(productName => {
                        const product = productSummary[productName];
                        const netResult = product.salesAmount - product.lossValue;
                        return `
                        <tr>
                            <td>${productName}</td>
                            <td>${product.salesQuantity.toFixed(2).replace('.', ',')}</td>
                            <td>R$ ${product.salesAmount.toFixed(2).replace('.', ',')}</td>
                            <td>${product.lossQuantity.toFixed(2).replace('.', ',')}</td>
                            <td>R$ ${product.lossValue.toFixed(2).replace('.', ',')}</td>
                            <td style="color: ${netResult >= 0 ? 'green' : 'red'}; font-weight: bold;">
                                R$ ${netResult.toFixed(2).replace('.', ',')}
                            </td>
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>
        </body>
        </html>
        `;
        
        // Gerar PDF com Puppeteer (compatível com Vercel/Railway e fallback local)
        const isLinux = process.platform === 'linux';
        const customExecPath = process.env.CHROME_EXECUTABLE_PATH || process.env.PUPPETEER_EXECUTABLE_PATH;
        let execPath;
        if (customExecPath) {
            execPath = customExecPath;
        } else if (isLinux) {
            execPath = await chromium.executablePath();
        } else {
            // Fallback para ambientes locais (macOS/Windows)
            execPath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
            if (process.platform === 'win32') {
                execPath = 'C\\\:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
            }
        }
        if (process.env.DEBUG_PDF === 'true') {
            console.log('Puppeteer executablePath:', execPath);
        }
        const browser = await puppeteer.launch({
            args: [...chromium.args, '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
            defaultViewport: chromium.defaultViewport,
            executablePath: execPath,
            headless: true,
        });
        const page = await browser.newPage();
        await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
        
        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: {
                top: '20px',
                right: '20px',
                bottom: '20px',
                left: '20px'
            }
        });
        
        await browser.close();
        
        // Enviar PDF como resposta
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="relatorio-acerto-${start_date}-${end_date}.pdf"`);
        res.send(pdfBuffer);
        
    } catch (error) {
        console.error('Erro ao gerar PDF:', error && error.stack ? error.stack : error);
        if (process.env.DEBUG_PDF === 'true') {
            return res.status(500).json({ error: 'Erro ao gerar PDF', detail: error.message || String(error) });
        }
        return res.status(500).json({ error: 'Erro ao gerar PDF' });
    }
};