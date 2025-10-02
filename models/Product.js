const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Product = sequelize.define('Product', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
    },
    stock_quantity: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
    },
    category_id: {
        type: DataTypes.INTEGER,
        allowNull: true, // Permite nulo caso a categoria seja removida
        references: {
            model: 'categories', // Nome da tabela
            key: 'id'
        }
    }
}, {
    tableName: 'products',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false
});

Product.associate = (models) => {
    Product.belongsTo(models.Category, {
        foreignKey: 'category_id',
        as: 'category'
    });
};

module.exports = Product;