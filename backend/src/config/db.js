const sql = require('mssql');

const getDbConfig = () => ({
  server: process.env.DB_SERVER || 'localhost\\SQLEXPRESS',
  port: Number(process.env.DB_PORT || 1433),
  database: process.env.DB_NAME || 'MCC_SparePartDB',
  user: process.env.DB_USER || 'mcc_user',
  password: process.env.DB_PASSWORD || 'Philips2026!',
  options: {
    encrypt: false,
    trustServerCertificate: true,
    enableArithAbort: true,
  },
});

const poolPromise = sql.connect(getDbConfig())
  .then((pool) => {
    console.log('✅ Database connected');
    return pool;
  })
  .catch((err) => {
    console.error('❌ Database connection failed:', err.message);
    return null;
  });

module.exports = {
  sql,
  getDbConfig,
  poolPromise,
};