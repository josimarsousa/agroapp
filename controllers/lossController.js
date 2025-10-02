// controllers/lossController.js
const { Loss, Product, Category, User } = require('../models'); // Importe os modelos necessários
const { Op, Sequelize } = require('sequelize');
const PDFDocument = require('pdfkit'); // Para exportação PDF, se for usar

// Listar todas as perdas
exports.listLosses = async (req, res) => {
    try {
        let { start_date, end_date } = req.query;
        let whereClause = {};
        
        // Aplicar filtro por data se fornecido
        if (start_date || end_date) {
            if (start_date) {
                const parsedStartDate = new Date(start_date + 'T00:00:00');
                whereClause.loss_date = {
                    [Op.gte]: parsedStartDate
                };
            }
            
            if (end_date) {
                const parsedEndDate = new Date(end_date + 'T00:00:00');
                parsedEndDate.setDate(parsedEndDate.getDate() + 1);
                
                if (whereClause.loss_date) {
                    whereClause.loss_date[Op.lt] = parsedEndDate;
                } else {
                    whereClause.loss_date = {
                        [Op.lt]: parsedEndDate
                    };
                }
            }
        }
        
        const losses = await Loss.findAll({
            where: whereClause,
            include: [
                { model: Product, as: 'product' },
                { model: Category, as: 'category' },
                { model: User, as: 'user' }
            ],
            order: [['loss_date', 'DESC']]
        });
        
        // Passar os parâmetros de filtro para a view
        res.render('losses/list', {
            losses,
            messages: req.flash(),
            start_date: start_date || '',
            end_date: end_date || ''
        });
    } catch (error) {
        console.error('Erro ao listar perdas:', error);
        req.flash('error', 'Erro ao listar perdas.');
        res.redirect('/losses');
    }
};

// Exibir formulário para nova perda
exports.newLossForm = async (req, res) => {
    try {
        const products = await Product.findAll({ order: [['name', 'ASC']] });
        const categories = await Category.findAll({ order: [['name', 'ASC']] });
        res.render('losses/new', { products, categories, messages: req.flash() });
    } catch (error) {
        console.error('Erro ao carregar formulário de nova perda:', error);
        req.flash('error', 'Erro ao carregar formulário.');
        res.redirect('/losses');
    }
};

// Criar nova perda
exports.createLoss = async (req, res) => {
    try {
        const { product_id, category_id, quantity, loss_date, description } = req.body;
        const registered_by = req.user ? req.user.id : null; // Pega o ID do usuário logado

        await Loss.create({
            product_id,
            category_id,
            quantity: parseFloat(quantity), // Certifique-se de converter para número
            loss_date,
            description,
            registered_by
        });
        req.flash('success', 'Perda registrada com sucesso!');
        res.redirect('/losses');
    } catch (error) {
        console.error('Erro ao criar perda:', error);
        req.flash('error', 'Erro ao registrar perda: ' + error.message);
        res.redirect('/losses/new');
    }
};

// Exibir formulário de edição de perda
exports.editLossForm = async (req, res) => {
    try {
        const loss = await Loss.findByPk(req.params.id, {
            include: [
                { model: Product, as: 'product' },
                { model: Category, as: 'category' }
            ]
        });
        if (!loss) {
            req.flash('error', 'Perda não encontrada.');
            return res.redirect('/losses');
        }
        const products = await Product.findAll({ order: [['name', 'ASC']] });
        const categories = await Category.findAll({ order: [['name', 'ASC']] });
        res.render('losses/edit', { loss, products, categories, messages: req.flash() });
    } catch (error) {
        console.error('Erro ao carregar formulário de edição:', error);
        req.flash('error', 'Erro ao carregar formulário de edição.');
        res.redirect('/losses');
    }
};

// Atualizar perda
exports.updateLoss = async (req, res) => {
    try {
        const { product_id, category_id, quantity, loss_date, description } = req.body;
        const loss = await Loss.findByPk(req.params.id);
        if (!loss) {
            req.flash('error', 'Perda não encontrada para atualização.');
            return res.redirect('/losses');
        }
        await loss.update({
            product_id,
            category_id,
            quantity: parseFloat(quantity),
            loss_date,
            description
        });
        req.flash('success', 'Perda atualizada com sucesso!');
        res.redirect('/losses');
    } catch (error) {
        console.error('Erro ao atualizar perda:', error);
        req.flash('error', 'Erro ao atualizar perda: ' + error.message);
        res.redirect(`/losses/${req.params.id}/edit`);
    }
};

// Deletar perda
exports.deleteLoss = async (req, res) => {
    try {
        const loss = await Loss.findByPk(req.params.id);
        if (!loss) {
            req.flash('error', 'Perda não encontrada para exclusão.');
            return res.redirect('/losses');
        }
        await loss.destroy();
        req.flash('success', 'Perda excluída com sucesso!');
        res.redirect('/losses');
    } catch (error) {
        console.error('Erro ao excluir perda:', error);
        req.flash('error', 'Erro ao excluir perda: ' + error.message);
        res.redirect('/losses');
    }
};


// --- Implementação da Geração de PDF (muito similar à de Colheitas) ---
exports.exportLossesPdf = async (req, res) => {
    try {
        let { start_date, end_date } = req.query;
        let losses;
        let reportTitle;
        let isAggregatedView;
        let periodText = '';

        if (start_date || end_date) {
            reportTitle = 'Relatório de Perdas Agregadas';
            isAggregatedView = true;
            let whereClause = {};

            let startDateFormatted = start_date ? new Date(start_date + 'T00:00:00').toLocaleDateString('pt-BR') : '(início)';
            let endDateFormatted = end_date ? new Date(end_date + 'T00:00:00').toLocaleDateString('pt-BR') : '(fim)';
            periodText = `Período: ${startDateFormatted} até ${endDateFormatted}`;

            if (start_date) {
                const parsedStartDate = new Date(start_date + 'T00:00:00');
                whereClause.loss_date = { // MUDE AQUI PARA loss_date
                    [Op.gte]: parsedStartDate
                };
            }

            if (end_date) {
                const parsedEndDate = new Date(end_date + 'T00:00:00');
                parsedEndDate.setDate(parsedEndDate.getDate() + 1);

                if (whereClause.loss_date) { // MUDE AQUI PARA loss_date
                    whereClause.loss_date[Op.lt] = parsedEndDate;
                } else {
                    whereClause.loss_date = { // MUDE AQUI PARA loss_date
                        [Op.lt]: parsedEndDate
                    };
                }
            }

            losses = await Loss.findAll({ // MUDE AQUI PARA Loss
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
            reportTitle = 'Relatório de Todas as Perdas';
            isAggregatedView = false;
            losses = await Loss.findAll({ // MUDE AQUI PARA Loss
                include: [
                    { model: Product, as: 'product' },
                    { model: Category, as: 'category' },
                    { model: User, as: 'user' }
                ],
                order: [['loss_date', 'DESC']] // MUDE AQUI PARA loss_date
            });
            periodText = 'Período: Todos os registros';
        }

        const doc = new PDFDocument({ margin: 50 });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="relatorio_perdas_${Date.now()}.pdf"`); // Nome do arquivo

        doc.pipe(res);

        doc.fontSize(20).text(reportTitle, { align: 'center' });
        doc.fontSize(12).text(periodText, { align: 'center' });
        doc.moveDown();

        const table = {
            headers: [],
            rows: []
        };

        const tableBodyFontSize = 9; // Tamanho da fonte para o corpo da tabela

        if (isAggregatedView) {
            table.headers = ['Produto', 'Quantidade Total Perdida', 'Categoria']; // Ajuste o cabeçalho
            losses.forEach(l => { // MUDE AQUI PARA 'l' de loss
                table.rows.push([
                    l.product ? l.product.name : 'N/A',
                    (l.dataValues.totalQuantity ? parseFloat(l.dataValues.totalQuantity) : 0).toFixed(2),
                    l.category ? l.category.name : 'N/A'
                ]);
            });
        } else {
            table.headers = ['Produto', 'Quantidade Perdida', 'Categoria', 'Data da Perda', 'Registrado por', 'Descrição']; // Ajuste o cabeçalho e adicione descrição
            losses.forEach(l => { // MUDE AQUI PARA 'l' de loss
                table.rows.push([
                    l.product ? l.product.name : 'N/A',
                    (l.quantity ? parseFloat(l.quantity) : 0).toFixed(2),
                    l.category ? l.category.name : 'N/A',
                    new Date(l.loss_date).toLocaleDateString('pt-BR'), // MUDE AQUI PARA loss_date
                    l.user ? l.user.username : 'N/A',
                    l.description ? l.description : '' // Adiciona a descrição
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
            // Ajuste as larguras para o relatório agregado de perdas
            colWidths = [
                tableWidth * 0.35, // Produto
                tableWidth * 0.25, // Quantidade Total Perdida
                tableWidth * 0.4   // Categoria
            ];
        } else {
            // Ajuste as larguras para o relatório detalhado de perdas (6 colunas)
            colWidths = [
                tableWidth * 0.15, // Data
                tableWidth * 0.20, // Produto
                tableWidth * 0.15, // Categoria
                tableWidth * 0.10, // Quantidade
                tableWidth * 0.15, // Registrado por
                tableWidth * 0.25  // Descrição (pode ser longa)
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

        doc.fontSize(tableBodyFontSize).font('Helvetica');

        table.rows.forEach((row, rowIndex) => {
            let rowHeight = 0;

            row.forEach((cellText, colIndex) => {
                const width = colWidths[colIndex];
                const text = String(cellText);

                let textHeight = doc.heightOfString(text, { width: width });

                if (typeof textHeight !== 'number' || isNaN(textHeight) || textHeight < 0) {
                    console.warn(`[Linha ${rowIndex}, Coluna ${colIndex}] Altura de texto inválida (${textHeight}) para a célula: '${text.substring(0, Math.min(text.length, 100))}' com largura ${width}. Usando fallback.`); // Ajuste no substring
                    textHeight = tableBodyFontSize * 1.2;
                }

                rowHeight = Math.max(rowHeight, textHeight);
            });

            if (typeof rowHeight !== 'number' || isNaN(rowHeight) || rowHeight <= 0) {
                console.error(`[Linha ${rowIndex}] Altura da linha (rowHeight) inválida ou não-positiva:`, rowHeight, 'para a linha:', row);
                rowHeight = tableBodyFontSize * 1.5;
            }

            let calculatedMoveDownValue;
            try {
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
        res.redirect('/losses');
    }
};