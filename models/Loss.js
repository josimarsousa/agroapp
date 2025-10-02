const { DataTypes } = require('sequelize')
const {sequelize} = require('../config/database')

const Product =  require('./Product');
const User =  require('./User');
const Category = require("./Category");

const Loss =  sequelize.define('Loss', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    product_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: Product,
            key: 'id'
        }
    },
    category_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: Category,
            key: 'id'
        }
    },
    quantity: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
    },
    loss_date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        defaultValue: DataTypes.NOW
    },
    description: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    registered_by: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: User,
            key: 'id'
        }
    }
}, {
    tableName: 'losses',
    timestamps: true,
})

Loss.belongsTo(Product, { foreignKey: 'product_id', as: 'product' })
Loss.belongsTo(Category, { foreignKey: 'category_id', as: 'category' })
Loss.belongsTo(User, { foreignKey: 'registered_by', as: 'user' })

module.exports = Loss;