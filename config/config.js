const fs = require('fs');
require('dotenv').config();

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
    username: process.env.DB_USER || process.env.MYSQLUSER || process.env.MYSQL_USER,
    password: process.env.DB_PASSWORD || process.env.MYSQLPASSWORD || process.env.MYSQL_PASSWORD,
    database: process.env.DB_NAME || process.env.MYSQLDATABASE || process.env.MYSQL_DATABASE,
    host: process.env.DB_HOST || process.env.MYSQLHOST || process.env.MYSQL_HOST,
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : (process.env.MYSQLPORT ? parseInt(process.env.MYSQLPORT, 10) : (process.env.MYSQL_PORT ? parseInt(process.env.MYSQL_PORT, 10) : 3306)),
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