// models/Harvest.js

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database'); // Importa a instância do Sequelize

const Harvest = sequelize.define('Harvest', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
    },
    product_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'Products', // Nome da tabela no banco de dados
            key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE' // Garante que a colheita seja deletada se o produto for deletado
    },
    quantity: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
    },
    category_id: {
        type: DataTypes.INTEGER,
        allowNull: true, // A categoria pode ser opcional
        references: {
            model: 'Categories', // Nome da tabela no banco de dados
            key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL' // Se a categoria for deletada, define category_id como NULL
    },
    user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'Users', // Nome da tabela no banco de dados
            key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE' // Garante que a colheita seja deletada se o usuário for deletado
    },
    harvest_date: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'harvests', // Nome da tabela no banco de dados
    timestamps: true, // Adiciona createdAt e updatedAt

});

// Definindo as associações aqui mesmo, antes de exportar o modelo
Harvest.associate = (models) => {
    Harvest.belongsTo(models.Product, {
        foreignKey: 'product_id',
        as: 'product'
    });
    Harvest.belongsTo(models.Category, {
        foreignKey: 'category_id',
        as: 'category'
    });
    Harvest.belongsTo(models.User, {
        foreignKey: 'user_id',
        as: 'user'
    });
};

module.exports = Harvest; // Exporta o modelo já definido