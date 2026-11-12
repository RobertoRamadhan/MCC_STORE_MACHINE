const sql = require('mssql');

const config = {
  server: 'SQLEXPRESS',
  database: 'MCC_SparePartDB',
  driver: 'msnodesqlv8',
  options: {
    trustedConnection: true,
    encrypt: false,
    trustServerCertificate: true,
  },
};

const poolPromise = new sql.ConnectionPool(config)
  .connect()
  .then(pool => {
    console.log('✅ Terhubung ke SQL Server!');
    return pool;
  })
  .catch(err => {
    console.log('❌ Koneksi gagal:', err);
  });

module.exports = { sql, poolPromise };