

const { Harvest, Product, Category, User } = require('../models'); // Importa os modelos necessários
const { Op, Sequelize } = require('sequelize');
const PDFDocument = require('pdfkit');

// Função para exibir o formulário de nova colheita
exports.newHarvestForm = async (req, res) => {
    try {
        // Busca todos os produtos e categorias para preencher os selects do formulário
        const products = await Product.findAll({ order: [['name', 'ASC']] });
        const categories = await Category.findAll({ order: [['name', 'ASC']] });

        res.render('harvests/new', { // Renderiza a view 'new.ejs' dentro da pasta 'views/harvests/'
            title: 'Registrar Nova Colheita',
            products: products,
            categories: categories,
            error: req.flash('error'), // Para exibir mensagens de erro
            success: req.flash('success') // Para exibir mensagens de sucesso
        });
    } catch (error) {
        console.error('Erro ao carregar formulário de nova colheita:', error);
        req.flash('error', 'Não foi possível carregar o formulário de colheita.');
        res.redirect('/'); // Redireciona para a página inicial ou outra página de erro
    }
};

// Função para registrar uma nova colheita
exports.createHarvest = async (req, res) => {
    const { product_id, quantity, category_id } = req.body;
    const user_id = req.user.id; // Assume que o ID do usuário logado está em req.user.id

    try {
        // Validação básica
        if (!product_id || !quantity || !user_id) {
            req.flash('error', 'Produto, quantidade e usuário são obrigatórios.');
            return res.redirect('/harvests/new');
        }

        const harvestQuantity = parseFloat(quantity);
        
        // Validação da quantidade
        if (harvestQuantity <= 0) {
            req.flash('error', 'A quantidade deve ser maior que zero.');
            return res.redirect('/harvests/new');
        }

        // Busca o produto para verificar se existe
        const product = await Product.findByPk(parseInt(product_id));
        if (!product) {
            req.flash('error', 'Produto não encontrado.');
            return res.redirect('/harvests/new');
        }

        // Cria a colheita no banco de dados
        await Harvest.create({
            product_id: parseInt(product_id),
            quantity: harvestQuantity,
            category_id: category_id ? parseInt(category_id) : null, // Categoria pode ser opcional
            user_id: parseInt(user_id)
            // harvest_date será preenchido automaticamente pelo defaultValue: DataTypes.NOW
        });

        // Atualiza o estoque do produto somando a quantidade colhida
        await product.update({
            stock_quantity: product.stock_quantity + harvestQuantity
        });

        req.flash('success', `Colheita registrada com sucesso! Estoque do produto "${product.name}" atualizado para ${product.stock_quantity + harvestQuantity} unidades.`);
        res.redirect('/harvests/new'); // Redireciona de volta para o formulário ou para uma lista de colheitas
    } catch (error) {
        console.error('Erro ao registrar colheita:', error);
        req.flash('error', 'Erro ao registrar colheita. Por favor, tente novamente.');
        res.redirect('/harvests/new');
    }
};

// Função para listar todas as colheitas (futuramente, em uma view separada)
exports.listHarvests = async (req, res) => {
    try {
        let { start_date, end_date } = req.query;
        let harvests;
        let viewTitle = 'Lista de Colheitas'; // Título padrão

        if (start_date || end_date) {
            // Lógica para COLHEITAS AGREGADAS (com filtro de data)
            let dateRangeText = '';
            if (start_date && end_date) {
                const startFormatted = new Date(start_date + 'T00:00:00').toLocaleDateString('pt-BR');
                const endFormatted = new Date(end_date + 'T00:00:00').toLocaleDateString('pt-BR');
                if (start_date === end_date) {
                    dateRangeText = `do dia ${startFormatted}`;
                } else {
                    dateRangeText = `de ${startFormatted} até ${endFormatted}`;
                }
            } else if (start_date) {
                const startFormatted = new Date(start_date + 'T00:00:00').toLocaleDateString('pt-BR');
                dateRangeText = `a partir de ${startFormatted}`;
            } else if (end_date) {
                const endFormatted = new Date(end_date + 'T00:00:00').toLocaleDateString('pt-BR');
                dateRangeText = `até ${endFormatted}`;
            }
            viewTitle = `Colheitas ${dateRangeText}`;
            let whereClause = {};

            if (start_date) {
                const parsedStartDate = new Date(start_date + 'T00:00:00');
                whereClause.harvest_date = {
                    [Op.gte]: parsedStartDate
                };
            }

            if (end_date) {
                const parsedEndDate = new Date(end_date + 'T00:00:00');
                parsedEndDate.setDate(parsedEndDate.getDate() + 1);

                if (whereClause.harvest_date) {
                    whereClause.harvest_date[Op.lt] = parsedEndDate;
                } else {
                    whereClause.harvest_date = {
                        [Op.lt]: parsedEndDate
                    };
                }
            }

            harvests = await Harvest.findAll({
                attributes: [
                    'product_id',
                    'category_id',
                    [Sequelize.fn('SUM', Sequelize.col('quantity')), 'totalQuantity']
                ],
                where: whereClause,
                include: [
                    { model: Product, as: 'product', attributes: ['name'] },
                    { model: Category, as: 'category', attributes: ['name'] },
                ],
                group: ['product_id', 'category_id'],
                order: [[Sequelize.col('totalQuantity'), 'DESC']]
            });

        } else {
            // Lógica para COLHEITAS INDIVIDUAIS (sem filtro de data)
            viewTitle = 'Todas as Colheitas';
            harvests = await Harvest.findAll({
                include: [
                    { model: Product, as: 'product' },
                    { model: Category, as: 'category' },
                    { model: User, as: 'user' }
                ],
                order: [['harvest_date', 'DESC']] // Ordena da mais recente para a mais antiga
            });
        }

        res.render('harvests/list', {
            title: viewTitle, // Passa o título dinâmico
            harvests: harvests,
            start_date: req.query.start_date || '', // Mantém os valores do filtro para a view
            end_date: req.query.end_date || '',
            isAggregatedView: (start_date || end_date), // Nova flag para a view
            error: req.flash('error'),
            success: req.flash('success')
        });
    } catch (error) {
        console.error('Erro ao listar colheitas:', error);
        req.flash('error', 'Erro ao carregar a lista de colheitas: ' + error.message);
        res.redirect('/dashboard');
    }
};

exports.exportHarvestsPdf = async (req, res) => {
    try {
        let { start_date, end_date } = req.query;
        let harvests;
        let reportTitle;
        let isAggregatedView;
        let periodText = '';

        if (start_date || end_date) {
            reportTitle = 'Relatório de Colheitas Agregadas';
            isAggregatedView = true;
            let whereClause = {};

            let startDateFormatted = start_date ? new Date(start_date + 'T00:00:00').toLocaleDateString('pt-BR') : '(início)';
            let endDateFormatted = end_date ? new Date(end_date + 'T00:00:00').toLocaleDateString('pt-BR') : '(fim)';
            periodText = `Período: ${startDateFormatted} até ${endDateFormatted}`;

            if (start_date) {
                const parsedStartDate = new Date(start_date + 'T00:00:00');
                whereClause.harvest_date = {
                    [Op.gte]: parsedStartDate
                };
            }

            if (end_date) {
                const parsedEndDate = new Date(end_date + 'T00:00:00');
                parsedEndDate.setDate(parsedEndDate.getDate() + 1);

                if (whereClause.harvest_date) {
                    whereClause.harvest_date[Op.lt] = parsedEndDate;
                } else {
                    whereClause.harvest_date = {
                        [Op.lt]: parsedEndDate
                    };
                }
            }

            harvests = await Harvest.findAll({
                attributes: [
                    'product_id',
                    'category_id',
                    [Sequelize.fn('SUM', Sequelize.col('quantity')), 'totalQuantity']
                ],
                where: whereClause,
                include: [
                    { model: Product, as: 'product', attributes: ['name'] },
                    { model: Category, as: 'category', attributes: ['name'] },
                ],
                group: ['product_id', 'category_id'],
                order: [[Sequelize.col('totalQuantity'), 'DESC']]
            });

        } else {
            reportTitle = 'Relatório de Todas as Colheitas';
            isAggregatedView = false;
            harvests = await Harvest.findAll({
                include: [
                    { model: Product, as: 'product' },
                    { model: Category, as: 'category' },
                    { model: User, as: 'user' }
                ],
                order: [['harvest_date', 'DESC']]
            });
            periodText = 'Período: Todos os registros';
        }

        const doc = new PDFDocument({ margin: 50 });

        res.setHeader('Content-Type', 'application/pdf');
        // Mude esta linha para 'inline'
        res.setHeader('Content-Disposition', `inline; filename="relatorio_colheitas_${Date.now()}.pdf"`);

        doc.pipe(res);

        doc.fontSize(20).text(reportTitle, { align: 'center' });
        doc.fontSize(12).text(periodText, { align: 'center' });
        doc.moveDown();

        const table = {
            headers: [],
            rows: []
        };

        if (isAggregatedView) {
            table.headers = ['Produto', 'Quantidade Total', 'Categoria'];
            harvests.forEach(h => {
                table.rows.push([
                    h.product ? h.product.name : 'N/A',
                    (h.dataValues.totalQuantity ? parseFloat(h.dataValues.totalQuantity) : 0).toFixed(2),
                    h.category ? h.category.name : 'N/A'
                ]);
            });
        } else {
            table.headers = ['Produto', 'Quantidade', 'Categoria', 'Data da Colheita', 'Registrado por'];
            harvests.forEach(h => {
                table.rows.push([
                    h.product ? h.product.name : 'N/A',
                    (h.quantity ? parseFloat(h.quantity) : 0).toFixed(2),
                    h.category ? h.category.name : 'N/A',
                    new Date(h.harvest_date).toLocaleDateString('pt-BR'),
                    h.user ? h.user.username : 'N/A'
                ]);
            });
        }

        let y = doc.y;
        const startX = doc.x;

        const tableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
        if (isNaN(tableWidth) || tableWidth <= 0) {
            throw new Error('Erro crítico: Largura da tabela inválida calculada: ' + tableWidth);
        }

        let colWidths = [];

        if (isAggregatedView) {
            colWidths = [
                tableWidth * 0.35,
                tableWidth * 0.25,
                tableWidth * 0.4
            ];
        } else {
            colWidths = [
                tableWidth * 0.25,
                tableWidth * 0.15,
                tableWidth * 0.2,
                tableWidth * 0.2,
                tableWidth * 0.2
            ];
        }

        if (colWidths.some(isNaN) || colWidths.some(w => w <= 0)) {
            throw new Error('Erro crítico: Uma das larguras de coluna é NaN ou menor/igual a zero.');
        }

        doc.fontSize(10).font('Helvetica-Bold');
        let currentX = startX;
        table.headers.forEach((header, i) => {
            doc.text(header, currentX, y, { width: colWidths[i], align: 'left' });
            currentX += colWidths[i];
        });
        doc.moveDown();
        y = doc.y;

        doc.lineWidth(0.5);
        doc.strokeColor('#aaaaaa');
        doc.moveTo(doc.page.margins.left, y).lineTo(doc.page.width - doc.page.margins.right, y).stroke();
        doc.moveDown(0.5);
        y = doc.y;

        // Definindo o tamanho da fonte para o corpo da tabela
        const tableBodyFontSize = 9; // Armazenar em uma variável
        doc.fontSize(tableBodyFontSize).font('Helvetica'); // Usar a variável aqui

        table.rows.forEach((row, rowIndex) => {
            let rowHeight = 0;

            row.forEach((cellText, colIndex) => {
                const width = colWidths[colIndex];
                const text = String(cellText);

                let textHeight = doc.heightOfString(text, { width: width });

                if (typeof textHeight !== 'number' || isNaN(textHeight) || textHeight < 0) {
                    console.warn(`[Linha ${rowIndex}, Coluna ${colIndex}] Altura de texto inválida (${textHeight}) para a célula: '${text.substring(0, 100)}...' com largura ${width}. Usando fallback.`);
                    // Usar tableBodyFontSize para fallback, já que doc.fontSize() pode ser o objeto
                    textHeight = tableBodyFontSize * 1.2;
                }

                rowHeight = Math.max(rowHeight, textHeight);
            });

            if (typeof rowHeight !== 'number' || isNaN(rowHeight) || rowHeight <= 0) {
                console.error(`[Linha ${rowIndex}] Altura da linha (rowHeight) inválida ou não-positiva:`, rowHeight, 'para a linha:', row);
                rowHeight = tableBodyFontSize * 1.5; // Usar tableBodyFontSize para fallback
            }

            let calculatedMoveDownValue;
            try {
                // CORREÇÃO AQUI: Usar a variável tableBodyFontSize em vez de doc.fontSize()
                calculatedMoveDownValue = rowHeight / tableBodyFontSize * 1.2;

                if (isNaN(calculatedMoveDownValue)) {
                    console.error(`[Linha ${rowIndex}] O cálculo (rowHeight / ${tableBodyFontSize} * 1.2) resultou em NaN. rowHeight: ${rowHeight}. Forçando valor seguro.`);
                    calculatedMoveDownValue = tableBodyFontSize * 1.5;
                }
                if (calculatedMoveDownValue < 0) {
                    console.error(`[Linha ${rowIndex}] O cálculo resultou em valor negativo: ${calculatedMoveDownValue}. Forçando valor seguro.`);
                    calculatedMoveDownValue = tableBodyFontSize * 1.5;
                }
            } catch (calcError) {
                console.error(`[Linha ${rowIndex}] Erro durante o cálculo de moveDownValue: ${calcError.message}. Forçando valor seguro.`);
                calculatedMoveDownValue = tableBodyFontSize * 1.5;
            }

            if (typeof calculatedMoveDownValue !== 'number' || isNaN(calculatedMoveDownValue) || calculatedMoveDownValue <= 0) {
                throw new Error(`Erro Crítico [Linha ${rowIndex}]: Valor final de moveDown inválido (${calculatedMoveDownValue}). Não foi possível determinar um valor seguro.`);
            }

            if (typeof y !== 'number' || isNaN(y)) {
                throw new Error(`Coordenada 'y' tornou-se NaN antes da verificação de nova página (y: ${y}).`);
            }
            if (y + rowHeight + 10 > doc.page.height - doc.page.margins.bottom) {
                doc.addPage();
                y = doc.y;

                doc.fontSize(10).font('Helvetica-Bold');
                currentX = startX;
                table.headers.forEach((header, i) => {
                    doc.text(header, currentX, y, { width: colWidths[i], align: 'left' });
                    currentX += colWidths[i];
                });
                doc.moveDown();
                y = doc.y;
                doc.lineWidth(0.5).strokeColor('#aaaaaa').moveTo(doc.page.margins.left, y).lineTo(doc.page.width - doc.page.margins.right, y).stroke();
                doc.moveDown(0.5);
                y = doc.y;
                // CORREÇÃO AQUI: Definindo a fonte novamente na nova página usando a variável
                doc.fontSize(tableBodyFontSize).font('Helvetica');
            }

            currentX = startX;
            row.forEach((cellText, i) => {
                const width = colWidths[i];
                const text = String(cellText);
                doc.text(text, currentX, y, { width: width, align: 'left' });
                currentX += width;
            });
            doc.moveDown(calculatedMoveDownValue);
            y = doc.y;

            doc.lineWidth(0.2);
            doc.strokeColor('#eeeeee');
            if (typeof y !== 'number' || isNaN(y)) {
                throw new Error(`Coordenada 'y' é inválida (${y}) antes de desenhar a linha separadora na L337.`);
            }
            doc.moveTo(doc.page.margins.left, y).lineTo(doc.page.width - doc.page.margins.right, y).stroke();
            doc.moveDown(0.5);
            y = doc.y;
        });

        doc.end();

    } catch (error) {
        console.error('Erro DETALHADO ao exportar PDF (bloco catch):', error);
        req.flash('error', 'Ocorreu um erro ao gerar o relatório PDF: ' + error.message);
        res.redirect('/harvests');
    }
};

// Função para exibir o formulário de edição de colheita
exports.editHarvestForm = async (req, res) => {
    try {
        const harvestId = req.params.id;
        
        // Busca a colheita específica
        const harvest = await Harvest.findByPk(harvestId, {
            include: [
                { model: Product, as: 'product' },
                { model: Category, as: 'category' }
            ]
        });

        if (!harvest) {
            req.flash('error', 'Colheita não encontrada.');
            return res.redirect('/harvests');
        }

        // Busca todos os produtos e categorias para preencher os selects do formulário
        const products = await Product.findAll({ order: [['name', 'ASC']] });
        const categories = await Category.findAll({ order: [['name', 'ASC']] });

        res.render('harvests/edit', {
            title: 'Editar Colheita',
            harvest: harvest,
            products: products,
            categories: categories,
            error: req.flash('error'),
            success: req.flash('success')
        });
    } catch (error) {
        console.error('Erro ao carregar formulário de edição de colheita:', error);
        req.flash('error', 'Não foi possível carregar o formulário de edição.');
        res.redirect('/harvests');
    }
};

// Função para atualizar uma colheita
exports.updateHarvest = async (req, res) => {
    const harvestId = req.params.id;
    const { product_id, quantity, category_id, harvest_date } = req.body;

    try {
        // Validação básica
        if (!product_id || !quantity) {
            req.flash('error', 'Produto e quantidade são obrigatórios.');
            return res.redirect(`/harvests/edit/${harvestId}`);
        }

        // Busca a colheita para verificar se existe
        const harvest = await Harvest.findByPk(harvestId);
        if (!harvest) {
            req.flash('error', 'Colheita não encontrada.');
            return res.redirect('/harvests');
        }

        // Atualiza a colheita
        await harvest.update({
            product_id: parseInt(product_id),
            quantity: parseFloat(quantity),
            category_id: category_id ? parseInt(category_id) : null,
            harvest_date: harvest_date ? new Date(harvest_date) : harvest.harvest_date
        });

        req.flash('success', 'Colheita atualizada com sucesso!');
        res.redirect('/harvests');
    } catch (error) {
        console.error('Erro ao atualizar colheita:', error);
        req.flash('error', 'Erro ao atualizar colheita. Por favor, tente novamente.');
        res.redirect(`/harvests/edit/${harvestId}`);
    }
};