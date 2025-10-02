// models/SaleItem.js
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database'); // Se você usa 'sequelize' globalmente

const SaleItem = sequelize.define('SaleItem', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    sale_id: { // Chave estrangeira para a venda
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'sales', // Nome da tabela no banco de dados (geralmente plural minúsculo)
            key: 'id'
        }
    },
    product_id: { // Chave estrangeira para o produto
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'products', // Nome da tabela no banco de dados
            key: 'id'
        }
    },
    quantity: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    unit_price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
    },
    subtotal: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
    }
}, {
    tableName: 'sale_items', // Nome da tabela no banco de dados
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false
});

// --- ADICIONE ESTA FUNÇÃO DE ASSOCIAÇÃO ---
SaleItem.associate = (models) => {
    // Um SaleItem pertence a uma Sale
    SaleItem.belongsTo(models.Sale, { // Use models.Sale (PascalCase) aqui
        foreignKey: 'sale_id',
        as: 'sale' // Alias para quando você inclui a venda a partir do SaleItem
    });

    // Um SaleItem pertence a um Product
    SaleItem.belongsTo(models.Product, { // Use models.Product (PascalCase) aqui
        foreignKey: 'product_id',
        as: 'product' // Alias para quando você inclui o produto a partir do SaleItem
    });
};

module.exports = SaleItem;