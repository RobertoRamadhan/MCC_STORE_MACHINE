const sql = require('mssql');

const getDbConfig = () => ({
  server: process.env.DB_SERVER || 'localhost\\SQLEXPRESS',
  port: Number(process.env.DB_PORT || 1433),
  database: process.env.DB_NAME || 'MCC_SparePartDB',
  user: process.env.DB_USER || 'mcc_user',
  password: process.env.DB_PASSWORD || '',
  options: {
    encrypt: false,
    trustServerCertificate: true,
    enableArithAbort: true,
  },
});

module.exports = {
  sql,
  getDbConfig,
};