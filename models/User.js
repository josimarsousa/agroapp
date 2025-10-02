const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const User = sequelize.define('User', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    username: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    password: {
        type: DataTypes.STRING,
        allowNull: false
    },
    role: {
        type: DataTypes.STRING,
        defaultValue: 'user' // Ex: 'admin', 'user'
    }
}, {
    tableName: 'users', // Nome da tabela no banco
    timestamps: true, // Adiciona createdAt e updatedAt
    createdAt: 'created_at',
    updatedAt: false // Não precisamos de updatedAt para o User neste exemplo
});

module.exports = User;