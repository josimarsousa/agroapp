const { sequelize, connectDB } = require('../config/database');
const { DataTypes } = require('sequelize');

const User = require('./User');
const Customer = require('./Customer');
const Category = require('./Category');
const Product = require('./Product');
const Sale = require('./Sale');
const SaleItem = require('./SaleItem');
const Harvest = require('./Harvest');
const Loss = require('./Loss');


// --- AQUI É O PONTO CHAVE: Agrupamos todos os seus modelos em um objeto 'models' ---
const models = {
    User,
    Customer,
    Category,
    Product,
    Sale,
    SaleItem,
    Harvest,
    Loss,

};

// --- E ESTE É O LOOP QUE CHAMA OS MÉTODOS 'ASSOCIATE' DE CADA MODELO ---
// Ele percorre o objeto 'models' e, para cada modelo que tem um método 'associate',
// ele executa esse método, passando o objeto 'models' completo.
Object.keys(models).forEach(modelName => {
    if (models[modelName].associate) {
        models[modelName].associate(models); // Passa o objeto 'models' para o método 'associate'
    }
});
// ----------------------------------------------------------------------


async function syncModels() {
    try {
        await sequelize.sync({ alter: true }); // 'alter: true' tenta sincronizar o estado atual dos seus modelos com o DB.
        // Cuidado em produção, pois pode modificar a estrutura.
        console.log('Todos os modelos foram sincronizados com o banco de dados. 🚀');
    } catch (error) {
        console.error('Erro ao sincronizar modelos:', error);
    }
}

module.exports = {
    sequelize,
    connectDB,
    syncModels,
    User,
    Customer,
    Category,
    Product,
    Sale,
    SaleItem,
    Harvest,
    Loss,

};