const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(
    process.env.DB_NAME || process.env.MYSQLDATABASE || process.env.MYSQL_DATABASE,
    process.env.DB_USER || process.env.MYSQLUSER || process.env.MYSQL_USER,
    process.env.DB_PASSWORD || process.env.MYSQLPASSWORD || process.env.MYSQL_PASSWORD,
    {
        host: process.env.DB_HOST || process.env.MYSQLHOST || process.env.MYSQL_HOST,
        port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : (process.env.MYSQLPORT ? parseInt(process.env.MYSQLPORT, 10) : (process.env.MYSQL_PORT ? parseInt(process.env.MYSQL_PORT, 10) : 3306)),
        dialect: 'mysql',
        logging: false, // Desabilita o log de queries no console
        pool: {
            max: 5,
            min: 0,
            acquire: 30000,
            idle: 10000
        }
    }
);

// Testar a conexão
async function connectDB() {
    try {
        await sequelize.authenticate();
        console.log('Conexão com o banco de dados estabelecida com sucesso.');
    } catch (error) {
        console.error('Não foi possível conectar ao banco de dados:', error);
        process.exit(1); // Encerra a aplicação se não conseguir conectar
    }
}

module.exports = { sequelize, connectDB };