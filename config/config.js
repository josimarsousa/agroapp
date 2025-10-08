const fs = require('fs');
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

// Suporte a variáveis DB_* e MYSQL* (Railway)
const DB_NAME = process.env.DB_NAME || process.env.MYSQLDATABASE || process.env.MYSQL_DB;
const DB_USER = process.env.DB_USER || process.env.MYSQLUSER || process.env.MYSQL_USER;
const DB_PASSWORD = process.env.DB_PASSWORD || process.env.MYSQLPASSWORD || process.env.MYSQL_PASSWORD;
const DB_HOST = process.env.DB_HOST || process.env.MYSQLHOST || process.env.MYSQL_HOST;
const DB_PORT = process.env.DB_PORT || process.env.MYSQLPORT || process.env.MYSQL_PORT;

module.exports = {
  development: {
    username: 'root',
    password: '123456',
    database: 'agroapp',
    host: '127.0.0.1',
    port: 3306,
    dialect: 'mysql'
  },
  test: {
    username: 'root',
    password: '123456',
    database: 'agroapp_test',
    host: '127.0.0.1',
    port: 3306,
    dialect: 'mysql'
  },
  production: {
    username: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
    host: DB_HOST,
    port: DB_PORT ? parseInt(DB_PORT, 10) : 3306,
    dialect: 'mysql',
    logging: false,
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000
    },
    // Caso seu provedor exija SSL, descomente abaixo e forneça o CA
    // dialectOptions: {
    //   ssl: {
    //     ca: fs.readFileSync(path.join(__dirname, 'mysql-ca-main.crt')),
    //   }
    // }
  }
};