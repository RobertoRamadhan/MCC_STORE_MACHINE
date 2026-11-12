const sql = require('mssql');
const config = {
  server: process.env.MSSQL_SERVER || 'localhost\\SQLEXPRESS',
  port: Number(process.env.MSSQL_PORT || 1433),
  database: process.env.MSSQL_DB || 'MCC_SparePartDB',
  user: process.env.MSSQL_USER || 'mcc_user',
  password: process.env.MSSQL_PASSWORD || 'Philips2026!',
  options: { encrypt: false, trustServerCertificate: true, enableArithAbort: true }
};
(async () => {
  try {
    const pool = await sql.connect(config);
    const req = await pool.request().query("SELECT TOP 10 id, teknisi_id, teknisi_nama, part_nama, jumlah, status, created_at FROM PartOutRequests ORDER BY id DESC");
    console.log('PartOutRequests sample:\n' + JSON.stringify(req.recordset, null, 2));
    const foto = await pool.request().query("SELECT TOP 10 id, request_id, tipe_foto, uploaded_by, created_at FROM RequestFoto ORDER BY id DESC");
    console.log('\nRequestFoto sample:\n' + JSON.stringify(foto.recordset, null, 2));
  } catch (e) {
    console.error('ERR', e.message);
    process.exit(1);
  }
})();
