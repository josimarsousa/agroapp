// models/Sale.js (o arquivo agora se chama Sale.js)
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Sale = sequelize.define('Sale', { // <<< AQUI!
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    customer_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'customers', // Referencia a tabela 'customers'
            key: 'id'
        }
    },
    sale_date: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        allowNull: false
    },
    total_amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
    },
    user_id: { // Quem realizou a venda
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'users', // Referencia a tabela 'users'
            key: 'id'
        }
    }
}, {
    tableName: 'sales', // O nome da tabela no DB continua sendo 'sales'
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false // Você pode ter 'updated_at' se quiser, ou deixar false
});

// DEFINIÇÃO DA FUNÇÃO ASSOCIATE PARA AS RELAÇÕES
Sale.associate = (models) => {
    // Uma Venda tem muitos Itens de Venda (SaleItem)
    Sale.hasMany(models.SaleItem, {
        foreignKey: 'sale_id', // Chave estrangeira em SaleItem que aponta para Sale
        as: 'items' // ALIAS CORRETO: 'items', como o erro sugeriu
    });

    // Uma Venda pertence a um Cliente
    Sale.belongsTo(models.Customer, {
        foreignKey: 'customer_id',
        as: 'customer'
    });

    // Uma Venda pertence a um Usuário
    Sale.belongsTo(models.User, {
        foreignKey: 'user_id',
        as: 'user'
    });
};

module.exports = Sale;